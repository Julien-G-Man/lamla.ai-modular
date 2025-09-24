# quiz/services.py
import logging
from core.ai_client import ai_client
from django.conf import settings
from core.exceptions import APIIntegrationError

logger = logging.getLogger(__name__)

class QuizService:
    """
    A service class for all quiz-related business logic, including
    AI question generation and grading.
    """
    @staticmethod
    def generate_quiz(study_text, num_mcq, num_short, subject, difficulty):
        """
        Uses the AI client to generate quiz questions from text.
        """
        if not study_text or len(study_text) < 30:
            raise ValueError('Please provide at least 30 characters of study material.')
        
        try:
            # Placeholder for the actual AI API call to generate quiz data.
            # Your specific prompt and parsing logic will go here.
            
            mock_mcq = [{
                "question": "What is the capital of France?",
                "options": ["A. Berlin", "B. Paris", "C. Madrid"],
                "answer": "B"
            }] if num_mcq > 0 else []
            mock_short = [{
                "question": "What is the largest organ of the human body?",
                "answer": "The skin"
            }] if num_short > 0 else []
            
            return {
                'mcq_questions': mock_mcq,
                'short_questions': mock_short
            }
            
        except Exception as e:
            logger.error(f"Quiz generation failed: {e}")
            raise APIIntegrationError(f"Quiz generation failed: {str(e)}")
            
    @staticmethod
    def grade_short_answer(question, expected_answer, user_answer):
        """
        Uses the AI client to grade a short answer.
        """
        prompt = f"""
        Evaluate the following short answer for correctness.
        Question: {question}
        Expected answer: {expected_answer}
        User answer: {user_answer}
        Reply only with 'Yes' if the user's answer is correct, or 'No' if it is not.
        """
        
        try:
            response = ai_client.generate_content(prompt)
            return response.strip().lower().startswith('yes')
        except Exception as e:
            logger.error(f"AI grading failed: {e}")
            # Fallback to simple keyword matching
            user_lower = user_answer.lower().strip()
            expected_lower = expected_answer.lower().strip()
            
            if user_lower == expected_lower:
                return True
            
            expected_words = set(expected_lower.split())
            user_words = set(user_lower.split())
            
            if expected_words and len(expected_words.intersection(user_words)) / len(expected_words) > 0.5:
                return True
                
            return False
