/* File: static/js/quiz.js
   Usage: include <script src="{% static 'js/quiz.js' %}"></script> at the bottom of your page.
   The script auto-detects IDs/containers commonly used in your templates.
*/

class QuizEngine {
  constructor(opts = {}) {
    // Options / selector fallbacks (you can extend if needed)
    this.selectors = {
      mcqJson: '#mcq-questions-json',
      shortJson: '#short-questions-json',
      // timer/display
      timeDisplayCandidates: ['#quiz-time', '#timer', '.quiz-time'],
      timeHideBtnCandidates: ['#quiz-hide-btn', '.quiz-hide-btn', '.hide-timer-btn'],
      // question placeholders
      currentQuestionEl: this._chooseSelector(['#current-question', '.quiz-current-question', '.quiz-current']),
      statusEl: this._chooseSelector(['#question-status', '.quiz-status', '.question-status']),
      questionMathEl: this._chooseSelector(['#question-math', '.quiz-body', '.question-math']),
      optionsContainerEl: this._chooseSelector(['#options-container', '.quiz-options', '.options', '#options']),
      // nav & actions
      prevBtnCandidates: ['#quiz-prev', '#prev-btn', '.prev'],
      nextBtnCandidates: ['#quiz-next', '#next-btn', '.next'],
      submitBtnCandidates: ['#submit-btn', '.submit-btn'],
      flagBtnCandidates: ['#flag-question-btn', '.flag-question-btn', '.quiz-flag'],
      flagIconCandidates: ['#flag-icon', '.flag-icon'],
      questionListBtnCandidates: ['#question-list-btn', '.question-list-btn'],
      questionListModalCandidates: ['#question-list-modal', '.question-list-modal'],
      questionListNumbersCandidates: ['#question-list-numbers', '.question-list-numbers'],
      // hidden values / urls
      quizTimeInput: ['#quiz_time', '#quiz_time_val', 'input[name="quiz_time"]', 'input#quiz_time'],
      csrfCandidates: ['#csrf_token', 'input[name="csrfmiddlewaretoken"]'],
      resultsUrlCandidates: ['#quiz-results-url', 'input[name="quiz_results_url"]'] // fallback
    };

    // runtime state
    this.mcq = [];
    this.short = [];
    this.totalQuestions = 0;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};       // {index: answer}
    this.flaggedQuestions = {};  // {index: true}
    this.isCompletionScreen = false;

    // timer state
    this.timeRemaining = 0;
    this.timerInterval = null;

