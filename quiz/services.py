# quiz/services.py
import logging
import json, re
from core.ai_client import ai_client
from core.exceptions import APIIntegrationError

logger = logging.getLogger(__name__)


class QuizService:
    """
    Robust quiz generation service:
    - Accepts ai_client responses that are either string or provider dicts.
    - Extracts assistant text from common provider response shapes.
    - Attempts full JSON parse; if that fails, extracts JSON substring.
    - Falls back to deterministic simple questions when parsing or AI fails.
    """

    @staticmethod
    def _extract_text_from_provider_response(resp):
        """
        Normalize different provider response dict shapes to a single assistant text string.

        Supported shapes:
        - OpenAI/Azure: {'choices':[{'message':{'content': '...'}} , ...], ...}
        - Older OpenAI shape: {'choices':[{'text': '...'}]}
        - DeepSeek-like: similar to OpenAI
        - Gemini: {'candidates':[{'content':{'parts':['...']}}]}
        - HuggingFace inference: list or dict with 'generated_text'
        """
        if resp is None:
            return ""

        # If it's already a string, return it
        if isinstance(resp, str):
            return resp

        # If it's bytes, decode
        if isinstance(resp, (bytes, bytearray)):
            try:
                return resp.decode('utf-8', errors='ignore')
            except Exception:
                return str(resp)

        # If it's a dict or list try to find text
        try:
            # Common OpenAI / Azure new Chat completions format
            if isinstance(resp, dict) and 'choices' in resp and isinstance(resp['choices'], list) and len(resp['choices']) > 0:
                choice = resp['choices'][0]
                # new: choice['message']['content']
                if isinstance(choice, dict):
                    # choice.message.content
                    msg = choice.get('message')
                    if isinstance(msg, dict):
                        content = msg.get('content')
                        if isinstance(content, str) and content.strip():
                            return content
                    # fallback: choice.get('content') or choice.get('text')
                    if 'content' in choice and isinstance(choice['content'], str):
                        return choice['content']
                    if 'text' in choice and isinstance(choice['text'], str):
                        return choice['text']

            # Gemini style
            if isinstance(resp, dict) and 'candidates' in resp and isinstance(resp['candidates'], list) and len(resp['candidates']) > 0:
                cand = resp['candidates'][0]
                # candidate.content.parts => list of strings
                c = cand.get('content')
                if isinstance(c, dict):
                    parts = c.get('parts') or c.get('text') or []
                    if isinstance(parts, list) and parts:
                        return ''.join([p for p in parts if isinstance(p, str)])
                    if isinstance(parts, str):
                        return parts

            # HuggingFace inference returns list or dict
            if isinstance(resp, list) and len(resp) > 0:
                first = resp[0]
                if isinstance(first, dict) and 'generated_text' in first:
                    return first.get('generated_text', '')
                # sometimes model returns a dict inside a list with 'generated_text'
                return str(first)

            if isinstance(resp, dict) and 'generated_text' in resp:
                return resp.get('generated_text', '')

            # Fallback: stringify the dict but prefer 'text' keys if present
            # Look for any obvious keys
            for key in ('text', 'message', 'content', 'result'):
                val = resp.get(key) if isinstance(resp, dict) else None
                if isinstance(val, str) and val.strip():
                    return val

        except Exception as e:
            logger.debug("Error while extracting text from provider response: %s", e)

        # Ultimate fallback: stringify
        try:
            return json.dumps(resp) if not isinstance(resp, str) else str(resp)
        except Exception:
            return str(resp)

    @staticmethod
    def _extract_json_substring(s: str):
        """
        Try to extract the first JSON object/array substring from text s and parse it.
        Returns parsed JSON (dict/list) or None.
        """
        if not s or not isinstance(s, str):
            return None
        s = s.strip()

        # Direct parse
        try:
            return json.loads(s)
        except Exception:
            pass

        # Find first opening brace [ or {
        idx_obj = s.find('{')
        idx_arr = s.find('[')
        candidates = [i for i in (idx_obj, idx_arr) if i != -1]
        if not candidates:
            return None
        start = min(candidates)

        # Find a closing bracket of the same type by scanning from the end
        opening = s[start]
        closing = '}' if opening == '{' else ']'
        last = s.rfind(closing)
        if last <= start:
            return None
        candidate = s[start:last + 1]

        try:
            return json.loads(candidate)
        except Exception:
            # Try looser approach: attempt to find balanced brackets (small heuristic)
            depth = 0
            end_index = None
            for i in range(start, len(s)):
                ch = s[i]
                if ch == opening:
                    depth += 1
                elif ch == closing:
                    depth -= 1
                    if depth == 0:
                        end_index = i
                        break
            if end_index:
                try:
                    return json.loads(s[start:end_index + 1])
                except Exception:
                    return None
        return None

    @staticmethod
    def _fallback_questions(study_text: str, num_mcq: int, num_short: int, subject: str):
        mcq = []
        short = []
        base = subject or "General"
        for i in range(max(0, int(num_mcq))):
            mcq.append({
                "question": f"(Fallback) What is the main topic related to {base}?",
                "options": [
                    f"{base}",
                    "A secondary detail",
                    "An unrelated concept",
                    "A technical term"
                ],
                "answer": "A",
                "explanation": f"Fallback: choose the option mentioning {base}."
            })
        for i in range(max(0, int(num_short))):
            short.append({
                "question": f"(Fallback) Summarize the key idea about {base} in one sentence.",
                "answer": f"A brief summary about {base}.",
                "explanation": "Fallback summary expected."
            })
        return {"mcq_questions": mcq, "short_questions": short}

    @staticmethod
    def _sanitize_mcq_list(lst):
        sanitized = []
        for i, item in enumerate(lst or []):
            if not isinstance(item, dict):
                sanitized.append({
                    "question": str(item),
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "answer": "A",
                    "explanation": ""
                })
                continue
            question = item.get("question") or item.get("q") or f"MCQ {i+1}"
            options = item.get("options") or item.get("choices") or item.get("opts") or []
            if not isinstance(options, list):
                options = list(options) if options else []
            if len(options) < 2:
                options = ["Option A", "Option B", "Option C", "Option D"]
            answer = (item.get("answer") or item.get("correct") or "").strip()
            # normalize answer to single letter if it's an option string like "A) text"
            if isinstance(answer, str) and len(answer) > 1 and answer[0].upper() in ("A", "B", "C", "D"):
                answer = answer[0].upper()
            elif not answer:
                # fallback to first option -> 'A'
                answer = "A"
            sanitized.append({
                "question": question,
                "options": options[:4],
                "answer": answer,
                "explanation": item.get("explanation", "")
            })
        return sanitized

    @staticmethod
    def _sanitize_short_list(lst):
        sanitized = []
        for i, item in enumerate(lst or []):
            if not isinstance(item, dict):
                sanitized.append({"question": str(item), "answer": "", "explanation": ""})
                continue
            question = item.get("question") or item.get("q") or f"Short {i+1}"
            answer = item.get("answer") or item.get("expected") or ""
            sanitized.append({"question": question, "answer": answer, "explanation": item.get("explanation", "")})
        return sanitized

    @staticmethod
    def generate_quiz(study_text, num_mcq, num_short, subject="General", difficulty="any"):
        if not study_text or len(str(study_text).strip()) < 30:
            raise ValueError("Please provide at least 30 characters of study material.")

        prompt = f"""
        Generate quiz questions from the following text.

        Subject: {subject}
        Difficulty: {difficulty}
        Number of MCQs: {num_mcq}
        Number of Short Answer: {num_short}

        TEXT:
        {study_text}

        IMPORTANT: Return a pure JSON object with keys:
        - mcq_questions: [ {{question, options (array), answer, explanation}} ]
        - short_questions: [ {{question, answer, explanation}} ]

        Do not include any surrounding commentary.
        """

        try:
            raw = ai_client.generate_content(prompt, raise_on_error=False)
        except Exception as e:
            logger.error("AI client call failed: %s", e)
            fallback = QuizService._fallback_questions(study_text, num_mcq, num_short, subject)
            return {"mcq_questions": fallback["mcq_questions"][:num_mcq], "short_questions": fallback["short_questions"][:num_short]}

        # Extract assistant text from provider response (handles dicts and strings)
        assistant_text = QuizService._extract_text_from_provider_response(raw)
        assistant_text = (assistant_text or "").strip()

        if not assistant_text:
            logger.error("AI returned no assistant text (raw repr truncated): %s", str(raw)[:1000])
            fallback = QuizService._fallback_questions(study_text, num_mcq, num_short, subject)
            return {"mcq_questions": fallback["mcq_questions"][:num_mcq], "short_questions": fallback["short_questions"][:num_short]}

        parsed = None
        # Try parsing full text as JSON
        try:
            parsed = json.loads(assistant_text)
        except Exception:
            parsed = QuizService._extract_json_substring(assistant_text)

        if parsed is None or not isinstance(parsed, dict):
            logger.error("Failed to parse AI response JSON. Assistant text (truncated 2000 chars):\n%s", assistant_text[:2000])
            fallback = QuizService._fallback_questions(study_text, num_mcq, num_short, subject)
            return {"mcq_questions": fallback["mcq_questions"][:num_mcq], "short_questions": fallback["short_questions"][:num_short]}

        # Extract lists (allow flexibility in naming)
        mcq_list = parsed.get("mcq_questions") or parsed.get("mcqs") or parsed.get("multiple_choice") or []
        short_list = parsed.get("short_questions") or parsed.get("shorts") or parsed.get("short_answer_questions") or []

        mcq_list = QuizService._sanitize_mcq_list(mcq_list)[:max(0, int(num_mcq))]
        short_list = QuizService._sanitize_short_list(short_list)[:max(0, int(num_short))]

        if len(mcq_list) == 0 and len(short_list) == 0:
            logger.warning("AI returned empty question lists after parsing — using fallback.")
            fallback = QuizService._fallback_questions(study_text, num_mcq, num_short, subject)
            return {"mcq_questions": fallback["mcq_questions"][:num_mcq], "short_questions": fallback["short_questions"][:num_short]}

        return {"mcq_questions": mcq_list, "short_questions": short_list}

    @staticmethod
    def grade_short_answer(question, expected_answer, user_answer):
        prompt = f"""
        Evaluate the following short answer for correctness.
        Question: {question}
        Expected answer: {expected_answer}
        User answer: {user_answer}
        Reply only with 'Yes' if the user's answer is correct, or 'No' if it is not.
        """
        try:
            resp = ai_client.generate_content(prompt, raise_on_error=False)
            text = QuizService._extract_text_from_provider_response(resp)
            return str(text).strip().lower().startswith("yes")
        except Exception as e:
            logger.warning("AI grading failed, falling back to heuristic: %s", e)
            user = (user_answer or "").lower().strip()
            exp = (expected_answer or "").lower().strip()
            if user and user == exp:
                return True
            ew = set(exp.split())
            uw = set(user.split())
            if ew and len(ew.intersection(uw)) / len(ew) > 0.5:
                return True
            return False
