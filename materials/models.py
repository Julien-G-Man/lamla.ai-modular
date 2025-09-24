# materials/models.py
from django.db import models
from django.contrib.auth.models import User
from core.models import BaseModel

class ExamDocument(BaseModel):
    """Model to store uploaded exam files."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exam_documents')
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=100)
    document_file = models.FileField(upload_to='exam_documents/')
    extracted_text = models.TextField(blank=True, help_text="Extracted text content from the file.")
    
    def __str__(self):
        return f"{self.title} ({self.user.username})"