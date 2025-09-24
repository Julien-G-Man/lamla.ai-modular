# analytics/models.py
from django.db import models
from django.contrib.auth.models import User
from core.models import BaseModel
from materials.models import ExamDocument

class ExamAnalysis(BaseModel):
    """Model to store exam analysis results"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exam_analyses')
    subject = models.CharField(max_length=100, help_text="Subject being analyzed", db_index=True)
    documents_analyzed = models.ManyToManyField(ExamDocument, related_name='analyses')
    analysis_data = models.JSONField(default=dict, help_text="Analysis results including trends and predictions")
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Exam Analysis"
        verbose_name_plural = "Exam Analyses"
        
    def __str__(self):
        return f"Analysis for {self.subject} by {self.user.username}"