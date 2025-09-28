# chatbot/views.py
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, StreamingHttpResponse
import json
import logging
import uuid

from .chatbot_service import chatbot_service
from .models import ChatMessage

logger = logging.getLogger(__name__)

def chatbot(request):
    """ Renders chat page """
    return render(request, 'ai/chat.html')

def test_chatbot(request):
    """ Renders the test chatbot page """
    return render(request, 'chabot/test_chatbot.html')

@csrf_exempt
@require_http_methods(["POST"])
def chatbot_api(request):
    """ Handles chatbot interactions via an API endpoint """
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')

        # Determine session (for anonymous users)
        if request.user.is_authenticated:
            user = request.user
            session_id = None
        else:
            user = None
            session_id = request.session.session_key or str(uuid.uuid4())
            if not request.session.session_key:
                request.session['session_id'] = session_id

        # Save user message
        user_msg = ChatMessage.objects.create(
            user=user,
            session_id=session_id,
            message_type="user",
            content=user_message
        )

        # Get last N messages for context
        if user:
            history = ChatMessage.objects.filter(user=user).order_by('-created_at')[:6]
        else:
            history = ChatMessage.objects.filter(session_id=session_id).order_by('-created_at')[:6]

        # Reformat history for service
        conversation_history = [
            {"message_type": msg.message_type, "content": msg.content}
            for msg in reversed(history)  # reverse to chronological order
        ]

        # Get AI response
        response_message = chatbot_service.generate_response(
            user_message, conversation_history=conversation_history
        )

        # Save AI message
        ChatMessage.objects.create(
            user=user,
            session_id=session_id,
            message_type="ai",
            content=response_message
        )

        return JsonResponse({"response": response_message})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Chatbot API error: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def chatbot_stream(request):
    """ Handles chatbot interactions via a streaming endpoint """
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')

        # Determine session
        if request.user.is_authenticated:
            user = request.user
            session_id = None
        else:
            user = None
            session_id = request.session.session_key or str(uuid.uuid4())
            if not request.session.session_key:
                request.session['session_id'] = session_id

        # Save user message
        ChatMessage.objects.create(
            user=user,
            session_id=session_id,
            message_type="user",
            content=user_message
        )

        # Get last N messages
        if user:
            history = ChatMessage.objects.filter(user=user).order_by('-created_at')[:6]
        else:
            history = ChatMessage.objects.filter(session_id=session_id).order_by('-created_at')[:6]

        conversation_history = [
            {"message_type": msg.message_type, "content": msg.content}
            for msg in reversed(history)
        ]

        # Generate AI response
        full_response = chatbot_service.generate_response(
            user_message, conversation_history=conversation_history
        )

        # Save AI message
        ChatMessage.objects.create(
            user=user,
            session_id=session_id,
            message_type="ai",
            content=full_response
        )

        # Stream chunks of response
        def stream_response():
            for i in range(0, len(full_response), 10):  # send in chunks of 10 chars
                yield full_response[i:i+10]
        
        return StreamingHttpResponse(stream_response(), content_type="text/plain")

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Chatbot Stream API error: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)