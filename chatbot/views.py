from django.shortcuts import render

# Create your views here.
# chatbot/views.py
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
import json
import logging

logger = logging.getLogger(__name__)

def chatbot(request):
    """ Renders chat page """
    return render(request, 'ai/chat.html')

def test_chatbot(request):
    """
    Renders the test chatbot page.
    """
    return render(request, 'chatbot/test_chatbot.html')

@csrf_exempt
@require_http_methods(["POST"])
def chatbot_api(request):
    """
    Handles chatbot interactions via an API endpoint.
    This logic would be a part of the chatbot service.
    """
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')
        
        # Placeholder for the actual chatbot service call
        # from .services import ChatbotService
        # response_message = ChatbotService.get_response(user_message, request.user)
        
        # Simple placeholder for now
        response_message = f"Echo: {user_message}"
        
        return JsonResponse({"response": response_message})
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)