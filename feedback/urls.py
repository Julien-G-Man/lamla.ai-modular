# feedback/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('contact/', views.contact, name='contact'),
    path('submit-feedback/', views.submit_feedback, name='submit_feedback'),
    path('subscribe-newsletter/', views.subscribe_newsletter, name='subscribe_newsletter'),
]