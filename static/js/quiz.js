class QuizEngine {
    constructor() {
        this.mcqQuestions = [];
        this.shortQuestions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.flaggedQuestions = new Set();
        this.totalQuestions = 0;
        this.timeRemaining = 0;
        this.timerInterval = null;
        this.isCompletionScreen = false;
        
        this.initializeQuiz();
    }

    initializeQuiz() {
        try {
            this.loadQuestions();
            this.setupEventListeners();
            this.startTimer();
            this.displayCurrentQuestion();
            this.generateQuestionList();
        } catch (error) {
            this.handleError('Failed to initialize quiz: ' + error.message);
        }
    }

    loadQuestions() {
        try {
            const mcqElement = document.getElementById('mcq-questions-json');
            const shortElement = document.getElementById('short-questions-json');
            
            if (!mcqElement || !shortElement) {
                throw new Error('Question data not found');
            }

            this.mcqQuestions = JSON.parse(mcqElement.textContent || '[]');
            this.shortQuestions = JSON.parse(shortElement.textContent || '[]');
            this.totalQuestions = this.mcqQuestions.length + this.shortQuestions.length;

            if (this.totalQuestions === 0) {
                throw new Error('No questions available');
            }

            // Freeze questions to prevent modification
            Object.freeze(this.mcqQuestions);
            Object.freeze(this.shortQuestions);

        } catch (error) {
            this.showErrorScreen(error.message);
            throw error;
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('prev-btn').addEventListener('click', () => this.previousQuestion());
        document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('submit-btn').addEventListener('click', () => this.submitQuiz());

        // Question list modal
        document.getElementById('question-list-btn').addEventListener('click', () => this.showQuestionList());
        document.getElementById('close-question-list').addEventListener('click', () => this.hideQuestionList());

        // Timer toggle
        document.querySelector('.hide-timer-btn').addEventListener('click', () => this.toggleTimer());

        // Flag question
        document.getElementById('flag-question-btn').addEventListener('click', () => this.toggleFlag());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));

        // Modal backdrop click
        document.getElementById('question-list-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideQuestionList();
        });
    }

    startTimer() {
        const quizTime = parseInt(document.getElementById('quiz_time').value, 10) || 10;
        this.timeRemaining = quizTime * 60;
        
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.timeExpired();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timerDisplay = document.getElementById('timer');
        
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Color coding for low time
        if (this.timeRemaining < 300) { // 5 minutes
            timerDisplay.style.color = '#ff6b6b';
        } else if (this.timeRemaining < 600) { // 10 minutes
            timerDisplay.style.color = '#ffa726';
        } else {
            timerDisplay.style.color = '#4ecdc4';
        }
    }

    timeExpired() {
        clearInterval(this.timerInterval);
        this.showNotification('Time is up! Submitting your quiz...', 'warning');
        setTimeout(() => this.submitQuiz(), 1000);
    }

    toggleTimer() {
        const timerDisplay = document.querySelector('.timer');
        const hideBtn = document.querySelector('.hide-timer-btn');
        
        if (timerDisplay.style.visibility !== 'hidden') {
            timerDisplay.style.visibility = 'hidden';
            hideBtn.textContent = 'Show Timer';
        } else {
            timerDisplay.style.visibility = 'visible';
            hideBtn.textContent = 'Hide';
        }
    }

    getCurrentQuestion() {
        if (this.currentQuestionIndex < this.mcqQuestions.length) {
            return {
                ...this.mcqQuestions[this.currentQuestionIndex],
                type: 'mcq',
                globalIndex: this.currentQuestionIndex
            };
        } else {
            const shortIndex = this.currentQuestionIndex - this.mcqQuestions.length;
            return {
                ...this.shortQuestions[shortIndex],
                type: 'short',
                globalIndex: this.currentQuestionIndex
            };
        }
    }

    displayCurrentQuestion() {
        if (this.isCompletionScreen) {
            this.showCompletionScreen();
            return;
        }

        const question = this.getCurrentQuestion();
        if (!question) {
            this.showCompletionScreen();
            return;
        }

        this.updateQuestionHeader(question);
        this.renderQuestionContent(question);
        this.renderAnswerOptions(question);
        this.updateNavigationButtons();
        this.updateFlagUI();
        this.renderMathContent();
    }

    updateQuestionHeader(question) {
        document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
        
        const statusElement = document.getElementById('question-status');
        const isAnswered = this.userAnswers[this.currentQuestionIndex] !== undefined;
        statusElement.textContent = isAnswered ? 'Answered' : 'Not yet answered';
        statusElement.style.color = isAnswered ? '#4ecdc4' : '#ffa726';

        if (this.currentQuestionIndex === this.totalQuestions - 1) {
            statusElement.textContent += ' (Final Question)';
            statusElement.style.fontWeight = 'bold';
        }
    }

    renderQuestionContent(question) {
        const questionMathElement = document.getElementById('question-math');
        questionMathElement.innerHTML = question.question;
        
        const promptElement = document.querySelector('.select-one-prompt');
        promptElement.textContent = question.type === 'mcq' ? 'Select one:' : 'Type your answer:';
    }

    renderAnswerOptions(question) {
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';

        if (question.type === 'mcq') {
            question.options.forEach((option, index) => {
                const letter = String.fromCharCode(65 + index); // A, B, C, D
                const isSelected = this.userAnswers[this.currentQuestionIndex] === letter;
                
                const optionElement = document.createElement('li');
                optionElement.className = `option-item ${isSelected ? 'selected' : ''}`;
                optionElement.innerHTML = `
                    <input type="radio" name="quiz-option" value="${letter}" 
                           id="option-${this.currentQuestionIndex}-${index}" 
                           ${isSelected ? 'checked' : ''}>
                    <label for="option-${this.currentQuestionIndex}-${index}">
                        <span class="option-letter">${letter}.</span>
                        <span class="option-text">${option}</span>
                    </label>
                `;

                optionElement.querySelector('input').addEventListener('change', (e) => {
                    this.userAnswers[this.currentQuestionIndex] = e.target.value;
                    this.displayCurrentQuestion();
                });

                optionsContainer.appendChild(optionElement);
            });
        } else {
            const textareaElement = document.createElement('li');
            textareaElement.className = 'short-answer-container';
            textareaElement.innerHTML = `
                <textarea class="short-answer-input" 
                          placeholder="Type your answer here..." 
                          rows="4">${this.userAnswers[this.currentQuestionIndex] || ''}</textarea>
            `;

            const textarea = textareaElement.querySelector('textarea');
            textarea.addEventListener('input', (e) => {
                this.userAnswers[this.currentQuestionIndex] = e.target.value.trim();
            });

            // Auto-save on blur
            textarea.addEventListener('blur', (e) => {
                this.userAnswers[this.currentQuestionIndex] = e.target.value.trim();
                this.displayCurrentQuestion();
            });

            optionsContainer.appendChild(textareaElement);
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const submitBtn = document.getElementById('submit-btn');

        prevBtn.disabled = this.currentQuestionIndex === 0 && !this.isCompletionScreen;

        if (this.currentQuestionIndex === this.totalQuestions - 1 && !this.isCompletionScreen) {
            nextBtn.innerHTML = '<span>Finish</span><i class="fas fa-check"></i>';
            nextBtn.className = 'prev-next-btn next finish';
            submitBtn.style.display = 'none';
        } else if (this.isCompletionScreen) {
            nextBtn.innerHTML = '<span>Review Quiz</span><i class="fas fa-arrow-left"></i>';
            nextBtn.className = 'prev-next-btn next review';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.innerHTML = '<span>Next</span><i class="fas fa-chevron-right"></i>';
            nextBtn.className = 'prev-next-btn next';
            submitBtn.style.display = 'inline-flex';
        }
    }

    renderMathContent() {
        if (window.MathJax) {
            MathJax.typesetPromise().catch(error => {
                console.warn('MathJax typesetting error:', error);
            });
        }
    }

    previousQuestion() {
        if (this.isCompletionScreen) {
            this.isCompletionScreen = false;
            this.currentQuestionIndex = this.totalQuestions - 1;
        } else if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
        }
        this.displayCurrentQuestion();
    }

    nextQuestion() {
        if (this.isCompletionScreen) {
            this.isCompletionScreen = false;
            this.currentQuestionIndex = this.totalQuestions - 1;
        } else if (this.currentQuestionIndex < this.totalQuestions - 1) {
            this.currentQuestionIndex++;
        } else {
            this.showCompletionScreen();
            return;
        }
        this.displayCurrentQuestion();
    }

    showCompletionScreen() {
        this.isCompletionScreen = true;
        
        const answeredCount = Object.keys(this.userAnswers).filter(key => {
            const answer = this.userAnswers[key];
            return answer !== undefined && answer !== null && answer.toString().trim() !== '';
        }).length;

        document.getElementById('current-question').textContent = 'Quiz Complete';
        document.getElementById('question-status').textContent = 'Ready to Submit';
        document.getElementById('question-status').style.color = '#4ecdc4';

        document.getElementById('question-math').innerHTML = `
            <div class="completion-screen">
                <div class="completion-icon">🎉</div>
                <h2>Quiz Completed!</h2>
                <div class="completion-stats">
                    <div class="stat-item">
                        <span class="stat-value">${answeredCount}</span>
                        <span class="stat-label">Answered</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.totalQuestions - answeredCount}</span>
                        <span class="stat-label">Unanswered</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.totalQuestions}</span>
                        <span class="stat-label">Total</span>
                    </div>
                </div>
                <p>Review your answers or submit the quiz to see your results.</p>
            </div>
        `;

        document.getElementById('options-container').innerHTML = '';
        document.getElementById('flag-question-btn').style.display = 'none';
        this.updateNavigationButtons();
    }

    toggleFlag() {
        if (this.flaggedQuestions.has(this.currentQuestionIndex)) {
            this.flaggedQuestions.delete(this.currentQuestionIndex);
        } else {
            this.flaggedQuestions.add(this.currentQuestionIndex);
        }
        this.updateFlagUI();
    }

    updateFlagUI() {
        const flagIcon = document.getElementById('flag-icon');
        const flagText = document.getElementById('flag-text');
        const isFlagged = this.flaggedQuestions.has(this.currentQuestionIndex);

        if (isFlagged) {
            flagIcon.className = 'fas fa-flag flagged';
            flagIcon.style.color = '#ff6b6b';
            flagText.textContent = 'Flagged';
            flagText.style.color = '#ff6b6b';
        } else {
            flagIcon.className = 'far fa-flag';
            flagIcon.style.color = '';
            flagText.textContent = 'Flag question';
            flagText.style.color = '';
        }
    }

    showQuestionList() {
        this.renderQuestionList();
        document.getElementById('question-list-modal').style.display = 'flex';
    }

    hideQuestionList() {
        document.getElementById('question-list-modal').style.display = 'none';
    }

    renderQuestionList() {
        const container = document.getElementById('question-list-numbers');
        container.innerHTML = '';

        for (let i = 0; i < this.totalQuestions; i++) {
            const button = document.createElement('button');
            button.className = 'question-list-button';
            button.textContent = i + 1;
            
            // Style based on state
            if (i === this.currentQuestionIndex) {
                button.classList.add('current');
            }
            if (this.flaggedQuestions.has(i)) {
                button.classList.add('flagged');
            }
            if (this.userAnswers[i] !== undefined) {
                button.classList.add('answered');
            }

            button.addEventListener('click', () => {
                this.isCompletionScreen = false;
                this.currentQuestionIndex = i;
                this.displayCurrentQuestion();
                this.hideQuestionList();
            });

            container.appendChild(button);
        }
    }

    async submitQuiz() {
        if (!confirm('Are you sure you want to submit your quiz? You cannot change answers after submission.')) {
            return;
        }

        clearInterval(this.timerInterval);
        document.getElementById('submit-btn').disabled = true;
        
        try {
            const response = await fetch(window.quizResultsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.getElementById('csrf_token').value,
                },
                body: JSON.stringify({
                    user_answers: this.userAnswers,
                    total_questions: this.totalQuestions
                })
            });

            const data = await response.json();

            if (data.status === 'ok') {
                this.showNotification('Quiz submitted successfully!', 'success');
                setTimeout(() => {
                    window.location.href = window.quizResultsUrl;
                }, 1000);
            } else {
                throw new Error(data.message || 'Submission failed');
            }
        } catch (error) {
            this.showNotification('Error submitting quiz: ' + error.message, 'error');
            document.getElementById('submit-btn').disabled = false;
        }
    }

    handleKeyboardNavigation(event) {
        if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') {
            return; // Don't interfere with text input
        }

        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousQuestion();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextQuestion();
                break;
            case ' ':
            case 'Spacebar':
                event.preventDefault();
                this.toggleFlag();
                break;
            case 'Escape':
                this.hideQuestionList();
                break;
        }
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    showErrorScreen(message) {
        document.getElementById('question-math').innerHTML = `
            <div class="error-screen">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Quiz Loading Error</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="retry-button">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }

    handleError(error) {
        console.error('Quiz Error:', error);
        this.showNotification('An error occurred: ' + error.message, 'error');
    }
}

// Initialize quiz when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set global URLs from Django template
    window.quizResultsUrl = "{% url 'quiz_results' %}";
    
    try {
        new QuizEngine();
    } catch (error) {
        console.error('Failed to initialize quiz engine:', error);
    }
});