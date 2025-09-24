# core/ai_client.py
from core.exceptions import APIIntegrationError
import logging
import json
import os
import requests

logger = logging.getLogger(__name__)

# This class acts as a single point of truth for interacting with
# the LLM API. It handles authentication, requests, and error
# handling, so other apps don't have to.
class AIClient:
    """
    A wrapper class for interacting with external AI APIs (e.g., Gemini).
    """
    def __init__(self, api_key=None, api_url=None):
        """
        Initializes the AIClient with API credentials.
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.api_url = api_url or "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
        
        if not self.api_key:
            logger.error("API key for AIClient is not configured.")

    def generate_content(self, prompt, generation_config=None, safety_settings=None):
        """
        Generates content from a given prompt using the LLM API.
        
        Args:
            prompt (str): The user's input prompt.
            generation_config (dict): Optional config for content generation.
            safety_settings (list): Optional safety settings.
            
        Returns:
            str: The generated text content.
            
        Raises:
            APIIntegrationError: If the API call fails or returns an error.
        """
        if not self.api_key:
            raise APIIntegrationError("AI API key is missing.")
            
        headers = {
            'Content-Type': 'application/json'
        }
        
        payload = {
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': generation_config or {},
            'safetySettings': safety_settings or []
        }
        
        try:
            # Note: This is a placeholder; you'll need to adapt the actual
            # API call to the specific model you use (e.g., Gemini).
            response = requests.post(f"{self.api_url}?key={self.api_key}", headers=headers, data=json.dumps(payload))
            response.raise_for_status() # Raise an exception for bad status codes
            
            data = response.json()
            generated_text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            
            return generated_text
        
        except requests.exceptions.RequestException as e:
            logger.error(f"AI API request failed: {e}")
            raise APIIntegrationError(f"Failed to connect to AI API: {e}")
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            logger.error(f"Invalid response from AI API: {e}")
            raise APIIntegrationError("Invalid response from AI API.")

# You can instantiate this client here to be imported by other apps
# or instantiate it within the services that need it.
ai_client = AIClient()
