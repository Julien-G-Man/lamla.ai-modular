# quiz/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('custom/', views.custom_quiz, name='custom_quiz'),
    path('ajax/extract-text/', views.ajax_extract_text, name='ajax_extract_text'),
    path('generate-questions/', views.generate_questions, name='generate_questions'),
    path('quiz/', views.quiz, name='quiz'),
    path('quiz/results/', views.quiz_results, name='quiz_results'),
    path('quiz/results/download_quiz_text', views.download_quiz_text, name="download_quiz_text"),
    
    path('flashcards/', views.flashcards, name='flashcards'),
    path('generate-flashcards/', views.generate_flashcards, name='generate_flashcards'),
    path('test-flashcard-generator/', views.test_flashcard_generator, name='test_flashcard_generator'),
    
    path('exam-analyzer/', views.exam_analyzer, name='exam_analyzer'),
]