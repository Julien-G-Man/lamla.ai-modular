# lamla_ai/settings/dev.py
from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

# Local-only database for simplicity
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Use a local SMTP server for email sending during development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'