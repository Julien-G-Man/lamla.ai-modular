# core/views.py
from django.shortcuts import render
from django.views.decorators.cache import cache_page
from django.http import HttpResponse

@cache_page(60 * 15)
def home(request):
    """Renders the home page."""
    return render(request, 'core/home.html')

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