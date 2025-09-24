# accounts/views.py
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout as auth_logout
from django.contrib import messages
from .models import UserProfile
from allauth.account.views import LoginView as AllauthLoginView

# The `user_profile` view is a perfect fit for the `accounts` app.
@login_required
def user_profile(request):
    """
    Handles viewing and updating the user's profile.
    """
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    if request.method == 'POST':
        updated = False
        
        if 'profile_picture' in request.FILES:
            profile_pic = request.FILES['profile_picture']
            if profile_pic.size > 5 * 1024 * 1024:
                messages.error(request, 'Profile picture must be less than 5MB.')
                return redirect('user_profile')
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if profile_pic.content_type not in allowed_types:
                messages.error(request, 'Please upload a valid image file (JPG, PNG, or GIF).')
                return redirect('user_profile')
            
            profile.profile_picture = profile_pic
            updated = True
        
        bio = request.POST.get('bio', '').strip()
        if bio != profile.bio:
            profile.bio = bio
            updated = True
        
        if updated:
            profile.save()
            messages.success(request, 'Profile updated successfully!')
        else:
            messages.info(request, 'No changes were made to your profile.')
        
        return redirect('user_profile')
        
    return render(request, 'accounts/user_profile.html', {'profile': profile})

# The `custom_logout` view also belongs here.
def custom_logout(request):
    """Logs the user out and redirects to the homepage."""
    auth_logout(request)
    return redirect('home')

# The custom login view and adapter are also part of the auth flow.
class CustomLoginView(AllauthLoginView):
    template_name = 'account/login.html'