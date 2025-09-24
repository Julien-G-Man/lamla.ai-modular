// Handle URL parameters for pre-filling contact form
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const subject = urlParams.get('subject');
    if (subject) {
        const subjectInput = document.querySelector('input[name="subject"]');
        if (subjectInput) {
            subjectInput.value = decodeURIComponent(subject);
            subjectInput.style.background = '#fff3cd';
            subjectInput.style.borderColor = '#ffc107';
            setTimeout(() => {
                subjectInput.style.background = '';
                subjectInput.style.borderColor = '';
            }, 2000);
        }
    }
}
document.addEventListener('DOMContentLoaded', handleUrlParameters);
// Contact form submission handler
const form = document.getElementById('contactForm');
if (form) {
    form.addEventListener('submit', function(e) {
        const name = form.querySelector('input[name="name"]').value.trim();
        const email = form.querySelector('input[name="email"]').value.trim();
        const subject = form.querySelector('input[name="subject"]').value.trim();
        const message = form.querySelector('textarea[name="message"]').value.trim();
        if (!name || !email || !subject || !message) {
            e.preventDefault();
            alert('Please fill in all fields.');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            e.preventDefault();
            alert('Please enter a valid email address.');
            return false;
        }
        // If validation passes, let the form submit normally
    });
}