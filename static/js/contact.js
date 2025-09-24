/**
 * JavaScript for the Contact Page.
 * Handles URL parameter parsing and client-side form validation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Form Validation and Submission ---
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

            // If validation passes, the form will submit normally.
        });
    }

    // --- Handle URL Parameters (e.g., ?subject=Question) ---
    const handleUrlParameters = () => {
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
    };

    handleUrlParameters();

    // --- General Animation/Utility Logic ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = element.getAttribute('data-delay');
                element.style.animationDelay = delay;
                element.classList.add('is-visible');
                observer.unobserve(element);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-in').forEach(element => {
        observer.observe(element);
    });
});