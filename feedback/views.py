# feedback/views.py
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .models import Contact, Feedback, Subscription
from django.contrib import messages
import logging
import json

logger = logging.getLogger(__name__)

def contact(request):
    """
    Renders the contact form page and handles form submissions.
    """
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()
        subject = request.POST.get('subject', '').strip()
        message = request.POST.get('message', '').strip()
        
        errors = []
        if not name:
            errors.append('Name is required.')
        if not email:
            errors.append('Email is required.')
        else:
            try:
                validate_email(email)
            except ValidationError:
                errors.append('Please enter a valid email address.')
        if not message:
            errors.append('Message is required.')
            
        if errors:
            return render(request, 'feedback/contact.html', {'errors': errors})
        
        try:
            Contact.objects.create(name=name, email=email, subject=subject, message=message)
            messages.success(request, 'Your message has been sent successfully!')
            return redirect('contact')
        except Exception as e:
            logger.error(f"Failed to save contact form submission: {e}")
            messages.error(request, 'An error occurred. Please try again later.')
            return render(request, 'feedback/contact.html')
            
    return render(request, 'feedback/contact.html')

@require_POST
def submit_feedback(request):
    """
    Handles AJAX feedback submissions.
    """
    try:
        data = json.loads(request.body)
        email = data.get('email', '')
        feedback_text = data.get('feedback_text', '')
        
        if not feedback_text:
            return JsonResponse({'status': 'error', 'message': 'Feedback text is required.'}, status=400)
        
        try:
            if email: validate_email(email)
        except ValidationError:
            return JsonResponse({'status': 'error', 'message': 'Please provide a valid email.'}, status=400)
            
        Feedback.objects.create(email=email or None, feedback_text=feedback_text)
        return JsonResponse({'status': 'ok', 'message': 'Feedback submitted successfully!'})
    except Exception as e:
        logger.error(f"Feedback submission error: {e}")
        return JsonResponse({'status': 'error', 'message': 'An unexpected error occurred.'}, status=500)

@require_POST
def subscribe_newsletter(request):
    """
    Handles newsletter subscription via AJAX.
    """
    try:
        data = json.loads(request.body)
        email = data.get('email', '')
        
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({'status': 'error', 'message': 'Please provide a valid email.'}, status=400)
        
        if Subscription.objects.filter(email=email).exists():
            return JsonResponse({'status': 'info', 'message': 'You are already subscribed!'})
            
        Subscription.objects.create(email=email)
        return JsonResponse({'status': 'ok', 'message': 'You have subscribed to our newsletter!'})
    except Exception as e:
        logger.error(f"Newsletter subscription error: {e}")
        return JsonResponse({'status': 'error', 'message': 'An unexpected error occurred.'}, status=500)