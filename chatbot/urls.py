# chatbot/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('chatbot/', views.chatbot, name='chatbot'),
    path('chatbot/stream/', views.chatbot_stream, name='chatbot_stream'),
    path('test/', views.test_chatbot, name='test_chatbot'),
    path('api/', views.chatbot_api, name='chatbot_api'),
]