    // init
    this._bindElements();
    this._loadQuestions();
    this._initTimerFromInput();
    this._setupEventListeners();
    this.displayQuestion();
    // generate list if modal exists
    if (this.questionListNumbersContainer) this.renderQuestionList();
  }

  /* ----------------------
     Utility helpers
     ---------------------- */
  _chooseSelector(list) {
    for (const sel of list) {
      if (document.querySelector(sel)) return sel;
    }
    return null;
  }

  _queryCandidate(list) {
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  _bindElements() {
    // timer elements
    this.timeDisplay = this._queryCandidate(this.selectors.timeDisplayCandidates);
    this.hideTimeBtn = this._queryCandidate(this.selectors.timeHideBtnCandidates);

    // core placeholders
    this.currentQuestionLabel = this.selectors.currentQuestionEl ? document.querySelector(this.selectors.currentQuestionEl) : null;
    this.questionStatusEl = this.selectors.statusEl ? document.querySelector(this.selectors.statusEl) : null;
    this.questionMathEl = this.selectors.questionMathEl ? document.querySelector(this.selectors.questionMathEl) : null;
    this.optionsContainer = this._queryCandidate(this.selectors.optionsContainerEl instanceof Array ? this.selectors.optionsContainerEl : [this.selectors.optionsContainerEl]) || document.querySelector(this.selectors.optionsContainerEl);

    // navigation & buttons (try candidate lists)
    this.prevBtn = this._queryCandidate(this.selectors.prevBtnCandidates);
    this.nextBtn = this._queryCandidate(this.selectors.nextBtnCandidates);
    this.submitBtn = this._queryCandidate(this.selectors.submitBtnCandidates);
    this.flagBtn = this._queryCandidate(this.selectors.flagBtnCandidates);

    // question list modal
    this.questionListBtn = this._queryCandidate(this.selectors.questionListBtnCandidates);
    this.questionListModal = this._queryCandidate(this.selectors.questionListModalCandidates);
    this.questionListNumbersContainer = this._queryCandidate(this.selectors.questionListNumbersCandidates);

    // hidden inputs
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
    // there might be either script tags with id "mcq-questions-json" or "mcq-questions-json"
    const mcqEl = document.getElementById('mcq-questions-json');
    const shortEl = document.getElementById('short-questions-json');

    try {
      this.mcq = mcqEl ? JSON.parse(mcqEl.textContent || '[]') : [];
    } catch (e) {
      console.error('Error parsing mcq JSON:', e);
      this.mcq = [];
    }
    try {
      this.short = shortEl ? JSON.parse(shortEl.textContent || '[]') : [];
    } catch (e) {
      console.error('Error parsing short JSON:', e);
      this.short = [];
    }

    // freeze to prevent changes
    Object.freeze(this.mcq);
    Object.freeze(this.short);

    this.totalQuestions = this.mcq.length + this.short.length;
    if (this.totalQuestions === 0) {
      console.warn('QuizEngine: no questions found (mcq and short arrays are empty).');
      // still continue - displayQuestion will handle it
    }
    console.info(`QuizEngine: loaded ${this.mcq.length} MCQ and ${this.short.length} short questions.`);
  }

  _initTimerFromInput() {
    // read quiz time from hidden input values (supports multiple possible names)
    let quizTimeMinutes = null;
    const candidates = this.selectors.quizTimeInput;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) {
        quizTimeMinutes = parseInt(el.value || el.textContent || el.getAttribute('value'), 10);
        if (!Number.isNaN(quizTimeMinutes)) break;
      }
    }
    if (!quizTimeMinutes || Number.isNaN(quizTimeMinutes)) quizTimeMinutes = 10; // fallback 10 minutes

    this.timeRemaining = quizTimeMinutes * 60;
    // set initial display
    this._updateTimerDisplay();

    // start interval
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

  _updateTimerDisplay() {
    const minutes = Math.floor(this.timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (this.timeRemaining % 60).toString().padStart(2, '0');
    if (this.timeDisplay) this.timeDisplay.textContent = `${minutes}:${seconds}`;

    // optional color hints if using a single element:
    if (this.timeDisplay) {
      if (this.timeRemaining < 300) {
        this.timeDisplay.style.color = '#ff6b6b';
      } else if (this.timeRemaining < 600) {
        this.timeDisplay.style.color = '#ffa726';
      } else {
        this.timeDisplay.style.color = '#4ecdc4';
      }
    }
  }

  timeExpired() {
    this.showNotification('Time is up! Submitting your quiz...', 'warning');
    // give a moment and then submit
    setTimeout(() => this.submitQuiz(), 800);
  }

  /* ----------------------
     Render / UI Helpers
     ---------------------- */

  getCurrentQuestion() {
    if (this.currentQuestionIndex < this.mcq.length) {
      return { ...this.mcq[this.currentQuestionIndex], type: 'mcq', globalIndex: this.currentQuestionIndex };
    } else {
      const shortIndex = this.currentQuestionIndex - this.mcq.length;
      const q = this.short[shortIndex];
      return q ? { ...q, type: 'short', globalIndex: this.currentQuestionIndex } : null;
    }
  }

  displayQuestion() {
    if (this.totalQuestions === 0) {
      // no questions: show friendly message if questionMathEl exists
      if (this.questionMathEl) {
        this.questionMathEl.innerHTML = '<span style="color:red">No questions available. Please check your input or contact support.</span>';
      }
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

    // update header / status if elements exist
    if (this.currentQuestionLabel) this.currentQuestionLabel.textContent = (this.currentQuestionIndex + 1).toString();
    if (this.questionStatusEl) {
      const answered = !!this.userAnswers[this.currentQuestionIndex];
      this.questionStatusEl.textContent = answered ? 'Answered' : 'Not yet answered';
      this.questionStatusEl.style.color = answered ? '#4ecdc4' : '#ffa726';
      if (this.currentQuestionIndex === this.totalQuestions - 1) {
        this.questionStatusEl.textContent += ' (Final Question)';
        this.questionStatusEl.style.fontWeight = 'bold';
      }
    }

    // question HTML injection
    if (this.questionMathEl) this.questionMathEl.innerHTML = q.question || '';

    // set prompt text if present (optional)
    const selectPrompt = document.querySelector('.select-one-prompt');
    if (selectPrompt) {
      selectPrompt.textContent = q.type === 'mcq' ? 'Select one:' : 'Type your answer here:';
    }

    // render options
    this._renderOptionsForQuestion(q);
    // update nav state
    this._updateNavButtons();
    // update flags display if any
    this._updateFlagUI();
    // typeset math if MathJax exists
    if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
      MathJax.typesetPromise().catch(e => console.warn('MathJax error', e));
    }
  }

  _renderOptionsForQuestion(q) {
    // Normalise options container: prefer explicit optionsContainer, else try quiz-options ul
    const container =
      this.optionsContainer ||
      document.querySelector('.quiz-options') ||
      document.querySelector('.options') ||
      document.getElementById('options-container');

    if (!container) {
      console.warn('No options container found — cannot render options.');
      return;
    }

    container.innerHTML = ''; // clear

    if (q.type === 'mcq') {
      q.options.forEach((opt, idx) => {
        // letter a, b, c ... (lowercase to match earlier templates)
        const letter = String.fromCharCode(97 + idx);
        const li = document.createElement('li');

        // Use the "boxed option" structure to match CSS:
        // <input type="radio" id="q-<global>-<idx>" name="quizOption" value="a"><label for="id">a. Option text</label>
        const inputId = `quiz-opt-${q.globalIndex}-${idx}`;
        li.innerHTML = `
          <input type="radio" id="${inputId}" name="quiz-option" value="${letter}">
          <label for="${inputId}">${letter}. ${opt}</label>
        `;
        // restore selected if present
        const input = li.querySelector('input[type="radio"]');
        if (this.userAnswers[q.globalIndex] === letter) {
          input.checked = true;
        }

        input.addEventListener('change', (e) => {
          this.userAnswers[q.globalIndex] = e.target.value;
          // re-render to update state and styles
          this.displayQuestion();
        });

        container.appendChild(li);
      });
    } else {
      // short answer: render text input / textarea
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="text" class="short-answer-input" value="${this.userAnswers[q.globalIndex] || ''}" placeholder="Type your answer here..." />
      `;
      const input = li.querySelector('input, textarea');
      input.addEventListener('input', (e) => {
        this.userAnswers[q.globalIndex] = e.target.value;
      });
      input.addEventListener('blur', (e) => {
        this.userAnswers[q.globalIndex] = e.target.value.trim();
        this.displayQuestion();
      });
      container.appendChild(li);
    }
  }

  _updateNavButtons() {
    // Prev/next semantics: button text and disabling. Use either candidate elements.
    const prev = this.prevBtn || document.querySelector('#prev-btn') || document.querySelector('.prev');
    const next = this.nextBtn || document.querySelector('#next-btn') || document.querySelector('.next');
    const submit = this.submitBtn || document.querySelector('#submit-btn') || document.querySelector('.submit-btn');

    if (prev) prev.disabled = (this.currentQuestionIndex === 0 && !this.isCompletionScreen);
    if (next) {
      if (this.currentQuestionIndex === this.totalQuestions - 1 && !this.isCompletionScreen) {
        next.innerHTML = '<span>Finish</span>';
        next.style.background = '#28a745';
        next.style.color = '#fff';
      } else if (this.isCompletionScreen) {
        next.innerHTML = '<span>Review Quiz</span>';
      } else {
        next.innerHTML = '<span>Next</span>';
        next.style.background = ''; next.style.color = '';
      }
    }
    if (submit) {
      submit.style.display = (this.currentQuestionIndex === this.totalQuestions - 1 && !this.isCompletionScreen) ? 'none' : 'inline-flex';
    }
  }

  showCompletionScreen() {
    this.isCompletionScreen = true;
    const answeredCount = Object.keys(this.userAnswers).filter(k => {
      const a = this.userAnswers[k];
      return a !== undefined && a !== null && String(a).trim() !== '';
    }).length;

    if (this.currentQuestionLabel) this.currentQuestionLabel.textContent = 'Quiz Complete';
    if (this.questionStatusEl) {
      this.questionStatusEl.textContent = 'Ready to Submit';
      this.questionStatusEl.style.color = '#4ecdc4';
      this.questionStatusEl.style.fontWeight = 'bold';
    }
    if (this.questionMathEl) {
      this.questionMathEl.innerHTML = `
        <div class="completion-screen" style="padding:20px;text-align:center;">
          <div style="font-size:3rem;color:#28a745;margin-bottom:10px;">🎉</div>
          <h2>Quiz Completed!</h2>
          <p>Answered ${answeredCount} of ${this.totalQuestions} questions.</p>
        </div>
      `;
    }
    const optionsContainer = this.optionsContainer || document.querySelector('.quiz-options') || document.getElementById('options-container');
    if (optionsContainer) optionsContainer.innerHTML = '';
    if (this.flagBtn) this.flagBtn.style.display = 'none';
    this._updateNavButtons();
  }

  /* ----------------------
     Events & Listeners
     ---------------------- */
  _setupEventListeners() {
    // Prev / Next / Submit
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.previousQuestion());
    const actualPrev = document.querySelector('#prev-btn');
    if (actualPrev) actualPrev.addEventListener('click', () => this.previousQuestion());

    if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextQuestion());
    const actualNext = document.querySelector('#next-btn');
    if (actualNext) actualNext.addEventListener('click', () => this.nextQuestion());

    if (this.submitBtn) this.submitBtn.addEventListener('click', () => this.submitQuiz());
    const actualSubmit = document.querySelector('#submit-btn');
    if (actualSubmit) actualSubmit.addEventListener('click', () => this.submitQuiz());

    // flag button
    const flagBtn = this.flagBtn || document.querySelector('#flag-question-btn');
    if (flagBtn) flagBtn.addEventListener('click', () => this.toggleFlag());

    // timer hide: DO NOT hide the whole bar, only hide the digits element
    const hideBtn = this.hideTimeBtn || document.querySelector('.hide-timer-btn');
    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        const timeEl = this.timeDisplay || document.querySelector('#timer') || document.querySelector('.quiz-time');
        if (!timeEl) return;
        if (timeEl.classList.contains('quiz-time--hidden')) {
          timeEl.classList.remove('quiz-time--hidden');
          hideBtn.textContent = 'Hide';
        } else {
          timeEl.classList.add('quiz-time--hidden');
          hideBtn.textContent = 'Show';
        }
      });
    }

    // question list modal open/close
    if (this.questionListBtn) this.questionListBtn.addEventListener('click', () => {
      if (this.questionListModal) this.questionListModal.style.display = 'flex';
      this.renderQuestionList();
    });
    if (this.questionListModal) {
      this.questionListModal.addEventListener('click', (e) => {
        if (e.target === this.questionListModal) this.questionListModal.style.display = 'none';
      });
    }

    // keyboard nav
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.previousQuestion(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.nextQuestion(); }
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); this.toggleFlag(); }
      if (e.key === 'Escape' && this.questionListModal) this.questionListModal.style.display = 'none';
    });
  }

  previousQuestion() {
    if (this.isCompletionScreen) {
      this.isCompletionScreen = false;
      this.currentQuestionIndex = this.totalQuestions - 1;
    } else if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
    this.displayQuestion();
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
    this.displayQuestion();
  }

  toggleFlag() {
    const idx = this.currentQuestionIndex;
    if (this.flaggedQuestions[idx]) {
      delete this.flaggedQuestions[idx];
    } else {
      this.flaggedQuestions[idx] = true;
    }
    this._updateFlagUI();
  }

  _updateFlagUI() {
    // find flag icon / text
    const flagIcon = document.querySelector('#flag-icon') || document.querySelector('.flag-icon');
    const flagText = document.querySelector('#flag-text') || document.querySelector('.flag-text') || document.querySelector('.quiz-flag');

    const flagged = !!this.flaggedQuestions[this.currentQuestionIndex];
    if (flagIcon) {
      flagIcon.className = flagged ? 'fas fa-flag flagged' : 'far fa-flag';
      flagIcon.style.color = flagged ? '#ff6b6b' : '';
    }
    if (flagText) {
      flagText.textContent = flagged ? 'Flagged' : 'Flag question';
      flagText.style.color = flagged ? '#ff6b6b' : '';
    }
  }

  renderQuestionList() {
    const container = this.questionListNumbersContainer || document.querySelector('#question-list-numbers');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this.totalQuestions; i++) {
      const btn = document.createElement('button');
      btn.textContent = (i + 1).toString();
      btn.className = 'question-list-button';
      if (i === this.currentQuestionIndex) btn.classList.add('current');
      if (this.flaggedQuestions[i]) btn.classList.add('flagged');
      if (this.userAnswers[i] !== undefined) btn.classList.add('answered');

      btn.onclick = () => {
        this.isCompletionScreen = false;
        this.currentQuestionIndex = i;
        this.displayQuestion();
        if (this.questionListModal) this.questionListModal.style.display = 'none';
      };
      container.appendChild(btn);
    }
  }

  /* ----------------------
     Submit
     ---------------------- */
  async submitQuiz() {
    if (!confirm('Are you sure you want to submit your quiz? You cannot change answers after submission.')) return;
    clearInterval(this.timerInterval);
    if (this.submitBtn) this.submitBtn.disabled = true;

    const url = window.quizResultsUrl || (this.quizResultsUrlInput ? (this.quizResultsUrlInput.value || this.quizResultsUrlInput.getAttribute('value')) : null) || '/quiz/results/';
    const csrfToken = this.csrfInput ? (this.csrfInput.value || this.csrfInput.getAttribute('value')) : (document.querySelector('input[name="csrfmiddlewaretoken"]') ? document.querySelector('input[name="csrfmiddlewaretoken"]').value : '');

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
          user_answers: this.userAnswers,
          total_questions: this.totalQuestions
        })
      });
      const data = await resp.json();
      if (data.status === 'ok') {
        this.showNotification('Quiz submitted successfully!', 'success');
        setTimeout(() => { window.location.href = url; }, 800);
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      this.showNotification('Error submitting quiz: ' + err.message, 'error');
      if (this.submitBtn) this.submitBtn.disabled = false;
    }
  }

  /* ----------------------
     Notifications & errors
     ---------------------- */
  showNotification(msg, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.position = 'fixed';
      toast.style.right = '20px';
      toast.style.top = '100px';
      toast.style.padding = '12px 18px';
      toast.style.borderRadius = '8px';
      toast.style.zIndex = 5000;
      toast.style.display = 'none';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    toast.style.background = (type === 'error') ? '#ef4444' : (type === 'success' ? '#10b981' : (type === 'warning' ? '#FFD600' : '#3b82f6'));
    toast.style.color = (type === 'warning') ? '#1a1a1a' : '#fff';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }
}

/* Initialize when DOM ready */
document.addEventListener('DOMContentLoaded', function () {
  // allow a server template to optionally set window.quizResultsUrl
  // window.quizResultsUrl = "{% url 'quiz_results' %}"  // keep optional (not required in HTML)
  try {
    window.quizEngine = new QuizEngine();
    console.info('QuizEngine initialized.');
  } catch (err) {
    console.error('Failed to initialize QuizEngine:', err);
  }
});
