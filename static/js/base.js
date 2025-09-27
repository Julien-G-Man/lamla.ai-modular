// Base JavaScript functionality for Lamla AI

document.addEventListener('DOMContentLoaded', function() {
    // Select the necessary elements using the IDs/Classes from your HTML structure
    const navToggle = document.querySelector('.nav-toggle'); // Assuming you use the class for the toggle button
    const navLinks = document.querySelector('.nav-links'); // The UL element to slide out
    
    // --- Mobile navigation toggle ---
    
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function() {
            // 1. Toggle the 'active' class on the UL element to trigger the CSS slide-out
            navLinks.classList.toggle('active'); 
            
            // 2. Keep the 'open' classes on the button and body for existing styling/logic
            navToggle.classList.toggle('open');
            document.body.classList.toggle('nav-open');
            
            // 3. Update ARIA attribute for accessibility
            const isExpanded = navLinks.classList.contains('active');
            navToggle.setAttribute('aria-expanded', isExpanded);
        });
        
        // Ensure ARIA attribute is set on load
        navToggle.setAttribute('aria-controls', 'navLinks'); // Assuming the nav UL has id="navLinks" or a similar attribute
        navToggle.setAttribute('aria-expanded', 'false');
    }

    // Function to close the menu
    function closeMobileNav() {
        if (navLinks) {
            navLinks.classList.remove('active');
        }
        if (navToggle) {
            navToggle.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('nav-open');
    }

    // Close mobile nav when clicking on a link
    const allNavLinks = document.querySelectorAll('.nav-links a');
    allNavLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 1024) {
                closeMobileNav();
            }
        });
    });

    // Close mobile nav when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && navLinks && navToggle) {
            // Check if click target is outside the links container and outside the toggle button
            const isClickInsideNav = navLinks.contains(e.target);
            const isClickOnToggle = navToggle.contains(e.target);
            
            if (!isClickInsideNav && !isClickOnToggle && navLinks.classList.contains('active')) {
                closeMobileNav();
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            // Force close menu when switching to desktop view
            closeMobileNav();
        }
    });

    // Smooth scrolling for anchor links (original logic preserved)
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed header
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                
                // Close menu after clicking anchor link on mobile
                if (window.innerWidth <= 1024) {
                    closeMobileNav();
                }
            }
        });
    });

    // Add scroll effect to header (original logic preserved)
    let lastScrollTop = 0;
    const header = document.querySelector('.main-header');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });

    // Auto-hide messages after 4 seconds (original logic preserved)
    const messages = document.querySelectorAll('.message-item');
    messages.forEach(message => {
        // Use CSS transitions instead of JS animation to avoid conflicts with global animation settings
        // If your CSS animation is working, you can keep the original logic, 
        // but this simplified version works with the JS slideIn/slideOut classes/animations you had defined
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transform = 'translateX(100%)';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 4000);
    });

    // Add loading states to forms (original logic preserved)
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('loading');
                
                // Re-enable after 5 seconds as fallback
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('loading');
                }, 5000);
            }
        });
    });

    // Intersection Observer for scroll animations (original logic preserved)
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for scroll animations
    const animatedElements = document.querySelectorAll('.feature-card, .cta-card, [data-animate]');
    animatedElements.forEach(element => {
        observer.observe(element);
    });

    // Keyboard navigation for accessibility
    document.addEventListener('keydown', function(e) {
        // Close mobile nav with Escape key
        if (e.key === 'Escape' && navLinks && navLinks.classList.contains('active')) {
            closeMobileNav();
        }
    });

    // Add focus management for mobile navigation (original logic preserved)
    if (navToggle) {
        navToggle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navToggle.click();
            }
        });
    }

    // Initialize tooltips if any (original logic preserved)
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(tooltip => {
        tooltip.addEventListener('mouseenter', function() {
            // Tooltip functionality can be added here
        });
    });

    // Add smooth transitions to all interactive elements (original logic preserved)
    const interactiveElements = document.querySelectorAll('a, button, .btn, .card');
    interactiveElements.forEach(element => {
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
});