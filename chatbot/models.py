# chatbot/models.py
from django.db import models
from django.contrib.auth.models import User
from core.models import BaseModel
from django.contrib.auth.models import User

MESSAGE_TYPES = (
    ('user', 'User Message'),
    ('ai', 'AI Message'),
)

class ChatbotKnowledge(BaseModel):
    """
    Model to store knowledge base for the chatbot about Lamla AI.
    """
    category = models.CharField(max_length=50, help_text="Category of information (e.g., 'features', 'pricing', 'how_to')")
    question = models.CharField(max_length=200, help_text="Common question or topic")
    answer = models.TextField(help_text="Detailed answer about Lamla AI")
    keywords = models.TextField(blank=True, help_text="Comma-separated keywords for matching")
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.question[:50]

class ChatMessage(BaseModel):
    """
    Model to store chatbot messages.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    session_id = models.CharField(max_length=100, help_text="Session identifier for anonymous users")
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES)
    content = models.TextField()
    
    class Meta:
        ordering = ['created_at']
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
    
    def __str__(self):
        return f"{self.message_type} - {self.content[:50]}..."