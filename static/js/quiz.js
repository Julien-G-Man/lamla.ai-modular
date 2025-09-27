/* static/js/quiz.js
 * Cleaned and corrected QuizEngine:
 * - Fixed constructor order to correctly bind elements before calculating storageKey.
 * - Fixed timer variable and function name mismatches in constructor and _restoreState.
 * - Ensured unique persistence key based on quiz ID.
 * - Consolidated event listeners into a single setup method.
 * - Cleaned up nextQuestion logic.
 */

class QuizEngine {
    constructor(opts = {}) {
        this.selectors = {
            mcqJson: opts.mcqJson || '#mcq-questions-json',
            shortJson: opts.shortJson || '#short-questions-json',
            timeDisplayCandidates: opts.timeDisplayCandidates || ['#quiz-time', '#timer', '.quiz-time', '#timer-display', '.timer .time', '.time'],
            timeHideBtnCandidates: opts.timeHideBtnCandidates || ['#quiz-hide-btn', '.quiz-hide-btn', '.hide-timer-btn', '#toggle-timer', '.hide-btn'],
            currentQuestionElCandidates: opts.currentQuestionElCandidates || ['#current-question', '.quiz-current-question', '.quiz-current', '#question-number', '#meta-question-number'],
            statusElCandidates: opts.statusElCandidates || ['#question-status', '.quiz-status', '.question-status', '#meta-status'],
            questionMathElCandidates: opts.questionMathElCandidates || ['#question-math', '.quiz-body', '.question-math', '#question-text'],
            optionsContainerCandidates: opts.optionsContainerCandidates || ['#options-container', '.quiz-options', '.options', '#options-list'],
            prevBtnCandidates: opts.prevBtnCandidates || ['#quiz-prev', '#prev-btn', '.prev'],
            nextBtnCandidates: opts.nextBtnCandidates || ['#quiz-next', '#next-btn', '.next'],
            submitBtnCandidates: opts.submitBtnCandidates || ['#submit-btn', '.submit-btn'],
            quizIdInputCandidates: opts.quizIdInputCandidates || ['#quiz-id-val', 'input[name="quiz_id"]'],
            flagBtnCandidates: opts.flagBtnCandidates || ['#flag-question-btn', '.flag-question-btn', '#toggle-flag', '.quiz-flag'],
            questionListBtnCandidates: opts.questionListBtnCandidates || ['#question-list-btn', '.question-list-btn', '#open-panel'],
            questionListModalCandidates: opts.questionListModalCandidates || ['#question-list-modal', '.question-list-modal', '#question-panel'],
            questionListNumbersCandidates: opts.questionListNumbersCandidates || ['#question-list-numbers', '.question-list-numbers', '#question-list'],
            quizTimeInputCandidates: opts.quizTimeInputCandidates || ['#quiz_time', '#quiz_time_val', 'input[name="quiz_time"]', 'input#quiz_time'],
            csrfCandidates: opts.csrfCandidates || ['#csrf-token', '#csrf_token', 'input[name="csrfmiddlewaretoken"]'],
            resultsUrlCandidates: opts.resultsUrlCandidates || ['#quiz-results-url', 'input[name="quiz_results_url"]']
        };

        // runtime state
        this.mcq = [];
        this.short = [];
        this.totalQuestions = 0;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.flaggedQuestions = {};
        this.isCompletionScreen = false;

        // timer state (initial values will be overwritten by _initTimerFromInput or _restoreState)
        this.timeRemaining = 0;
        this.timerInterval = null;
        this.startTime = Date.now();
        this.endTime = this.startTime; // Placeholder

        // UI references (initialized by _bindElements)
        this.timerDisplay = null;
        this.hideTimeBtn = null;
        this.currentQuestionLabels = [];
        this.questionStatusEl = null;
        this.questionMathEl = null;
        this.optionsContainer = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.submitBtn = null;
        this.flagBtn = null;
        this.quizIdInput = null;
        this.questionListBtn = null;
        this.questionListModal = null;
        this.questionListNumbersContainer = null;
        this.csrfInput = null;
        this.quizResultsUrlInput = null;
        
        // other
        this.storageKey = 'lamla_quiz_state_default'; // Placeholder
        this.saveTimer = null;
        this.saveDebounceMs = 500;

        // --- CORE INITIALIZATION SEQUENCE ---

        // 1. Bind elements (REQUIRED to get quiz ID)
        this._bindElements();

        // 2. Calculate unique storage key (Uses the element bound above)
        this.storageKey = this._storageKey();

        // 3. Load questions
        this._loadQuestions();

        // 4. Initialize timer from input or default
        this._initTimerFromInput();

        // 5. Restore previous user state (includes index, answers, and timer state)
        this._restoreState();

        // 6. Check for no questions and adjust UI visibility
        const noQ = document.getElementById('no-questions');
        const qCard = document.getElementById('question-card');
        if (this.totalQuestions === 0) {
            if (noQ) noQ.style.display = 'block';
            if (qCard) qCard.style.display = 'none';
        } else {
            if (noQ) noQ.style.display = 'none';
            if (qCard) qCard.style.display = ''; // let CSS/default show it
        }

        // 7. Setup all event listeners (consolidated to avoid duplicates)
        this._setupEventListeners();

        // 8. Populate the question navigator panel
        this.renderQuestionList();

        // 9. Start timer/Show completion screen based on final state
        if (!this.isCompletionScreen && this.timeRemaining > 0) {
            this._startTimer();
        } else if (this.isCompletionScreen) {
            this.showCompletionScreen();
        } else if (this.timeRemaining <= 0) {
            this._updateTimerDisplay(); // Called without argument
            this.timeExpired(); // Immediately submit if time ran out on last load
        }

        // 10. Finally render the question the user should see
        this.displayQuestion(this.currentQuestionIndex);
    }

