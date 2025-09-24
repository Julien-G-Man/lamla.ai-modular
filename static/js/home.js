// Home page specific JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Simple AOS (Animate On Scroll) implementation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            }
        });
    }, observerOptions);

    // Observe all elements with data-aos attribute
    const animatedElements = document.querySelectorAll('[data-aos]');
    animatedElements.forEach(element => {
        observer.observe(element);
    });

    // Newsletter form handling
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = this.querySelector('.newsletter-input').value;
            const submitBtn = this.querySelector('.newsletter-btn');
            const submitText = submitBtn.querySelector('span');
            
            if (!email || !email.includes('@')) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }
            
            // Disable button and show loading state
            submitBtn.disabled = true;
            submitText.textContent = 'Subscribing...';
            
            // Simulate API call (replace with actual endpoint)
            setTimeout(() => {
                showMessage('Thank you for subscribing! Check your email for confirmation.', 'success');
                this.reset();
                submitBtn.disabled = false;
                submitText.textContent = 'Subscribe';
            }, 2000);
        });
    }

    // Hero button interactions
    const heroBtns = document.querySelectorAll('.hero-btn');
    heroBtns.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Feature card interactions
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Floating elements animation
    const floatingIcons = document.querySelectorAll('.floating-icon');
    floatingIcons.forEach((icon, index) => {
        icon.style.animationDelay = `${index * 0.5}s`;
    });

    // Parallax effect for hero background elements
    window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.gradient-orb, .floating-shape');
        
        parallaxElements.forEach(element => {
            const speed = element.classList.contains('gradient-orb') ? 0.5 : 0.3;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });

    // Star animation for testimonials
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        star.style.animationDelay = `${index * 0.2}s`;
    });

    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 100; // Account for header
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Intersection observer for stats animation
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateStats();
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        statsObserver.observe(heroStats);
    }

    // Animate numbers in stats
    function animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(stat => {
            const finalValue = stat.textContent;
            const numericValue = parseInt(finalValue.replace(/[^\d]/g, ''));
            
            if (numericValue) {
                animateNumber(stat, 0, numericValue, finalValue, 2000);
            }
        });
    }

    function animateNumber(element, start, end, originalText, duration) {
        const startTime = performance.now();
        const suffix = originalText.replace(/[\d,]/g, '');
        
        function updateNumber(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(start + (end - start) * easeOutQuart);
            
            element.textContent = currentValue.toLocaleString() + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        }
        
        requestAnimationFrame(updateNumber);
    }

    // Show toast messages
    function showMessage(message, type = 'info') {
        const messagesList = document.querySelector('.messages-list') || createMessagesList();
        
        const messageElement = document.createElement('li');
        messageElement.className = `message-item message-${type}`;
        messageElement.textContent = message;
        
        messagesList.appendChild(messageElement);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, 4000);
    }

    function createMessagesList() {
        const messagesList = document.createElement('ul');
        messagesList.className = 'messages-list';
        document.body.appendChild(messagesList);
        return messagesList;
    }

    // Add loading states to buttons
    const buttons = document.querySelectorAll('button, .btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.type === 'submit' || this.classList.contains('btn')) {
                this.classList.add('loading');
                setTimeout(() => {
                    this.classList.remove('loading');
                }, 2000);
            }
        });
    });

    // Initialize tooltips for feature cards
    const featureCardsWithTooltips = document.querySelectorAll('.feature-card[title]');
    featureCardsWithTooltips.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const tooltip = this.getAttribute('title');
            if (tooltip) {
                showTooltip(this, tooltip);
            }
        });
        
        card.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });

    function showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: var(--text-primary);
            color: white;
            padding: 8px 12px;
            border-radius: var(--radius-sm);
            font-size: 0.9rem;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
        
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 10);
    }

    function hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 300);
        }
    }

    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('mousedown', function() {
        document.body.classList.remove('keyboard-navigation');
    });

    // Performance optimization: Debounce scroll events
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
            // Scroll-based animations can be added here
        }, 16); // ~60fps
    });

    // Initialize lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => {
        imageObserver.observe(img);
    });

    // Handle image loading errors and add loading states
    const heroImg = document.querySelector('.hero-img');
    if (heroImg) {
        // Add loading class
        heroImg.classList.add('loading');
        
        // Handle successful load
        heroImg.addEventListener('load', function() {
            this.classList.remove('loading');
            this.classList.add('loaded');
        });
        
        // Handle load error with fallback
        heroImg.addEventListener('error', function() {
            this.classList.remove('loading');
            this.classList.add('error');
            // You could set a fallback image here if needed
            console.log('Hero image failed to load');
        });
    }

    // Handle logo image loading
    const logoImg = document.querySelector('.logo-img');
    if (logoImg) {
        logoImg.addEventListener('error', function() {
            // Hide the image if it fails to load, keep the text
            this.style.display = 'none';
        });
    }
});