# quiz/views.py
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import JsonResponse
import json
import logging
from .services import QuizService
from .models import QuizSession
from django.contrib.auth.decorators import login_required

logger = logging.getLogger(__name__)

def custom_quiz(request):
    """
    Renders the page for creating a custom quiz.
    """
    return render(request, 'quiz/custom_quiz.html')

def generate_questions(request):
    """
    Generates questions from a user-provided text.
    """
    if request.method == 'POST':
        study_text = request.POST.get('extractedText', '').strip()
        num_mcq = int(request.POST.get('num_mcq', 5))
        num_short = int(request.POST.get('num_short', 0))
        subject = request.POST.get('subject', '')
        difficulty = request.POST.get('difficulty', 'any')
        uploaded_file_name = request.POST.get('uploaded_file_name', '')

        try:
            quiz_results = QuizService.generate_quiz(study_text, num_mcq, num_short, subject, difficulty)
            
            request.session['quiz_questions'] = quiz_results
            request.session['quiz_time'] = int(request.POST.get('quiz_time', 10))
            request.session['uploaded_file_name'] = uploaded_file_name
            
            return redirect('quiz')
        except ValueError as e:
            messages.error(request, str(e))
            return render(request, 'quiz/custom_quiz.html', {'error_message': str(e)})
        except Exception as e:
            messages.error(request, 'Quiz generation failed. Please try again later.')
            logger.error(f"Quiz generation error: {e}")
            return render(request, 'quiz/custom_quiz.html', {'error_message': 'Quiz generation failed.'})
            
    return render(request, 'quiz/custom_quiz.html')

def quiz(request):
    """
    Renders the quiz page with questions from the session.
    """
    quiz_questions = request.session.get('quiz_questions', {})
    quiz_time = request.session.get('quiz_time', 10)
    
    if not quiz_questions.get('mcq_questions') and not quiz_questions.get('short_questions'):
        messages.error(request, 'No quiz has been generated. Please create a quiz first.')
        return redirect('custom_quiz')
        
    return render(request, 'quiz/quiz.html', {
        'questions': quiz_questions,
        'quiz_time': quiz_time,
    })

def quiz_results(request):
    """
    Handles quiz submission, grading, and displays results.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            user_answers = data.get('user_answers', {})
            quiz_questions = request.session.get('quiz_questions', {})
            mcq = quiz_questions.get('mcq_questions', [])
            short = quiz_questions.get('short_questions', [])
            all_questions = mcq + short
            results = {
                'total': len(all_questions),
                'correct': 0,
                'details': []
            }

            for idx, q in enumerate(mcq):
                user_ans = user_answers.get(str(idx), '').strip().upper()
                correct_ans = q.get('answer', '').strip().upper()
                is_correct = user_ans == correct_ans
                results['details'].append({
                    'question': q.get('question'),
                    'user_answer': user_ans,
                    'correct_answer': correct_ans,
                    'is_correct': is_correct
                })
                if is_correct:
                    results['correct'] += 1

            for idx, q in enumerate(short):
                user_ans = user_answers.get(str(len(mcq) + idx), '')
                expected_ans = q.get('answer', '')
                is_correct = QuizService.grade_short_answer(q.get('question'), expected_ans, user_ans)
                results['details'].append({
                    'question': q.get('question'),
                    'user_answer': user_ans,
                    'correct_answer': expected_ans,
                    'is_correct': is_correct
                })
                if is_correct:
                    results['correct'] += 1
            
            request.session['quiz_results'] = results
            
            if request.user.is_authenticated:
                QuizSession.objects.create(
                    user=request.user,
                    subject=quiz_questions.get('subject', ''),
                    total_questions=results['total'],
                    correct_answers=results['correct'],
                    score_percentage=(results['correct'] / results['total'] * 100) if results['total'] else 0,
                    questions_data=quiz_questions,
                    user_answers=user_answers
                )
            
            return JsonResponse({'status': 'ok'})
        except Exception as e:
            logger.error(f"Quiz results error: {e}")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    else:
        results = request.session.get('quiz_results')
        quiz_questions = request.session.get('quiz_questions', {})
        user_answers = request.session.get('quiz_user_answers', {})
        uploaded_file_name = request.session.get('uploaded_file_name', '')
        
        context = {
            'score': results.get('correct', 0),
            'total': results.get('total', 0),
            'score_percent': (results.get('correct', 0) / results.get('total', 0) * 100) if results and results.get('total') else 0,
            'mcq_questions': quiz_questions.get('mcq_questions', []),
            'short_questions': quiz_questions.get('short_questions', []),
            'user_answers': user_answers,
            'results': results,
            'uploaded_file_name': uploaded_file_name,
        }
        return render(request, 'quiz/quiz_results.html', context)
        
def flashcards(request):
    """
    Renders the flashcards page.
    """
    return render(request, 'quiz/flashcards.html')

def generate_flashcards(request):
   return render(request, 'quiz/flashcards.html')

def test_flashcard_generator(request):
    """
    Renders the test page for flashcards.
    """
    return render(request, 'quiz/test_flashcard_generator.html')