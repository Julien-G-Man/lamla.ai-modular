# accounts/models.py
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import BaseModel # Inherit from the new BaseModel
import logging

logger = logging.getLogger(__name__)

class UserProfile(BaseModel):
    """
    Extended user profile with additional fields like a profile picture.
    Inherits UUID ID and timestamps from BaseModel.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        null=True,
        blank=True,
        help_text="Upload your profile picture (JPG, PNG, GIF up to 5MB)"
    )
    bio = models.TextField(max_length=500, blank=True, help_text="Tell us about yourself")
    is_deleted = models.BooleanField(default=False, help_text="Soft-delete flag for manual admin use only")

    def __str__(self):
        return f"{self.user.username}'s Profile"
    
    @property
    def profile_picture_url(self):
        """Return the profile picture URL or default image"""
        if self.profile_picture and hasattr(self.profile_picture, 'url'):
            return self.profile_picture.url
        return '/static/images/default-avatar.png'

# The `post_save` signals for UserProfile now live here.
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Guarantees a UserProfile is created for every new User."""
    if created:
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={'is_deleted': False}
        )
        logger.info(f"Created UserProfile for new user: {instance.username} (ID: {instance.id})")

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Saves the UserProfile when the User is saved."""
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        logger.warning(f"User {instance.username} (ID: {instance.id}) missing profile during save. Creating now.")
        UserProfile.objects.get_or_create(user=instance, defaults={'is_deleted': False})