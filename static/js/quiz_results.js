//javascript:Quiz Results Script:static/js/quiz_results.js
// Function to handle the click event on copy buttons
function copyHandler(event) {
    const button = event.target.closest('.action-btn');
    if (!button) return;

    const copyType = button.getAttribute('data-copy-type');
    let textToCopy = '';
    let success = false;

    if (copyType === 'summary') {
        // Extract summary data from button data attributes
        const quizTitle = button.getAttribute('data-quiz-title');
        const score = button.getAttribute('data-score');
        const correctAnswers = button.getAttribute('data-correct-answers');
        const totalQuestions = button.getAttribute('data-total-questions');

        textToCopy = 
            `Quiz Results: ${quizTitle}\n` +
            `Score: ${score}%\n` +
            `Correct Answers: ${correctAnswers} out of ${totalQuestions}`;
        
        success = copyToClipboard(textToCopy);

    } else if (copyType === 'link') {
        const link = button.getAttribute('data-link');
        if (link) {
            textToCopy = link;
            success = copyToClipboard(textToCopy);
        }
    }

    if (success) {
        // Provide visual feedback
        const originalText = button.innerHTML;
        const originalBg = button.style.background;
        const originalColor = button.style.color;
        const originalBorderColor = button.style.borderColor;
        
        button.innerHTML = '<i class="fas fa-check"></i> Copied to Clipboard!';
        button.style.background = 'var(--success-green)';
        button.style.color = 'white';
        button.style.borderColor = 'var(--success-green)';
        
        setTimeout(() => {
            // Restore original state after 2 seconds
            button.innerHTML = originalText;
            button.style.background = originalBg;
            button.style.color = originalColor;
            button.style.borderColor = originalBorderColor;
        }, 2000);
    }
}

// Universal function to copy text to clipboard, supporting both modern and legacy browsers
function copyToClipboard(text) {
    // Attempt modern navigator.clipboard API first
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            // Success is handled by the caller function (copyHandler)
        }).catch(err => {
            console.error('Could not copy text using clipboard API: ', err);
            // Fallback if permission is denied or error occurs
            fallbackCopy(text);
        });
        return true; // Assume success for clipboard API call, feedback is visual
    } else {
        // Fallback for older browsers
        fallbackCopy(text);
        return true;
    }
}

// Fallback function using document.execCommand
function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Hide textarea off-screen
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (!successful) {
            console.warn('Fallback copy failed: execCommand was unsuccessful.');
        }
    } catch (err) {
        console.error('Fallback copy failed: Could not perform document.execCommand("copy").', err);
    }
    
    document.body.removeChild(textArea);
}

// Initialize event listeners and animations when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // 1. Add click listener to the action buttons container
    const actionsDiv = document.querySelector('.pt-4.border-t.border-border-light.space-y-4');
    if (actionsDiv) {
        // Use event delegation for buttons
        actionsDiv.addEventListener('click', copyHandler);
    }

    // 2. Animate progress bar on load
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        // Store the target width (set by Django in the style attribute)
        const targetWidth = progressBar.style.width; 
        
        // Reset the width to 0% before starting the animation
        progressBar.style.width = '0%'; 
        
        // Use a timeout to ensure the transition property applies and animation runs
        setTimeout(() => {
            progressBar.style.width = targetWidth; // Animate to the target score
        }, 50); // Small delay to trigger CSS transition
    }
});
