# analytics/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    # Feature migrated to quiz app
    #path('exam-analyzer/', views.exam_analyzer, name='exam_analyzer'),
    #path('exam-analysis-results/', views.exam_analysis_results, name='exam_analysis_results_anon'),
    #path('exam-analysis-results/<uuid:analysis_id>/', views.exam_analysis_results, name='exam_analysis_results'),
]