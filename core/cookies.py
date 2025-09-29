from datetime import datetime, timezone
import json
import uuid
from django.http import HttpResponse # Required for type hinting/reference
import json

# ===============================================
# CORE APP COOKIE: Last Visit Timestamp
# ===============================================

def set_last_visit_cookie(response: HttpResponse) -> HttpResponse:
    """Sets a cookie tracking the current time for the user's last visit."""
    current_time = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S %Z')
    
    response.set_cookie(
        key='last_visit_time', 
        value=current_time, 
        max_age=3600 * 24 * 365, # 1 Year
        httponly=False, 
        samesite='Lax'
    )
    return response

def get_last_visit_time(request) -> str | None:
    """Reads the last visit cookie from the request."""
    return request.COOKIES.get('last_visit_time', None)

# ===============================================
# QUIZ APP COOKIE: Temporary Score Summary
# ===============================================

def set_quiz_summary_cookie(response: HttpResponse, score: int, quiz_id: str) -> HttpResponse:
    """Stores the quiz results temporarily in a cookie (expires in 10 minutes)."""
    quiz_summary = {
        'score': score,
        'quiz_id': quiz_id,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    
    response.set_cookie(
        key='last_quiz_summary', 
        value=json.dumps(quiz_summary),
        max_age=600, # 10 minutes
        httponly=False 
    )
    return response

def get_and_delete_quiz_summary(request, response: HttpResponse) -> dict | None:
    """Reads the quiz summary cookie and deletes it from the response."""
    quiz_summary_json = request.COOKIES.get('last_quiz_summary')
    
    # Always delete the cookie after reading, as it's one-time data
    response.delete_cookie('last_quiz_summary')
    
    if quiz_summary_json:
        try:
            return json.loads(quiz_summary_json)
        except json.JSONDecodeError:
            return None
    return None

# ===============================================
# CHATBOT APP COOKIE: Anonymous Session ID
# ===============================================

def get_or_create_chat_session(request, response: HttpResponse) -> tuple[str, HttpResponse]:
    """Reads the chat session ID or creates a new one if none exists."""
    session_id = request.COOKIES.get('chat_session_id')
    
    if not session_id:
        session_id = str(uuid.uuid4())
        is_new = True
    else:
        is_new = False

    # If new, set the cookie; if old, renew the expiration (optional, but good practice)
    if is_new or True: # Use 'or True' to renew the cookie on every visit
        response.set_cookie(
            key='chat_session_id', 
            value=session_id, 
            max_age=3600 * 24 * 7, # 7 days
            httponly=True, # Prevent client-side JS access for security
            samesite='Lax'
        )
        
    return session_id, response
 
def set_quiz_preference_cookie(response, key, value):
    response.set_cookie(key, value, max_age=3600*24*30, samesite='Lax') # 30 days
    return response

def get_quiz_preference_cookie(request, key, default):
    return request.COOKIES.get(key, default) 