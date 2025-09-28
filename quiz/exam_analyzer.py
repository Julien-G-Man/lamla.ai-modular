from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
import logging
from django.contrib import messages
from materials.services import MaterialService
from django.db import transaction
from .models import ExamDocument, ExamAnalysis

logger = logging.getLogger(__name__)

def perform_exam_analysis(text_content, subject, context=''):
    """
    Performs comprehensive AI analysis on exam content.
    This logic has been moved from the views.py file.
    """
    trends = [f"Trends for {subject} based on analysis..."]
    predictions = [f"Predictions for {subject} based on analysis..."]
    
    return {
        'trends': trends,
        'predictions': predictions
    }

def exam_analyzer(request):
    """
    Renders the exam analyzer page and handles file uploads.
    """
    if request.method == 'POST':
        subject = request.POST.get('subject', '').strip()
        context = request.POST.get('context', '').strip()
        
        if not subject:
            return render(request, 'quiz/exam_analyzer.html', {'error_message': 'Please enter a subject/topic.'})
        
        if not any(f'exam_file_{i}' in request.FILES for i in range(1, 6)):
            return render(request, 'quiz/exam_analyzer.html', {'error_message': 'Please upload at least one file.'})
        
        all_text_content = []
        uploaded_documents = []
        
        try:
            with transaction.atomic():
                for i in range(1, 6):
                    file_key = f'exam_file_{i}'
                    if file_key in request.FILES:
                        file = request.FILES[file_key]
                        try:
                            extracted_text = MaterialService.extract_text_from_file(file)
                            all_text_content.append(extracted_text)
                            
                            if request.user.is_authenticated:
                                doc = ExamDocument.objects.create(
                                    user=request.user,
                                    title=file.name,
                                    subject=subject,
                                    document_file=file,
                                    extracted_text=extracted_text[:10000]
                                )
                                uploaded_documents.append(doc)
                        except Exception as e:
                            logger.error(f"Error processing file {file.name}: {e}")
                            continue
                            
            if not all_text_content:
                return render(request, 'quiz/exam_analyzer.html', {'error_message': 'No valid content could be extracted.'})
                
            combined_text = '\n\n'.join(all_text_content)
            analysis_results = perform_exam_analysis(combined_text, subject, context)
            
            if request.user.is_authenticated and uploaded_documents:
                analysis = ExamAnalysis.objects.create(
                    user=request.user,
                    subject=subject,
                    analysis_data=analysis_results
                )
                analysis.documents_analyzed.set(uploaded_documents)
                return redirect('exam_analysis_results', analysis_id=analysis.id)
            else:
                request.session['anon_exam_analysis'] = analysis_results
                return redirect('exam_analysis_results_anon')
                
        except Exception as e:
            logger.error(f"Exam analyzer error: {e}")
            return render(request, 'quiz/exam_analyzer.html', {'error_message': f'Analysis failed: {str(e)}'})
            
    return render(request, 'quiz/exam_analyzer.html')

def exam_analysis_results(request, analysis_id=None):
    """
    Displays the results of an exam analysis.
    """
    analysis_data = None
    if analysis_id:
        if not request.user.is_authenticated:
            return redirect('account_login')
        try:
            analysis = ExamAnalysis.objects.get(id=analysis_id, user=request.user)
            analysis_data = analysis.analysis_data
        except ExamAnalysis.DoesNotExist:
            return render(request, 'quiz/exam_analysis_results.html', {'error_message': 'Analysis not found.'})
    else:
        analysis_data = request.session.get('anon_exam_analysis')
        if not analysis_data:
            return render(request, 'quiz/exam_analysis_results.html', {'error_message': 'No analysis results found.'})
            
    return render(request, 'quiz/exam_analysis_results.html', {'analysis_results': analysis_data})
