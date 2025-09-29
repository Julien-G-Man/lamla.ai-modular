from datetime import datetime, timezone
import json
import uuid
from django.http import HttpResponse 
import json


# --- CONSTANTS ---
CONSENT_COOKIE_NAME = 'user_consent'
CONSENT_ACCEPTED_VALUE = 'accepted'

def has_consent(request) -> bool:
    """Checks if the user has accepted non-essential cookies."""
    # Note: Only 'Strictly Necessary' cookies (like sessionid) are exempt from this check.
    return request.COOKIES.get(CONSENT_COOKIE_NAME) == CONSENT_ACCEPTED_VALUE

def set_consent_cookie(response: HttpResponse) -> HttpResponse:
    """Sets the primary consent cookie after user accepts (Server-Side)."""
    response.set_cookie(
        key=CONSENT_COOKIE_NAME,
        value=CONSENT_ACCEPTED_VALUE,
        max_age=3600 * 24 * 365, # 1 Year expiration for consent
        httponly=True,           # Prevent client-side JS access 
        samesite='Lax'
    )
    return response

# ===============================================
# CORE APP COOKIE: Last Visit Timestamp
# ===============================================

def set_last_visit_cookie(request, response: HttpResponse) -> HttpResponse:
    """Sets a cookie tracking the current time for the user's last visit only if the user has consented"""
    if has_consent(request):
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

# QUIZ APP COOKIE: Preference for number of MCQ questions
def set_quiz_preference_cookie(request, response: HttpResponse, key: str, value: str) -> HttpResponse:
    """Stores a quiz preference only if user has consented."""
    if has_consent(request):
        response.set_cookie(key, value, max_age=3600 * 24 * 30, samesite='Lax')
    return response

def get_quiz_preference_cookie(request, key: str, default: str | int) -> str | int:
    """Reads a quiz preference cookie."""
    return request.COOKIES.get(key, str(default))
 
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
    """Reads the chat session ID or creates a new one if none exists, only setting the persistent cookie if consent is given."""
    session_id = request.COOKIES.get('chat_session_id')
    
    if not session_id:
        session_id = str(uuid.uuid4())
        is_new = True
    else:
        is_new = False

    # The persistent cookie is only set/renewed IF consent is given
    if has_consent(request): 
        # We set it if new, or renew the expiration if existing
        response.set_cookie(
            key='chat_session_id', 
            value=session_id, 
            max_age=3600 * 24 * 7, # 7 days
            httponly=True, # Prevent client-side JS access for security
            samesite='Lax'
        )
     # NOTE: If consent is not given, the session_id will ONLY exist for the
     # duration of the browser tab/session (not persisted across restarts)  
        
    return session_id, response
 
def set_quiz_preference_cookie(response, key, value):
    response.set_cookie(key, value, max_age=3600*24*30, samesite='Lax') # 30 days
    return response

def get_quiz_preference_cookie(request, key, default):
    return request.COOKIES.get(key, default) 