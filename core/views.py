# core/views.py
from django.shortcuts import render
from django.views.decorators.cache import cache_page
from django.http import HttpResponse
from .cookies import get_last_visit_time, set_last_visit_cookie

@cache_page(60 * 15)
def home(request):
    # Get the necessary cookie data
    last_visit = get_last_visit_time(request)
    
    context = {}
    if last_visit:
        context['welcome_message'] = f"Welcome back! Your last visit was on {last_visit}."
    else:
        context['welcome_message'] = "Welcome to the site! First time visitor."

    # 1. Render the response first
    response = render(request, 'core/home.html', context)
    
    # 2. Pass the response to the utility function to set the cookie
    response = set_last_visit_cookie(response)

    return response

def about(request):
    """Renders the about page."""
    return render(request, 'core/about.html')
    
def privacy_policy(request):
    """Renders the privacy policy page."""
    return render(request, 'core/privacy_policy.html')

def terms_of_service(request):
    """Renders the terms of service page."""
    return render(request, 'core/terms_of_service.html')

def cookie_policy(request):
    """Renders the cookie policy page."""
    return render(request, 'core/cookie_policy.html')
    
def test_token(request):
    """Renders the test token page."""
    return HttpResponse('test_token stub')