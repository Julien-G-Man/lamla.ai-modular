# accounts/urls.py
from django.urls import path
from . import views
from .views import CustomLoginView

urlpatterns = [
    path('profile/', views.user_profile, name='user_profile'),
    path('logout/', views.custom_logout, name='account_logout'),
    path('login/', CustomLoginView.as_view(), name='account_login'),
]