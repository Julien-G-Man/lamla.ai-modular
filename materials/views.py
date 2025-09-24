# materials/views.py
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import logging
from .services import MaterialService

logger = logging.getLogger(__name__)

def upload_slides(request):
    """
    Renders the page for uploading study materials.
    """
    return render(request, 'materials/upload.html')

@require_POST
def ajax_extract_text(request):
    """
    An AJAX endpoint to extract text from an uploaded file.
    This logic has been moved to a dedicated service.
    """
    if 'slide_file' not in request.FILES:
        return JsonResponse({'error': 'No file uploaded'}, status=400)
    
    file = request.FILES['slide_file']
    
    try:
        extracted_text = MaterialService.extract_text_from_file(file)
        if not extracted_text:
            return JsonResponse({'error': 'No text could be extracted from the file.'}, status=400)
        return JsonResponse({'text': extracted_text})
    except Exception as e:
        logger.error(f"Text extraction error: {e}")
        return JsonResponse({'error': f'Failed to extract text: {str(e)}'}, status=500)