# quiz/models.py
from django.db import models
from django.contrib.auth.models import User
from core.models import BaseModel

class QuizSession(BaseModel):
    """Model to track quiz sessions and results"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_sessions')
    subject = models.CharField(max_length=100, blank=True, help_text="Subject/topic of the quiz", db_index=True)
    total_questions = models.IntegerField(default=0)
    correct_answers = models.IntegerField(default=0)
    score_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    duration_minutes = models.IntegerField(default=0, help_text="Time taken in minutes")
    questions_data = models.JSONField(default=dict, help_text="Stored quiz questions and answers")
    user_answers = models.JSONField(default=dict, help_text="User's answers")
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Quiz Session"
        verbose_name_plural = "Quiz Sessions"
    
    def __str__(self):
        return f"{self.user.username} - {self.subject} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
    
    @property
    def score_display(self):
        return f"{self.correct_answers}/{self.total_questions} ({self.score_percentage}%)"