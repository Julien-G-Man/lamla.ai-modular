document.addEventListener('DOMContentLoaded', function() {
    const flashcardWrapper = document.getElementById('flashcard-wrapper');
    const flashcards = document.querySelectorAll('.flashcard');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const flipBtn = document.getElementById('flipBtn');
    const counterSpan = document.getElementById('flashcard-counter');
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    const generateBtn = document.getElementById('generateBtn');

    let currentCardIndex = 0;

    function initFlashcards() {
        if (flashcards.length > 0) {
            flashcards[currentCardIndex].classList.add('active');
            updateUI();
        }
    }

    function updateUI() {
        // Update counter
        counterSpan.textContent = `${currentCardIndex + 1} of ${flashcards.length}`;

        // Update progress bar
        const progress = ((currentCardIndex + 1) / flashcards.length) * 100;
        progressFill.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.round(progress)}%`;

        // Update navigation buttons
        prevBtn.disabled = currentCardIndex === 0;
        nextBtn.disabled = currentCardIndex === flashcards.length - 1;

        // Update active flashcard
        flashcards.forEach((card, index) => {
            card.classList.remove('active', 'flipped');
            if (index === currentCardIndex) {
                card.classList.add('active');
            }
        });
    }

    // Event listeners
    if (flashcards.length > 0) {
        flashcards.forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('flipped');
            });
        });

        prevBtn.addEventListener('click', () => {
            if (currentCardIndex > 0) {
                currentCardIndex--;
                updateUI();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentCardIndex < flashcards.length - 1) {
                currentCardIndex++;
                updateUI();
            }
        });

        flipBtn.addEventListener('click', () => {
            flashcards[currentCardIndex].classList.toggle('flipped');
        });
    }

    // Generate button loading state
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            const originalText = this.innerHTML;
            this.innerHTML = '<div class="loading-spinner"></div> Generating Flashcards...';
            this.disabled = true;

            setTimeout(() => {
                this.innerHTML = originalText;
                this.disabled = false;
            }, 30000);
        });
    }

    // Initialize when page loads
    initFlashcards();
});