    // _attachEventListeners and _setupEventListeners were redundant. Consolidating into _setupEventListeners
    // and removing the empty _attachEventListeners which was called later.

    _chooseSelector(list) {
        for (const sel of list) {
            if (!sel) continue;
            try {
                if (document.querySelector(sel)) return sel;
            } catch (e) {}
        }
        return null;
    }

    _queryCandidate(list) {
        for (const sel of list) {
            try {
                const el = document.querySelector(sel);
                if (el) return el;
            } catch (e) {}
        }
        return null;
    }

    // Generate a unique storage key based on the current path and quiz id
    _storageKey() {
        const path = (window.location.pathname || 'quiz').replace(/[^a-z0-9]+/gi, '_');
        let quizId = 'default';
        if (this.quizIdInput) {
            // Get the unique ID passed from views
            quizId = this.quizIdInput.value || this.quizIdInput.getAttribute('value') || 'default';
        }
        // FIX: Key now includes the unique quiz ID to prevent restoring old state
        return `lamla_quiz_state_${path}_${quizId}`;
    }

    _bindElements() {
        // time numeric display (single)
        this.timerDisplay = this._queryCandidate(this.selectors.timeDisplayCandidates);

        // hide time button
        this.hideTimeBtn = this._queryCandidate(this.selectors.timeHideBtnCandidates);

        // collect all possible question-number labels (we will update all)
        this.currentQuestionLabels = [];
        for (const sel of this.selectors.currentQuestionElCandidates) {
            try {
                const el = document.querySelector(sel);
                if (el) this.currentQuestionLabels.push(el);
            } catch (e) {}
        }
        // if none found try specific fallback ids
        if (!this.currentQuestionLabels.length) {
            ['#question-number', '#meta-question-number'].forEach((id) => {
                const el = document.querySelector(id);
                if (el) this.currentQuestionLabels.push(el);
            });
        }

        this.questionStatusEl = this._queryCandidate(this.selectors.statusElCandidates);

        const mathSel = this._chooseSelector(this.selectors.questionMathElCandidates);
        this.questionMathEl = mathSel ? document.querySelector(mathSel) : null;

        this.optionsContainer = this._queryCandidate(this.selectors.optionsContainerCandidates);

        this.prevBtn = this._queryCandidate(this.selectors.prevBtnCandidates);
        this.nextBtn = this._queryCandidate(this.selectors.nextBtnCandidates);
        this.submitBtn = this._queryCandidate(this.selectors.submitBtnCandidates);
        this.flagBtn = this._queryCandidate(this.selectors.flagBtnCandidates);

        this.quizIdInput = this._queryCandidate(this.selectors.quizIdInputCandidates);

        this.questionListBtn = this._queryCandidate(this.selectors.questionListBtnCandidates);
        this.questionListModal = this._queryCandidate(this.selectors.questionListModalCandidates);
        this.questionListNumbersContainer = this._queryCandidate(this.selectors.questionListNumbersCandidates);

        this.csrfInput = this._queryCandidate(this.selectors.csrfCandidates);
        this.quizResultsUrlInput = this._queryCandidate(this.selectors.resultsUrlCandidates);
    }

