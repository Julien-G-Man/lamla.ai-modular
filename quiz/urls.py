# quiz/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('custom/', views.custom_quiz, name='custom_quiz'),
    path('generate-questions/', views.generate_questions, name='generate_questions'),
    path('quiz/', views.quiz, name='quiz'),
    path('results/', views.quiz_results, name='quiz_results'),
    path('flashcards/', views.flashcards, name='flashcards'),
    path('generate-flashcards/', views.generate_flashcards, name='generate_flashcards'),
    path('test-flashcard-generator/', views.test_flashcard_generator, name='test_flashcard_generator'),
]