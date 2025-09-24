# feedback/models.py
from django.db import models
from core.models import BaseModel
from django.core.validators import EmailValidator

class Contact(BaseModel):
    """Model to store contact form submissions."""
    name = models.CharField(max_length=100)
    email = models.EmailField(validators=[EmailValidator()])
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()

    def __str__(self):
        return f"Contact from {self.name} ({self.email})"

class Feedback(BaseModel):
    """Model to store user feedback."""
    email = models.EmailField(validators=[EmailValidator()], blank=True, null=True)
    feedback_text = models.TextField()
    is_resolved = models.BooleanField(default=False)

    def __str__(self):
        return f"Feedback from {self.email or 'Anonymous'}"

class Subscription(BaseModel):
    """Model to store newsletter subscriptions."""
    email = models.EmailField(unique=True, validators=[EmailValidator()])
    subscribed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email