    _parseJSONFromScriptId(id) {
        if (!id) return [];
        const el = document.getElementById(id.replace(/^#/, ''));
        if (!el) return [];
        try {
            return JSON.parse(el.textContent || '[]');
        } catch (e) {
            console.error('Error parsing JSON from', id, e);
            return [];
        }
    }

    _loadQuestions() {
        try {
            const mcqEl = document.querySelector(this.selectors.mcqJson) || document.getElementById((this.selectors.mcqJson || '').replace(/^#/, ''));
            this.mcq = mcqEl ? JSON.parse(mcqEl.textContent || '[]') : [];
        } catch (e) {
            console.error('Error parsing mcq JSON:', e);
            this.mcq = [];
        }
        try {
            const shortEl = document.querySelector(this.selectors.shortJson) || document.getElementById((this.selectors.shortJson || '').replace(/^#/, ''));
            this.short = shortEl ? JSON.parse(shortEl.textContent || '[]') : [];
        } catch (e) {
            console.error('Error parsing short JSON:', e);
            this.short = [];
        }

        if (!this.mcq.length) {
            const mcqScript = document.getElementById('mcq-questions-json');
            if (mcqScript) {
                try {
                    this.mcq = JSON.parse(mcqScript.textContent || '[]');
                } catch (e) {
                    this.mcq = [];
                }
            }
        }
        if (!this.short.length) {
            const shortScript = document.getElementById('short-questions-json');
            if (shortScript) {
                try {
                    this.short = JSON.parse(shortScript.textContent || '[]');
                } catch (e) {
                    this.short = [];
                }
            }
        }

        this.totalQuestions = this.mcq.length + this.short.length;
        Object.freeze(this.mcq);
        Object.freeze(this.short);
        console.info(`QuizEngine loaded ${this.mcq.length} MCQ and ${this.short.length} short questions`);
    }

    /* Timer: initialize from hidden input (minutes) */
    _initTimerFromInput() {
        // If the time was restored from localStorage, _restoreState handles it.
        if (this.endTime > this.startTime && this.timeRemaining > 0) {
            this._updateTimerDisplay();
            return;
        }

        let quizTimeMinutes = null;
        for (const sel of this.selectors.quizTimeInputCandidates) {
            try {
                const el = document.querySelector(sel);
                if (el) {
                    const val = el.value || el.textContent || el.getAttribute('value') || '';
                    const intv = parseInt(val, 10);
                    if (!Number.isNaN(intv)) {
                        quizTimeMinutes = intv;
                        break;
                    }
                }
            } catch (e) {}
        }

        // Default to 10 minutes if not found
        if (!quizTimeMinutes || Number.isNaN(quizTimeMinutes)) quizTimeMinutes = 10;

        // Initialize time variables correctly
        this.timeRemaining = quizTimeMinutes * 60;
        this.startTime = Date.now();
        this.endTime = this.startTime + (this.timeRemaining * 1000);

        if (this.timerDisplay) this._updateTimerDisplay();
    }

    /* Timer: Start the countdown interval */
    _startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (this.timeRemaining > 0) {
                this.timeRemaining--;
                this._updateTimerDisplay();
            } else {
                clearInterval(this.timerInterval);
                this.timeExpired();
            }
        }, 1000);
    }

    /* Always show H:MM:SS (hours may be 0 like sample "0:13:33") */
    _updateTimerDisplay() {
        if (!this.timerDisplay) return;
        const h = Math.floor(this.timeRemaining / 3600);
        const m = Math.floor((this.timeRemaining % 3600) / 60);
        const s = this.timeRemaining % 60;
        const hh = String(h);
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        this.timerDisplay.textContent = `${hh}:${mm}:${ss}`;

        // color thresholds
        if (this.timeRemaining < 300) this.timerDisplay.style.color = '#ff6b6b';
        else if (this.timeRemaining < 600) this.timerDisplay.style.color = '#ffa726';
        else this.timerDisplay.style.color = '#4ecdc4';
    }

    timeExpired() {
        this.showNotification('Time is up! Submitting your quiz...', 'warning');
        setTimeout(() => this.submitQuiz(true), 800);
    }

    getCurrentQuestion() {
        if (this.currentQuestionIndex < this.mcq.length) {
            return { ...this.mcq[this.currentQuestionIndex], type: 'mcq', globalIndex: this.currentQuestionIndex };
        }
        const shortIndex = this.currentQuestionIndex - this.mcq.length;
        const q = this.short[shortIndex];
        return q ? { ...q, type: 'short', globalIndex: this.currentQuestionIndex } : null;
    }

    displayQuestion() {
        if (this.currentQuestionIndex >= this.totalQuestions) {
          this.showCompletionScreen();
          return;
        }
        if (this.totalQuestions === 0) {
            if (this.questionMathEl) this.questionMathEl.innerHTML = '<span style="color:red">No questions available.</span>';
            return;
        }
        if (this.isCompletionScreen) {
            this.showCompletionScreen();
            return;
        }
        const q = this.getCurrentQuestion();
        if (!q) {
            this.showCompletionScreen();
            return;
        }

        // update *all* question-number labels discovered
        const labelText = `Question ${this.currentQuestionIndex + 1}`;
        if (Array.isArray(this.currentQuestionLabels) && this.currentQuestionLabels.length) {
            this.currentQuestionLabels.forEach(el => {
                try {
                    el.textContent = labelText;
                } catch (e) {}
            });
        }

        // status
        if (this.questionStatusEl) {
            const answered = !!this.userAnswers[this.currentQuestionIndex];
            this.questionStatusEl.textContent = answered ? 'Answered' : 'Not yet answered';
            this.questionStatusEl.style.color = answered ? '#4ecdc4' : '#ffa726';
        }

        // render question HTML
        if (this.questionMathEl) this.questionMathEl.innerHTML = q.question || '';

        // render options
        this._renderOptionsForQuestion(q);

        // update flag UI
        this._updateFlagUI();

        // nav buttons
        if (this.prevBtn) this.prevBtn.disabled = this.currentQuestionIndex === 0;
        if (this.nextBtn) {
            if (this.currentQuestionIndex === this.totalQuestions - 1) {
                this.nextBtn.innerHTML = 'Finish';
                this.nextBtn.style.background = '#28a745';
            } else {
                this.nextBtn.innerHTML = 'Next ▶';
                this.nextBtn.style.background = '';
                this.nextBtn.disabled = false;
            }
        }

        // MathJax
        if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
            MathJax.typesetPromise().catch(e => console.warn('MathJax typeset error', e));
        }

        // update panel active
        this._updatePanelActive();
    }

    _renderOptionsForQuestion(q) {
        const container = this.optionsContainer || document.querySelector('.quiz-options') || document.getElementById('options-list');
        if (!container) {
            console.warn('No options container available for rendering');
            return;
        }
        container.innerHTML = '';

        if (q.type === 'mcq') {
            (q.options || []).forEach((opt, idx) => {
                const letter = String.fromCharCode(65 + idx); // A,B,C...
                const li = document.createElement('li');
                const inputId = `qopt-${q.globalIndex}-${idx}`;
                li.innerHTML = `<input type="radio" id="${inputId}" name="qopt-${q.globalIndex}" value="${letter}"><label for="${inputId}"><span>${letter}. ${opt}</span></label>`;
                const radio = li.querySelector('input[type="radio"]');
                // restore checked state from stored answers
                if (this.userAnswers[q.globalIndex] === letter) radio.checked = true;
                radio.addEventListener('change', (e) => {
                    this.userAnswers[q.globalIndex] = e.target.value;
                    this._debouncedSave();
                    if (this.questionStatusEl) {
                        this.questionStatusEl.textContent = 'Answered';
                        this.questionStatusEl.style.color = '#4ecdc4';
                    }
                    this._updatePanelActive();
                });
                container.appendChild(li);
            });
        } else {
            // short answer
            const li = document.createElement('li');
            li.innerHTML = `<textarea class="short-answer" id="short-${q.globalIndex}" placeholder="Type your answer..."></textarea>`;
            container.appendChild(li);
            const ta = li.querySelector('textarea');
            ta.value = this.userAnswers[q.globalIndex] || '';
            ta.addEventListener('input', (e) => {
                this.userAnswers[q.globalIndex] = e.target.value;
                this._debouncedSave();
                this._updatePanelActive();
            });
            ta.addEventListener('blur', (e) => {
                this.userAnswers[q.globalIndex] = e.target.value.trim();
                this._debouncedSave();
            });
        }
    }

    toggleFlag() {
        const idx = this.currentQuestionIndex;
        if (this.flaggedQuestions[idx]) delete this.flaggedQuestions[idx];
        else this.flaggedQuestions[idx] = true;
        this._debouncedSave();
        this._updateFlagUI();
        this._renderPanel();
    }

    _updateFlagUI() {
        const flagged = !!this.flaggedQuestions[this.currentQuestionIndex];
        if (this.flagBtn) this.flagBtn.setAttribute('aria-pressed', String(flagged));
        const indicator = document.getElementById('flag-indicator');
        if (indicator) indicator.classList.toggle('flagged', flagged);
        this._updatePanelActive();
    }

    renderQuestionList() {
        const container = this.questionListNumbersContainer || document.querySelector('#question-list');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < this.totalQuestions; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = (i + 1).toString();
            btn.className = 'question-btn';
            if (this.flaggedQuestions[i]) btn.classList.add('flagged');
            if (this.userAnswers[i] !== undefined && this.userAnswers[i] !== '') btn.classList.add('answered');
            if (i === this.currentQuestionIndex) btn.classList.add('current');
            btn.addEventListener('click', () => {
                this.isCompletionScreen = false;
                this.currentQuestionIndex = i;
                this.displayQuestion();
                if (this.questionListModal && this.questionListModal.classList.contains('active')) this.questionListModal.classList.remove('active');
            });
            container.appendChild(btn);
        }
    }

    _updatePanelActive() {
        const container = this.questionListNumbersContainer || document.querySelector('#question-list');
        if (!container) return;
        const children = Array.from(container.children);
        children.forEach((el, i) => {
            el.classList.toggle('current', i === this.currentQuestionIndex);
            el.classList.toggle('answered', this.userAnswers.hasOwnProperty(i) && this.userAnswers[i] !== '');
            el.classList.toggle('flagged', !!this.flaggedQuestions[i]);
        });
    }

    previousQuestion() {
        if (this.isCompletionScreen) {
            this.isCompletionScreen = false;
            this.currentQuestionIndex = Math.max(0, this.totalQuestions - 1);
        } else if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
        }
        this.displayQuestion();
        this._debouncedSave();
    }

