"""
Django settings for lamla_ai project.

This file now imports from the modular settings structure.
For development, it imports from settings.dev
For production, it should import from settings.prod
"""

# Import development settings by default
from .settings.dev import *