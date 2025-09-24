# core/models.py
from django.db import models
import uuid

# This is the foundational model that all other models in the project
# should inherit from. It ensures every model has a UUID primary key
# and automatic created_at and updated_at timestamps.
class BaseModel(models.Model):
    """
    An abstract base class model that provides UUID primary key,
    created_at, and updated_at fields.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # This is a key setting. It tells Django not to create a
        # database table for this model. It's meant to be inherited.
        abstract = True