    nextQuestion() {
        if (this.isCompletionScreen) {
            // If on completion screen, allow nav back to the last question
            this.isCompletionScreen = false;
            this.currentQuestionIndex = this.totalQuestions - 1;
        } else if (this.currentQuestionIndex < this.totalQuestions - 1) {
            this.currentQuestionIndex++;
        } else if (this.currentQuestionIndex === this.totalQuestions - 1) {
            // User is on the last question, so show completion screen and return
            this.showCompletionScreen();
            this._debouncedSave();
            return;
        } else {
            // Safety: If somehow currentQuestionIndex >= totalQuestions, stop here
            this.showCompletionScreen();
            this._debouncedSave();
            return;
        }
        this.displayQuestion();
        this._debouncedSave();
    }

    showCompletionScreen() {
        this.isCompletionScreen = true;
        const answeredCount = Object.keys(this.userAnswers).filter(k => {
            const v = this.userAnswers[k];
            return v !== undefined && v !== null && String(v).trim() !== '';
        }).length;

        if (this.questionMathEl) {
            this.questionMathEl.innerHTML = `
                <div style="text-align:center;padding:16px">
                    <div style="font-size:2.25rem">🎉</div>
                    <h2>Quiz Completed</h2>
                    <div class="muted">${answeredCount} of ${this.totalQuestions} answered</div>
                </div>`;
        }
        if (this.optionsContainer) this.optionsContainer.innerHTML = '';
        if (this.prevBtn) this.prevBtn.disabled = true;
        if (this.nextBtn) {
            this.nextBtn.disabled = true;
            this.nextBtn.style.display = 'none';
        }
        this._debouncedSave();

        // Ensure Submit Button is visible and active
        if (this.submitBtn) {
            this.submitBtn.style.display = 'inline-block';
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = 'Submit Quiz & View Results';
        }

        // HIDE THE STATIC COMPLETION SCREEN in the main body
        const staticCompletionScreen = document.getElementById('quiz-completion-screen');
        if (staticCompletionScreen) staticCompletionScreen.style.display = 'none';

        // Stop timer
        if (this.timerInterval) clearInterval(this.timerInterval);
        this._debouncedSave();
    }

