import re
from datetime import datetime
from zoneinfo import ZoneInfo
from io import BytesIO
import textwrap
from django.http import HttpResponse

# --- Conditional imports for external libraries (Ensure these are installed) ---
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
except ImportError:
    reportlab_available = False
else:
    reportlab_available = True

try:
    from docx import Document
except ImportError:
    docx_available = False
else:
    docx_available = True

# ---------------------- Utility Functions (Move these) ----------------------

def _safe_filename(name: str, max_len: int = 180) -> str:
    """Make a string safe for use as a filename."""
    # ... (content remains the same) ...
    if not name:
        return "Quiz_Results"
    s = str(name).strip()
    s = re.sub(r'\s+', '_', s)
    s = re.sub(r'[\\/:"*?<>|]+', '_', s)
    return s[:max_len] or "Quiz_Results"

def _latex_to_plain(s: str) -> str:
    """Convert LaTeX-style math to natural human-readable text."""
    # ... (content remains the same) ...
    if not s:
        return s
    out = str(s)
    
    # Remove LaTeX math delimiters
    out = re.sub(r'\\\((.*?)\\\)', r'\1', out)
    out = re.sub(r'\\\[(.*?)\\\]', r'\1', out)
    out = re.sub(r'\$\$(.*?)\$\$', r'\1', out, flags=re.S)

    # Fractions → (num)/(den)
    def _frac_repl(m):
        return f"({m.group(1).strip()})/({m.group(2).strip()})"
    out = re.sub(r'\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}', _frac_repl, out)

    # --- Recursive sqrt handling with superscript nth roots ---
    def _process_sqrt(m):
        index = m.group(1)
        inner = m.group(2).strip()

        while re.search(r'\\sqrt(\[[0-9]+\])?\{([^{}]+)\}', inner):
            inner = re.sub(r'\\sqrt(\[[0-9]+\])?\{([^{}]+)\}', _process_sqrt, inner)

        inner = re.sub(r'\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}',
                        lambda x: f"({x.group(1).strip()})/({x.group(2).strip()})",
                        inner)

        superscripts = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")

        if index:
            n = index.strip("[]")
            n_sup = n.translate(superscripts)
            return f"{n_sup}√{{{inner}}}"
        return f"√{{{inner}}}"

    out = re.sub(r'\\sqrt(\[[0-9]+\])?\{([^{}]+)\}', _process_sqrt, out)

    # Superscripts & subscripts
    out = re.sub(r'\^\{([^}]+)\}', lambda m: '^(' + m.group(1) + ')', out)
    out = re.sub(r'\^([A-Za-z0-9])', r'^\(\1\)', out)
    out = re.sub(r'_\{([^}]+)\}', lambda m: '_(' + m.group(1) + ')', out)
    out = re.sub(r'_([A-Za-z0-9])', r'_(\1)', out)

    # Common replacements
    replacements = {
        r'\\times': '×', r'\\cdot': '·', r'\\left': '', r'\\right': '',
        r'\\,': ' ', r'\\;': ' ', r'\\!': '', r'\\ ': ' ', r'\\newline': '\n',
    }
    for k, v in replacements.items():
        out = out.replace(k, v)

    # Remove backslashes before words
    out = re.sub(r'\\([A-Za-z]+)', r'\1', out)

    # Clean up spaces/newlines
    out = re.sub(r'\s+\n', '\n', out)
    out = re.sub(r'\n\s+', '\n', out)
    out = re.sub(r'[ \t]{2,}', ' ', out)

    return out.strip()


# ---------------------- Main Download Function ----------------------

def handle_quiz_download(request):
    """
    Handles the core logic for generating and returning the quiz file.
    This replaces the body of the original download_quiz_text function.
    """
    quiz_questions = request.session.get('quiz_questions', {})
    uploaded_file_name = request.session.get('uploaded_file_name', '')
    
    if not quiz_questions:
        return HttpResponse('No quiz data found for download.', content_type='text/plain')

    subject = quiz_questions.get('subject', 'Quiz')
    safe_source = _safe_filename(uploaded_file_name or subject)
    
    try:
        tz = ZoneInfo('Africa/Accra')
    except Exception:
        tz = None

    now = datetime.now(tz) if tz else datetime.now()
    ts = now.strftime('%Y%m%d_%H%M%S')
    filename_base = f"{safe_source}_Lamla.ai_Quiz_{ts}"

    # --- Build the quiz content header and lines list ---
    lines = [
        'Lamla AI - Quiz',
        '-------------------------',
        f"Subject: {subject}",
        f"Source File: {uploaded_file_name or 'N/A'}",
        f"Generated: {now.strftime('%Y-%m-%d %H:%M:%S %Z') if tz else now.strftime('%Y-%m-%d %H:%M:%S')}",
        ''
    ]

    # ... (MCQ and Short Answer line building logic remains the same) ...
    # --- Build Multiple Choice section ---
    mcq = quiz_questions.get('mcq_questions', [])
    if mcq:
        lines.append('Multiple Choice Questions:')
        for idx, q in enumerate(mcq, start=1):
            qtext = _latex_to_plain(q.get('question', ''))
            lines.append(f"Question {idx}: {qtext}")
            for opt_idx, opt in enumerate(q.get('options', [])):
                letter = chr(65 + opt_idx)
                lines.append(f"   {letter}. {_latex_to_plain(opt)}")
            correct_ans = q.get('answer', '')
            lines.append(f"   Correct answer: {correct_ans}")
            lines.append('')

    # --- Build Short Answer section ---
    short = quiz_questions.get('short_questions', [])
    if short:
        lines.append('Short Answer Questions:')
        for idx, q in enumerate(short, start=1):
            lines.append(f"Q{idx}: {_latex_to_plain(q.get('question', ''))}")
            ans = q.get('answer', '')
            if ans:
                lines.append(f"   Model answer: {_latex_to_plain(ans)}")
            lines.append('')

    text_content = '\n'.join(lines)
    file_format = request.GET.get('format', 'txt').lower()

    # --- Output Formats ---
    if file_format == 'pdf' and reportlab_available:
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        y = height - 40
        for raw_line in lines:
            line_to_wrap = _latex_to_plain(raw_line)
            for wline in textwrap.wrap(line_to_wrap, width=95):
                p.drawString(40, y, wline)
                y -= 16
                if y < 40:
                    p.showPage()
                    y = height - 40
        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')

    elif file_format == 'docx' and docx_available:
        buffer = BytesIO()
        doc = Document()
        for raw_line in lines:
            doc.add_paragraph(_latex_to_plain(raw_line)) 
        doc.save(buffer)
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')

    else:  # TXT
        response = HttpResponse(text_content, content_type='text/plain')

    response['Content-Disposition'] = f'attachment; filename="{filename_base}.{file_format}"'
    return response