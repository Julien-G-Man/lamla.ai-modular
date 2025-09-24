# materials/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_slides, name='upload_slides'),
    path('ajax-extract-text/', views.ajax_extract_text, name='ajax_extract_text'),
]