    _debouncedSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this._saveState(), this.saveDebounceMs);
    }

    _saveState() {
        try {
            const payload = {
                currentQuestionIndex: this.currentQuestionIndex,
                userAnswers: this.userAnswers,
                flaggedQuestions: this.flaggedQuestions,
                endTime: this.endTime,
                timestamp: (new Date()).toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(payload));
        } catch (e) {
            console.warn('Failed to save quiz state', e);
        }
    }

    _restoreState() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw);
            if (parsed) {
                if (typeof parsed.currentQuestionIndex === 'number') this.currentQuestionIndex = parsed.currentQuestionIndex;
                if (parsed.userAnswers) this.userAnswers = parsed.userAnswers;
                if (parsed.flaggedQuestions) this.flaggedQuestions = parsed.flaggedQuestions;

                // Restore and recalculate time remaining
                if (parsed.endTime) {
                    const currentTime = Date.now();
                    this.endTime = parsed.endTime;

                    // FIX: Calculate remaining time and update the correct engine property: this.timeRemaining
                    this.timeRemaining = Math.max(0, Math.floor((this.endTime - currentTime) / 1000));

                    // Mark as completed if time is up, preventing timer from restarting
                    if (this.timeRemaining <= 0) {
                        this.isCompletionScreen = true;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to restore state', e);
        }
    }

    downloadResults() {
        const resultObj = {
            generated_at: (new Date()).toISOString(),
            questions: {
                mcq: this.mcq,
                short: this.short
            },
            answers: this.userAnswers,
            flagged: this.flaggedQuestions
        };
        const blob = new Blob([JSON.stringify(resultObj, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz_export_${(new Date()).toISOString().replace(/[:.]/g,'-')}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async submitQuiz(isAutoSubmit = false) {
        if (!isAutoSubmit && !confirm('Submit quiz? You will not be able to edit answers after submission.')) return;
        const payload = {
            user_answers: this.userAnswers,
            flagged_questions: this.flaggedQuestions,
            total_questions: this.totalQuestions,
        };
        const csfel = this.csrfInput || document.querySelector('input[name="csrfmiddlewaretoken"]');
        const csrfToken = csfel ? (csfel.value || csfel.getAttribute('value')) : '';
        const resultsUrlEl = this.quizResultsUrlInput || document.querySelector('input[name="quiz_results_url"], #quiz-results-url');
        const resultsUrl = (resultsUrlEl && (resultsUrlEl.value || resultsUrlEl.getAttribute('value'))) || window.quizResultsUrl || '/quiz/results/';

        try {
            const resp = await fetch(resultsUrl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(payload)
            });
            const data = await resp.json();
            if (data && data.status === 'ok') {
                localStorage.removeItem(this.storageKey);
                this.showNotification('Quiz submitted successfully!', 'success');
                setTimeout(() => {
                    window.location.href = resultsUrl;
                }, 700);
            } else {
                throw new Error((data && data.message) ? data.message : 'Submission failed');
            }
        } catch (e) {
            console.error('Submit failed', e);
            this.showNotification('Failed to submit quiz: ' + (e.message || e), 'error');
        }
    }

    _setupEventListeners() {
        // Primary Nav
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextQuestion());
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.previousQuestion());
        if (this.flagBtn) this.flagBtn.addEventListener('click', () => this.toggleFlag());
        if (this.submitBtn) this.submitBtn.addEventListener('click', () => this.submitQuiz());

        // FIX: The event listeners below were previously in a separate, redundant _attachEventListeners function.

        const dlBtn = document.getElementById('quiz-download') || document.querySelector('.download-btn');
        if (dlBtn) dlBtn.addEventListener('click', () => this.downloadResults());

        // This selector is fine for the main submit button logic, but it duplicates the earlier this.submitBtn listener
        // const submitBtn = document.getElementById('quiz-submit') || this.submitBtn || document.querySelector('.submit-btn');
        // if (submitBtn) submitBtn.addEventListener('click', ()=> this.submitQuiz());

        const openPanelBtn = this.questionListBtn || document.getElementById('open-panel');
        if (openPanelBtn) openPanelBtn.addEventListener('click', () => {
            if (this.questionListModal) {
                this.questionListModal.classList.toggle('active');
                const hidden = !this.questionListModal.classList.contains('active');
                this.questionListModal.setAttribute('aria-hidden', String(hidden));
            } else {
                const panel = document.getElementById('question-panel');
                if (panel) panel.classList.toggle('active');
            }
            this.renderQuestionList();
        });

        if (this.questionListModal) {
            this.questionListModal.addEventListener('click', (e) => {
                if (e.target === this.questionListModal) {
                    this.questionListModal.classList.remove('active');
                    this.questionListModal.setAttribute('aria-hidden', 'true');
                }
            });
        }

        // time hide: toggle class on the numeric time element only
        if (this.hideTimeBtn) {
            this.hideTimeBtn.addEventListener('click', () => {
                if (!this.timerDisplay) return;
                const hidden = this.timerDisplay.classList.toggle('quiz-time--hidden');
                this.hideTimeBtn.textContent = hidden ? 'Show' : 'Hide';
                this.hideTimeBtn.setAttribute('aria-pressed', String(hidden));
            });
        }

        // keyboard nav
        document.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'TEXTAREA' || tag === 'INPUT') return;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.previousQuestion();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.nextQuestion();
            }
            if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                this.toggleFlag();
            }
            if (e.key === 'Escape') {
                if (this.questionListModal && this.questionListModal.classList.contains('active')) {
                    this.questionListModal.classList.remove('active');
                    this.questionListModal.setAttribute('aria-hidden', 'true');
                }
                const panel = document.getElementById('question-panel');
                if (panel && panel.classList.contains('active')) panel.classList.remove('active');
            }
        });

        // Save state before window closes
        window.addEventListener('beforeunload', () => this._saveState());
    }

    _renderPanel() {
        this.renderQuestionList();
    }

    showNotification(msg, type = 'info') {
        let toast = document.getElementById('quiz-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'quiz-toast';
            toast.style.position = 'fixed';
            toast.style.right = '20px';
            toast.style.top = '100px';
            toast.style.padding = '12px 18px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = 9999;
            toast.style.color = '#fff';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.background = (type === 'error') ? '#ef4444' : (type === 'success') ? '#10b981' : '#3b82f6';
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3500);
    }
}

/* Initialize */
document.addEventListener('DOMContentLoaded', function() {
    try {
        window.quizEngine = new QuizEngine();
        console.info('QuizEngine initialized.');
    } catch (e) {
        console.error('Failed to initialize QuizEngine', e);
    }
});