# core/ai_client.py (update)
import os
import json
import logging
import requests
from typing import List, Optional
from core.exceptions import APIIntegrationError

logger = logging.getLogger(__name__)
DEFAULT_TIMEOUT = 30
DEFAULT_PROVIDER_ORDER = ["deepseek", "azure", "gemini", "huggingface"]

class AIClient:
    def __init__(self, provider_priority: Optional[List[str]] = None):
        self.providers_config = provider_priority or None
        # Initialize key attributes to None; we'll populate lazily
        self.deepseek_key = None
        self.deepseek_url = None
        self.azure_key = None
        self.azure_endpoint = None
        self.azure_deployment = None
        self.azure_api_version = None
        self.gemini_key = None
        self.gemini_url = None
        self.hf_token = None
        self.hf_url_template = None

        env_priority = os.environ.get("AI_PROVIDER_PRIORITY")
        if provider_priority:
            self.providers = provider_priority
        elif env_priority:
            self.providers = [p.strip().lower() for p in env_priority.split(",")]
        else:
            self.providers = DEFAULT_PROVIDER_ORDER

        logger.info(f"AIClient initialized with provider order: {self.providers}")

    from dotenv import load_dotenv
    load_dotenv()

    def _refresh_keys(self):
        """Refresh keys from django settings if available, else os.environ."""
        try:
            # Avoid heavy Django import at module import time; attempt to use settings if configured
            from django.conf import settings as django_settings
            has_settings = hasattr(django_settings, 'DEEPSEEK_API_KEY') or hasattr(django_settings, 'AZURE_OPENAI_API_KEY')
        except Exception:
            django_settings = None
            has_settings = False

        # DeepSeek
        self.deepseek_key = getattr(django_settings, 'DEEPSEEK_API_KEY', None) if has_settings else os.environ.get("DEEPSEEK_API_KEY")
        self.deepseek_url = getattr(django_settings, 'DEEPSEEK_API_URL', None) if has_settings else os.environ.get("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")

        # Azure
        self.azure_key = getattr(django_settings, 'AZURE_OPENAI_API_KEY', None) if has_settings else os.environ.get("AZURE_OPENAI_API_KEY")
        self.azure_endpoint = getattr(django_settings, 'AZURE_OPENAI_ENDPOINT', None) if has_settings else os.environ.get("AZURE_OPENAI_ENDPOINT")
        self.azure_deployment = getattr(django_settings, 'AZURE_OPENAI_DEPLOYMENT', None) if has_settings else os.environ.get("AZURE_OPENAI_DEPLOYMENT")
        self.azure_api_version = getattr(django_settings, 'AZURE_OPENAI_API_VERSION', None) if has_settings else os.environ.get("AZURE_OPENAI_API_VERSION", "2024-06-01-preview")

        # Gemini
        self.gemini_key = getattr(django_settings, 'GEMINI_API_KEY', None) if has_settings else os.environ.get("GEMINI_API_KEY")
        self.gemini_url = getattr(django_settings, 'GEMINI_API_URL', None) if has_settings else os.environ.get("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent")

        # Hugging Face
        self.hf_token = getattr(django_settings, 'HUGGING_FACE_API_TOKEN', None) if has_settings else os.environ.get("HUGGING_FACE_API_TOKEN")
        self.hf_url_template = getattr(django_settings, 'HUGGING_FACE_API_URL_TEMPLATE', None) if has_settings else os.environ.get("HUGGING_FACE_API_URL_TEMPLATE", "https://api-inference.huggingface.co/models/{model}")

    def generate_content(self, prompt: str, max_tokens: int = 1024, providers: Optional[List[str]] = None, raise_on_error: bool = True) -> str:
        # Refresh keys before attempting any provider
        self._refresh_keys()

        provider_list = providers or self.providers
        errors = []

        for provider in provider_list:
            try:
                if provider == "deepseek" and self.deepseek_key:
                    return self._call_deepseek(prompt, max_tokens)
                if provider == "azure" and self.azure_key and self.azure_endpoint and self.azure_deployment:
                    return self._call_azure_openai(prompt, max_tokens)
                if provider == "gemini" and self.gemini_key:
                    return self._call_gemini(prompt, max_tokens)
                if provider in ("huggingface", "hf") and self.hf_token:
                    return self._call_huggingface(prompt, max_tokens)
                # provider missing -> skip
                errors.append((provider, "Provider not configured"))
            except Exception as e:
                logger.warning(f"Provider {provider} failed: {e}")
                errors.append((provider, str(e)))

        err_msg = "; ".join([f"{p}: {m}" for p, m in errors])
        logger.error(f"AIClient: all providers failed. Details: {err_msg}")
        if raise_on_error:
            raise APIIntegrationError(f"All AI providers failed: {err_msg}")
        return ""

    # -----------------------------
    # Provider Implementations
    # -----------------------------

    def _call_deepseek(self, prompt: str, max_tokens: int) -> str:
        """
        Call DeepSeek API for chat completion.
        """
        url = self.deepseek_url
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.deepseek_key}"
        }
        payload = {
            "model": "deepseek-chat",   # or deepseek-coder if you prefer
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return self._extract_text_from_response("deepseek", data)
        except Exception as e:
            raise APIIntegrationError(f"DeepSeek API call failed: {e}")

    def _call_azure_openai(self, prompt: str, max_tokens: int) -> str:
        """
        Call Azure OpenAI API for chat completion.
        """
        if not all([self.azure_endpoint, self.azure_deployment, self.azure_key]):
            raise APIIntegrationError("Azure OpenAI not fully configured")

        url = f"{self.azure_endpoint}/openai/deployments/{self.azure_deployment}/chat/completions?api-version={self.azure_api_version}"
        headers = {
            "Content-Type": "application/json",
            "api-key": self.azure_key,
        }
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return self._extract_text_from_response("azure", data)
        except Exception as e:
            raise APIIntegrationError(f"Azure OpenAI API call failed: {e}")

    def _call_gemini(self, prompt: str, max_tokens: int) -> str:
        """
        Call Google Gemini API.
        """
        url = f"{self.gemini_url}?key={self.gemini_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens},
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return self._extract_text_from_response("gemini", data)
        except Exception as e:
            raise APIIntegrationError(f"Gemini API call failed: {e}")

    def _call_huggingface(self, prompt: str, max_tokens: int) -> str:
        """
        Call Hugging Face Inference API.
        """
        if not self.hf_url_template:
            raise APIIntegrationError("HuggingFace URL template not configured")

        url = self.hf_url_template.format(model="gpt2")  # replace with your preferred model
        headers = {"Authorization": f"Bearer {self.hf_token}"}
        payload = {"inputs": prompt, "parameters": {"max_new_tokens": max_tokens}}

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return self._extract_text_from_response("huggingface", data)
        except Exception as e:
            raise APIIntegrationError(f"HuggingFace API call failed: {e}")

    # -----------------------------
    # Normalization of Responses
    # -----------------------------
    def _extract_text_from_response(self, provider: str, data: dict) -> str:
        """
        Normalize text extraction across providers.
        """
        try:
            if provider == "deepseek":
                return data["choices"][0]["message"]["content"]
            elif provider == "azure":
                return data["choices"][0]["message"]["content"]
            elif provider == "gemini":
                return data["candidates"][0]["content"]["parts"][0]["text"]
            elif provider == "huggingface":
                if isinstance(data, list):
                    return data[0].get("generated_text", "")
                return data.get("generated_text", "")
        except Exception as e:
            raise APIIntegrationError(f"Failed to extract text from {provider} response: {e}")

        raise APIIntegrationError(f"Unsupported provider response format: {provider}")

# Global instance
ai_client = AIClient()
