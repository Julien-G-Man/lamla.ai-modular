import os
from openai import OpenAI
import requests
import json
from typing import Dict, List, Optional
from django.conf import settings
from .models import Question, QuestionCache
import logging

logger = logging.getLogger(__name__)

class QuestionGenerator:
    def __init__(self):
        self.azure_openai_api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', None)
        self.azure_openai_endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', None)
        self.deepseek_api_key = getattr(settings, 'DEEPSEEK_API_KEY', None)
        self.gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None)
        self.gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-pro')
        self.hf_token = getattr(settings, 'HUGGING_FACE_API_TOKEN', None)
        
        # Log API configuration status
        logger.info(f"Azure OpenAI API Key: {'Set' if self.azure_openai_api_key else 'Not set'}")
        logger.info(f"Azure OpenAI Endpoint: {'Set' if self.azure_openai_endpoint else 'Not set'}")
        logger.info(f"DeepSeek API Key: {'Set' if self.deepseek_api_key else 'Not set'}")
        logger.info(f"Gemini API Key: {'Set' if self.gemini_api_key else 'Not set'}")
        logger.info(f"Hugging Face Token: {'Set' if self.hf_token else 'Not set'}")
        
        # Prefer Azure OpenAI, then DeepSeek, then Gemini, then Hugging Face
        if self.azure_openai_api_key and self.azure_openai_endpoint:
            self.primary_api = 'azure_openai'
            logger.info("Primary API set to: Azure OpenAI")
        elif self.deepseek_api_key:
            self.primary_api = 'deepseek'  
            logger.info("Primary API set to: DeepSeek")
        elif self.gemini_api_key:
            self.primary_api = 'gemini'
            logger.info("Primary API set to: Gemini")
        elif self.hf_token:
            self.primary_api = 'huggingface'
            logger.info("Primary API set to: Hugging Face")
        else:
            self.primary_api = None
            logger.warning("No API keys configured for question generation")

    def _create_prompt(self, text: str, num_mcq: int = 3, num_short: int = 2, subject: str = None, difficulty: str = None) -> str:
        """Create a prompt for question generation"""
        subject_line = f"Subject/Topic: {subject}\n" if subject else ""
        difficulty_line = ""
        
        if difficulty and difficulty.lower() != 'any':
            d = difficulty.lower()
            if d == 'easy':
                difficulty_line = ("\nDIFFICULTY: All questions must be EASY.\n"
                    "- Level: High school.\n"
                    "- Focus on basic understanding, recall, and single-step reasoning.\n"
                    "- No advanced math, synthesis, or multi-step logic.\n"
                    "- Suitable for typical high school exams.")
            elif d == 'medium':
                difficulty_line = ("\nDIFFICULTY: All questions must be MEDIUM.\n"
                    "- Level: University undergraduate.\n"
                    "- Require application, analysis, and multi-step reasoning.\n"
                    "- May involve moderate synthesis or integration of concepts.\n"
                    "- Suitable for standard university exams.")
            elif d == 'hard':
                difficulty_line = ("\nDIFFICULTY: All questions must be HARD.\n"
                    "- Level: Top university (e.g., MIT, Stanford, Harvard, Indian Institutes of Technology (IITs)).\n"
                    "- Extremely challenging, requiring deep conceptual understanding.\n"
                    "- Advanced synthesis, multi-topic integration, and creative problem-solving.\n"
                    "- Suitable for honors, Olympiad, or competitive exams at elite institutions.")
        
        explicit_count = f"\n\nIMPORTANT: You must generate exactly {num_mcq} multiple-choice questions and {num_short} short-answer questions." if num_mcq or num_short else ""
        
        return f"""Generate {num_mcq} multiple-choice questions and {num_short} short-answer questions based on the following text.

{subject_line}
Text:
---
{text}
---
{difficulty_line}
{explicit_count}

CRITICAL: You MUST respond in EXACTLY this format:

MCQ1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter A-D]
Explanation: [Brief explanation]

MCQ2: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter A-D]
Explanation: [Brief explanation]

[Continue for all MCQ questions]

Short Answer 1: [Question text]
Expected Answer: [Expected answer text]
Explanation: [Brief explanation]

Short Answer 2: [Question text]
Expected Answer: [Expected answer text]
Explanation: [Brief explanation]

[Continue for all short answer questions]

Requirements:
- Questions must be directly based on the provided text
- MCQ options should be plausible but only one correct
- Short answer questions should require thoughtful responses
- All questions should be clear and unambiguous"""

    def _call_gemini_api(self, prompt: str) -> str:
        """Call Google Gemini API"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.gemini_api_key)
            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise

    def _call_azure_openai_api(self, prompt: str) -> str:
        """Call Azure OpenAI API"""
        try:
            headers = {
                'Content-Type': 'application/json',
                'api-key': self.azure_openai_api_key
            }
            payload = {
                "messages": [
                    {"role": "system", "content": "You are an expert educational content creator that generates high-quality quiz questions."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 4000,
                "temperature": 0.7
            }
            
            logger.info(f"Calling Azure OpenAI with endpoint: {self.azure_openai_endpoint}")
            response = requests.post(self.azure_openai_endpoint, headers=headers, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()
            return result['choices'][0]['message']['content']
        except Exception as e:
            logger.error(f"Azure OpenAI API error: {e}")
            raise

    def _call_deepseek_api(self, prompt: str) -> str:
        """Call DeepSeek API"""
        try:
            client = OpenAI(
                api_key=self.deepseek_api_key,
                base_url="https://api.deepseek.com/v1"
            )
            
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "You are an expert educational content creator that generates high-quality quiz questions."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=4000,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            raise

    def _call_huggingface_api(self, prompt: str) -> str:
        """Call Hugging Face API with a more capable model"""
        try:
            # Use a more capable model for better results
            API_URL = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large"
            headers = {"Authorization": f"Bearer {self.hf_token}"}
            
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 1000,
                    "temperature": 0.7,
                    "return_full_text": False
                }
            }
            
            response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0].get('generated_text', '')
            return str(result)
        except Exception as e:
            logger.error(f"Hugging Face API error: {e}")
            return ""

    def _call_ollama(self, prompt: str, model: str = 'llama2') -> str:
        """Call local Ollama API"""
        try:
            url = 'http://localhost:11434/api/generate'
            data = {
                'model': model,
                'prompt': prompt,
                'stream': False
            }
            response = requests.post(url, json=data, timeout=120)
            response.raise_for_status()
            return response.json()['response']
        except Exception as e:
            logger.error(f"Ollama API error: {e}")
            raise

    def _generate_fallback_questions(self, text: str, num_mcq: int, num_short: int) -> Dict[str, List[Dict]]:
        """Generate simple fallback questions when APIs fail"""
        logger.info("Generating fallback questions")
        
        # Extract key phrases from text for context
        sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 10][:5]
        key_terms = list(set([word for word in text.split() if len(word) > 4 and word.isalpha()][:10]))
        
        mcq_questions = []
        short_questions = []
        
        # Generate MCQ questions
        for i in range(min(num_mcq, 5)):
            mcq_questions.append({
                "question": f"What is the main topic discussed in the text?",
                "options": [
                    "The primary subject matter",
                    "A secondary detail mentioned", 
                    "An unrelated concept",
                    "A technical term explained"
                ],
                "answer": "A",
                "explanation": "The question tests understanding of the main topic."
            })
        
        # Generate short answer questions  
        for i in range(min(num_short, 3)):
            short_questions.append({
                "question": f"Summarize the key points from the text in 2-3 sentences.",
                "answer": "The text discusses important concepts that should be summarized based on the content.",
                "explanation": "This question assesses comprehension and summarization skills."
            })
        
        return {
            "mcq_questions": mcq_questions[:num_mcq],
            "short_questions": short_questions[:num_short]
        }

    def generate_questions(self, text: str, num_mcq: int = 3, num_short: int = 2, subject: str = None, difficulty: str = None) -> Dict[str, List[Dict]]:
        """
        Generate questions from the provided text with multiple fallback options.
        """
        # Validate inputs
        if not text or len(text.strip()) < 30:
            logger.error("Text too short for question generation")
            return self._generate_fallback_questions(text, num_mcq, num_short)
        
        if num_mcq <= 0 and num_short <= 0:
            logger.error("No questions requested")
            return {"mcq_questions": [], "short_questions": []}
        
        prompt = self._create_prompt(text, num_mcq, num_short, subject=subject, difficulty=difficulty)
        
        # Define API priority order
        apis_to_try = []
        
        if self.azure_openai_api_key and self.azure_openai_endpoint:
            apis_to_try.append(('azure_openai', self._call_azure_openai_api))
        
        if self.deepseek_api_key:
            apis_to_try.append(('deepseek', self._call_deepseek_api))
        
        if self.gemini_api_key:
            apis_to_try.append(('gemini', self._call_gemini_api))
        
        # Check for Ollama
        try:
            response = requests.get('http://localhost:11434/api/tags', timeout=5)
            if response.status_code == 200:
                apis_to_try.append(('ollama', lambda p: self._call_ollama(p, 'llama2')))
        except:
            pass
        
        if self.hf_token:
            apis_to_try.append(('huggingface', self._call_huggingface_api))
        
        logger.info(f"Trying APIs in order: {[api[0] for api in apis_to_try]}")
        
        # Try each API
        for api_name, api_func in apis_to_try:
            try:
                logger.info(f"Attempting question generation with {api_name}")
                response = api_func(prompt)
                
                if response and response.strip():
                    questions = self._parse_response(response)
                    
                    # Validate we got the requested number of questions
                    actual_mcq = len(questions.get("mcq_questions", []))
                    actual_short = len(questions.get("short_questions", []))
                    
                    logger.info(f"{api_name} generated {actual_mcq} MCQ and {actual_short} short answer questions")
                    
                    # If we got some questions, use them (even if not all requested)
                    if actual_mcq > 0 or actual_short > 0:
                        # Fill missing questions with fallbacks if needed
                        if actual_mcq < num_mcq or actual_short < num_short:
                            fallback = self._generate_fallback_questions(text, 
                                                                        max(0, num_mcq - actual_mcq), 
                                                                        max(0, num_short - actual_short))
                            questions["mcq_questions"].extend(fallback["mcq_questions"])
                            questions["short_questions"].extend(fallback["short_questions"])
                        
                        return questions
                        
            except Exception as e:
                logger.warning(f"{api_name} API failed: {str(e)}")
                continue
        
        # All APIs failed, use fallback
        logger.info("All APIs failed, using fallback questions")
        return self._generate_fallback_questions(text, num_mcq, num_short)

    def _parse_response(self, response: str) -> Dict[str, List[Dict]]:
        """
        Parse the API response into structured question format.
        """
        questions = {
            "mcq_questions": [],
            "short_questions": []
        }
        
        lines = response.split('\n')
        i = 0
        current_section = None
        
        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                i += 1
                continue
                
            # Detect MCQ questions
            if line.lower().startswith('mcq') or 'multiple' in line.lower() or any(line.startswith(f'Q{j+1}:') for j in range(10)):
                current_section = 'mcq'
                question_text = line.split(':', 1)[1].strip() if ':' in line else line
                mcq_data = self._parse_mcq_question(lines, i)
                if mcq_data:
                    questions["mcq_questions"].append(mcq_data)
                    i = mcq_data.get('_next_index', i + 1)
                else:
                    i += 1
                    
            # Detect short answer questions
            elif line.lower().startswith('short') or 'short answer' in line.lower():
                current_section = 'short'
                short_data = self._parse_short_question(lines, i)
                if short_data:
                    questions["short_questions"].append(short_data)
                    i = short_data.get('_next_index', i + 1)
                else:
                    i += 1
            else:
                i += 1
        
        # Clean up temporary fields
        for mcq in questions["mcq_questions"]:
            mcq.pop('_next_index', None)
        for short in questions["short_questions"]:
            short.pop('_next_index', None)
            
        return questions

    def _parse_mcq_question(self, lines: List[str], start_index: int) -> Optional[Dict]:
        """Parse a single MCQ question from lines"""
        try:
            question_data = {
                "question": "",
                "options": [],
                "answer": "",
                "explanation": ""
            }
            
            i = start_index
            current_line = lines[i].strip()
            
            # Extract question text
            if ':' in current_line:
                question_data["question"] = current_line.split(':', 1)[1].strip()
            else:
                question_data["question"] = current_line
            
            i += 1
            
            # Parse options A-D
            options_found = 0
            while i < len(lines) and options_found < 4:
                line = lines[i].strip()
                if line.startswith(('A)', 'A.')) and len(line) > 2:
                    question_data["options"].append(line[2:].strip())
                    options_found += 1
                elif line.startswith(('B)', 'B.')) and len(line) > 2:
                    question_data["options"].append(line[2:].strip())
                    options_found += 1
                elif line.startswith(('C)', 'C.')) and len(line) > 2:
                    question_data["options"].append(line[2:].strip())
                    options_found += 1
                elif line.startswith(('D)', 'D.')) and len(line) > 2:
                    question_data["options"].append(line[2:].strip())
                    options_found += 1
                i += 1
            
            # Parse correct answer and explanation
            while i < len(lines):
                line = lines[i].strip()
                if line.lower().startswith('correct answer:'):
                    question_data["answer"] = line.split(':', 1)[1].strip().upper()[0]  # Get first letter
                elif line.lower().startswith('explanation:'):
                    question_data["explanation"] = line.split(':', 1)[1].strip()
                elif line and not line.startswith(('MCQ', 'Short')):  # Stop at next question
                    break
                i += 1
            
            question_data['_next_index'] = i
            
            # Validate we have minimum required data
            if (question_data["question"] and len(question_data["options"]) >= 2 and 
                question_data["answer"] in ['A', 'B', 'C', 'D']):
                return question_data
            return None
            
        except Exception as e:
            logger.error(f"Error parsing MCQ question: {e}")
            return None

    def _parse_short_question(self, lines: List[str], start_index: int) -> Optional[Dict]:
        """Parse a single short answer question from lines"""
        try:
            question_data = {
                "question": "",
                "answer": "",
                "explanation": ""
            }
            
            i = start_index
            current_line = lines[i].strip()
            
            # Extract question text
            if ':' in current_line:
                question_data["question"] = current_line.split(':', 1)[1].strip()
            else:
                question_data["question"] = current_line
            
            i += 1
            
            # Parse expected answer and explanation
            while i < len(lines):
                line = lines[i].strip()
                if line.lower().startswith('expected answer:'):
                    question_data["answer"] = line.split(':', 1)[1].strip()
                elif line.lower().startswith('explanation:'):
                    question_data["explanation"] = line.split(':', 1)[1].strip()
                elif line and not line.startswith(('MCQ', 'Short')):  # Stop at next question
                    break
                i += 1
            
            question_data['_next_index'] = i
            
            # Validate we have minimum required data
            if question_data["question"] and question_data["answer"]:
                return question_data
            return None
            
        except Exception as e:
            logger.error(f"Error parsing short answer question: {e}")
            return None

# Global instance for backward compatibility
question_generator = QuestionGenerator()

def generate_questions_from_text(text: str, num_mcq: int = 3, num_short: int = 2, subject: str = None, difficulty: str = None) -> Dict[str, List[Dict]]:
    """
    Generate questions from text using the QuestionGenerator instance.
    """
    return question_generator.generate_questions(text, num_mcq, num_short, subject=subject, difficulty=difficulty)