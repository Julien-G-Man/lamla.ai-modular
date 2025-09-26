# core/ai_client.py
import os
import json
import logging
import requests
from typing import List, Optional, Union
from core.exceptions import APIIntegrationError

logger = logging.getLogger(__name__)
DEFAULT_TIMEOUT = 30
DEFAULT_PROVIDER_ORDER = ["azure", "deepseek", "gemini", "huggingface"]

# lightweight helper to extract a JSON substring from noisy text
def _extract_json_substring(text: str):
    if not text or not isinstance(text, str):
        return None
    text = text.strip()
    # Quick checks
    if text.startswith('{') or text.startswith('['):
        try:
            return json.loads(text)
        except Exception:
            pass

    # Find first "{" or "[" and last matching "}" or "]"
    first_brace = min(
        [idx for idx in (text.find('{'), text.find('[')) if idx != -1],
        default=-1
    )
    if first_brace == -1:
        return None

    # choose closing char depending on first
    opening = text[first_brace]
    closing = '}' if opening == '{' else ']'
    last_close = text.rfind(closing)
    if last_close == -1 or last_close <= first_brace:
        return None

    candidate = text[first_brace:last_close + 1]
    try:
        return json.loads(candidate)
    except Exception:
        return None


class AIClient:
    def __init__(self, provider_priority: Optional[List[str]] = None):
        self.providers_config = provider_priority or None

        # lazy keys
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

        # load .env if present
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except Exception:
            # not fatal
            pass

        logger.info(f"AIClient initialized with provider order: {self.providers}")

    def _refresh_keys(self):
        """Pull keys from django settings if available, else environment."""
        try:
            from django.conf import settings as django_settings
            has_settings = True
        except Exception:
            django_settings = None
            has_settings = False

        self.deepseek_key = getattr(django_settings, 'DEEPSEEK_API_KEY', None) if has_settings else os.environ.get("DEEPSEEK_API_KEY")
        self.deepseek_url = getattr(django_settings, 'DEEPSEEK_API_URL', None) if has_settings else os.environ.get("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")

        self.azure_key = getattr(django_settings, 'AZURE_OPENAI_API_KEY', None) if has_settings else os.environ.get("AZURE_OPENAI_API_KEY")
        self.azure_endpoint = getattr(django_settings, 'AZURE_OPENAI_ENDPOINT', None) if has_settings else os.environ.get("AZURE_OPENAI_ENDPOINT")
        self.azure_deployment = getattr(django_settings, 'AZURE_OPENAI_DEPLOYMENT', None) if has_settings else os.environ.get("AZURE_OPENAI_DEPLOYMENT")
        self.azure_api_version = getattr(django_settings, 'AZURE_OPENAI_API_VERSION', None) if has_settings else os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

        self.gemini_key = getattr(django_settings, 'GEMINI_API_KEY', None) if has_settings else os.environ.get("GEMINI_API_KEY")
        self.gemini_url = getattr(django_settings, 'GEMINI_API_URL', None) if has_settings else os.environ.get("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent")

        self.hf_token = getattr(django_settings, 'HUGGING_FACE_API_TOKEN', None) if has_settings else os.environ.get("HUGGING_FACE_API_TOKEN")
        self.hf_url_template = getattr(django_settings, 'HUGGING_FACE_API_URL_TEMPLATE', None) if has_settings else os.environ.get("HUGGING_FACE_API_URL_TEMPLATE", "https://api-inference.huggingface.co/models/{model}")

    def generate_content(self, prompt: str, max_tokens: int = 1024, providers: Optional[List[str]] = None, raise_on_error: bool = True) -> Union[dict, str]:
        """
        Try providers in order. Return either:
          - dict (if JSON content detected and parsed)
          - str (raw text) otherwise

        Caller must handle both. We will try to parse JSON from provider output before returning.
        """
        self._refresh_keys()
        provider_list = providers or self.providers
        errors = []

        for provider in provider_list:
            provider = provider.lower()
            try:
                logger.debug(f"AIClient: attempting provider {provider}")
                if provider == "azure" and self.azure_key and (self.azure_endpoint or self.azure_deployment):
                    raw = self._call_azure_openai(prompt, max_tokens)
                elif provider == "deepseek" and self.deepseek_key:
                    raw = self._call_deepseek(prompt, max_tokens)
                elif provider == "gemini" and self.gemini_key:
                    raw = self._call_gemini(prompt, max_tokens)
                elif provider in ("huggingface", "hf") and self.hf_token:
                    raw = self._call_huggingface(prompt, max_tokens)
                else:
                    errors.append((provider, "Provider not configured"))
                    continue

                if raw is None:
                    raise APIIntegrationError(f"{provider} returned empty response")

                # raw may be dict already (some client libraries), normalize to string if so for JSON extraction attempt
                if isinstance(raw, dict):
                    logger.debug(f"{provider}: provider returned dict directly.")
                    return raw

                text = str(raw).strip()
                if not text:
                    raise APIIntegrationError(f"{provider} returned empty text")

                # Try full JSON parse
                try:
                    parsed = json.loads(text)
                    logger.debug(f"{provider}: response parsed as full JSON")
                    return parsed
                except Exception:
                    # try to extract a JSON substring if provider returned explanation + JSON
                    parsed = _extract_json_substring(text)
                    if parsed is not None:
                        logger.debug(f"{provider}: extracted JSON substring from response")
                        return parsed

                    # otherwise return raw text so caller can handle
                    logger.debug(f"{provider}: returning raw text (not JSON)")
                    return text

            except Exception as e:
                logger.warning(f"Provider {provider} failed: {e}", exc_info=False)
                errors.append((provider, str(e)))
                continue

        err_msg = "; ".join([f"{p}: {m}" for p, m in errors])
        logger.error(f"AIClient: all providers failed. Details: {err_msg}")
        if raise_on_error:
            raise APIIntegrationError(f"All AI providers failed: {err_msg}")
        return ""

    # -----------------------------
    # Provider Implementations
    # -----------------------------
    def _call_deepseek(self, prompt: str, max_tokens: int) -> str:
        url = self.deepseek_url
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.deepseek_key}"
        }
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
        resp.raise_for_status()
        data = resp.text
        # return textual body; normalization happens in generate_content
        return data

    def _call_azure_openai(self, prompt: str, max_tokens: int) -> str:
        if not self.azure_endpoint or not self.azure_key:
            raise APIIntegrationError("Azure OpenAI not configured")

        ep = self.azure_endpoint.rstrip('/')
        # if the endpoint already contains deployments path, reuse it (avoid double path)
        if '/deployments/' in ep.lower():
            url = ep
            # ensure api-version param exists
            if '?' not in url:
                url = f"{url}?api-version={self.azure_api_version}"
        else:
            # build full path
            if not self.azure_deployment:
                raise APIIntegrationError("Azure deployment name not configured")
            url = f"{ep}/openai/deployments/{self.azure_deployment}/chat/completions?api-version={self.azure_api_version}"

        headers = {
            "Content-Type": "application/json",
            "api-key": self.azure_key
        }
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.7
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
        resp.raise_for_status()
        # return the raw text body (JSON string or plain text)
        return resp.text

    def _call_gemini(self, prompt: str, max_tokens: int) -> str:
        url = f"{self.gemini_url}?key={self.gemini_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens},
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
        resp.raise_for_status()
        return resp.text

    def _call_huggingface(self, prompt: str, max_tokens: int) -> str:
        url = self.hf_url_template.format(model="gpt2")
        headers = {"Authorization": f"Bearer {self.hf_token}"}
        payload = {"inputs": prompt, "parameters": {"max_new_tokens": max_tokens}}
        resp = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
        resp.raise_for_status()
        return resp.text


# module-level instance for convenience
ai_client = AIClient()
