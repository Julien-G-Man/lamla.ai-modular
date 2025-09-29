"""
URL configuration for lamla_ai project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # The core app handles the main and static pages.
    path('', include(('core.urls', 'core'), namespace='core')), 

    # other apps serve dynamic pages with heavy logic
    path('accounts/', include('accounts.urls')),
    path('', include('materials.urls')),
    path('practice/', include(('quiz.urls', 'quiz'), namespace='quiz')),
    path('ai/', include(('chatbot.urls', 'ai'), namespace='ai')),
    path('analytics/', include('analytics.urls')),
    path('', include(('feedback.urls', 'feedback'), namespace='feedback')),
    path('accounts/', include('allauth.urls')),
    
    # Route to sserve service worker
    path('service-worker.js',
         TemplateView.as_view(
             template_name='sw.js',
             content_type='application/javascript'
             ),
         name='service-worker-root'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
