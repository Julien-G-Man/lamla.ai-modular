# analytics/views.py
from django.shortcuts import render, redirect
from django.http import JsonResponse
import logging
import json
from quiz.models import ExamAnalysis
from materials.models import ExamDocument
from django.contrib.auth.decorators import login_required
from materials.services import MaterialService
from django.db import transaction

logger = logging.getLogger(__name__)

@login_required
def dashboard(request):
    """
    Displays a user's recent activity, combining data from different apps.
    This is a good example of a cross-app view.
    """
    from quiz.models import QuizSession
    
    quiz_sessions = list(QuizSession.objects.filter(user=request.user))
    exam_analyses = list(ExamAnalysis.objects.filter(user=request.user))
    
    all_activities = []
    for q in quiz_sessions:
        file_name = q.questions_data.get('uploaded_file_name', '') if q.questions_data and isinstance(q.questions_data, dict) else ''
        all_activities.append({'type': 'quiz', 'obj': q, 'created_at': q.created_at, 'subject': q.subject or '', 'file_name': file_name})
    for a in exam_analyses:
        all_activities.append({'type': 'exam_analysis', 'obj': a, 'created_at': a.created_at, 'subject': a.subject or '', 'file_name': ''})
        
    all_activities.sort(key=lambda x: x['created_at'], reverse=True)
    recent_activities = all_activities[:4]
    
    context = {'recent_activities': recent_activities}
    return render(request, 'analytics/dashboard.html', context)