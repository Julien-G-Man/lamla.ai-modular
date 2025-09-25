from django.contrib import admin
from .models import QuizSession

# Register your models here.
@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'subject', 'score_percentage', 'total_questions', 'created_at']
    list_filter = ['created_at', 'subject']
    search_fields = ['user__username', 'user__email', 'subject']
    readonly_fields = ['created_at']
    fieldsets = (
        ('Session Information', {
            'fields': ('user', 'subject', 'score_percentage', 'total_questions', 'correct_answers', 'duration_minutes')
        }),
        ('Quiz Data', {
            'fields': ('questions_data', 'user_answers'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
