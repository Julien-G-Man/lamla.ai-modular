/* static/js/quiz.js
   Updated QuizEngine:
   - robust selector matching to new template ids (#timer-display, #toggle-timer, #question-number, #meta-question-number)
   - displays H:MM:SS (always shows hours like 0:13:33)
   - hide button hides only the time text (bar remains)
   - updates *all* question-number label elements discovered
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

    // timer
    this.timeRemaining = 0;
    this.timerInterval = null;

    // UI references
    this.timeDisplay = null;          // single element for the numeric time
    this.hideTimeBtn = null;
    this.currentQuestionLabels = [];  // may contain multiple elements
    this.questionStatusEl = null;
    this.questionMathEl = null;
    this.optionsContainer = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.submitBtn = null;
    this.flagBtn = null;
    this.questionListBtn = null;
    this.questionListModal = null;
    this.questionListNumbersContainer = null;
    this.csrfInput = null;
    this.quizResultsUrlInput = null;

    // other
    this.storageKey = this._storageKey();
    this.saveTimer = null;
    this.saveDebounceMs = 500;

    // init
    this._bindElements();

    // Load questions first (sets this.mcq / this.short / this.totalQuestions)
    this._loadQuestions();

    // Restore previous user state (if any) BEFORE rendering UI so selections/flags are applied
    this._restoreState();
  
    // If there are no questions, show the "no-questions" card and hide the main question card.
    // If there are questions, ensure the question card is visible and the no-questions card hidden.
    const noQ = document.getElementById('no-questions');
    const qCard = document.getElementById('question-card');
    if (this.totalQuestions === 0) {
      if (noQ) noQ.style.display = 'block';
      if (qCard) qCard.style.display = 'none';
    } else {
      if (noQ) noQ.style.display = 'none';
      if (qCard) qCard.style.display = ''; // let CSS/default show it
    }

    // Populate the question navigator panel now that we know the totalQuestions and restored state
    this.renderQuestionList();

    // init timer, listeners, then render first question
    this._initTimerFromInput();
    this._setupEventListeners()

    // Finally render the question the user should see (uses restored currentQuestionIndex)
    this.displayQuestion();
    if (this.questionListNumbersContainer) this.renderQuestionList();
  }

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

  _storageKey() {
    const path = (window.location.pathname || 'quiz').replace(/[^a-z0-9]+/gi,'_');
    return `lamla_quiz_state_${path}`;
  }

  _bindElements() {
    // time numeric display (single)
    this.timeDisplay = this._queryCandidate(this.selectors.timeDisplayCandidates);

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
      ['#question-number','#meta-question-number'].forEach((id)=>{
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
      const mcqEl = document.querySelector(this.selectors.mcqJson) || document.getElementById((this.selectors.mcqJson||'').replace(/^#/,'')) ;
      this.mcq = mcqEl ? JSON.parse(mcqEl.textContent || '[]') : [];
    } catch (e) { console.error('Error parsing mcq JSON:', e); this.mcq = []; }
    try {
      const shortEl = document.querySelector(this.selectors.shortJson) || document.getElementById((this.selectors.shortJson||'').replace(/^#/,'')) ;
      this.short = shortEl ? JSON.parse(shortEl.textContent || '[]') : [];
    } catch (e) { console.error('Error parsing short JSON:', e); this.short = []; }

    if (!this.mcq.length) {
      const mcqScript = document.getElementById('mcq-questions-json');
      if (mcqScript) {
        try { this.mcq = JSON.parse(mcqScript.textContent || '[]'); } catch(e){ this.mcq = []; }
      }
    }
    if (!this.short.length) {
      const shortScript = document.getElementById('short-questions-json');
      if (shortScript) {
        try { this.short = JSON.parse(shortScript.textContent || '[]'); } catch(e){ this.short = []; }
      }
    }

    this.totalQuestions = this.mcq.length + this.short.length;
    Object.freeze(this.mcq);
    Object.freeze(this.short);
    console.info(`QuizEngine loaded ${this.mcq.length} MCQ and ${this.short.length} short questions`);
  }

  /* Timer: initialize from hidden input (minutes) */
  _initTimerFromInput() {
    let quizTimeMinutes = null;
    for (const sel of this.selectors.quizTimeInputCandidates) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const val = el.value || el.textContent || el.getAttribute('value') || '';
          const intv = parseInt(val, 10);
          if (!Number.isNaN(intv)) { quizTimeMinutes = intv; break; }
        }
      } catch (e) {}
    }
    if (!quizTimeMinutes || Number.isNaN(quizTimeMinutes)) quizTimeMinutes = 10;
    this.timeRemaining = quizTimeMinutes * 60;

    if (this.timeDisplay) this._updateTimerDisplay();
    if (!this.timerInterval && this.timeDisplay) {
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
  }

  /* Always show H:MM:SS (hours may be 0 like sample "0:13:33") */
  _updateTimerDisplay() {
    if (!this.timeDisplay) return;
    const h = Math.floor(this.timeRemaining / 3600);
    const m = Math.floor((this.timeRemaining % 3600) / 60);
    const s = this.timeRemaining % 60;
    const hh = String(h);
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    this.timeDisplay.textContent = `${hh}:${mm}:${ss}`;

    // color thresholds
    if (this.timeRemaining < 300) this.timeDisplay.style.color = '#ff6b6b';
    else if (this.timeRemaining < 600) this.timeDisplay.style.color = '#ffa726';
    else this.timeDisplay.style.color = '#4ecdc4';
  }

  timeExpired() {
    this.showNotification('Time is up! Submitting your quiz...', 'warning');
    setTimeout(()=> this.submitQuiz(), 800);
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
    if (this.totalQuestions === 0) {
      if (this.questionMathEl) this.questionMathEl.innerHTML = '<span style="color:red">No questions available.</span>';
      return;
    }
    if (this.isCompletionScreen) { this.showCompletionScreen(); return; }
    const q = this.getCurrentQuestion();
    if (!q) { this.showCompletionScreen(); return; }

    // update *all* question-number labels discovered
    const labelText = `Question ${this.currentQuestionIndex + 1}`;
    if (Array.isArray(this.currentQuestionLabels) && this.currentQuestionLabels.length) {
      this.currentQuestionLabels.forEach(el => { try { el.textContent = labelText; } catch(e){} });
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
      MathJax.typesetPromise().catch(e=>console.warn('MathJax typeset error', e));
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
      ta.addEventListener('blur', (e)=> {
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
    for (let i=0;i<this.totalQuestions;i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = (i+1).toString();
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
      this.isCompletionScreen = false;
      this.currentQuestionIndex = Math.max(0, this.totalQuestions - 1);
    } else if (this.currentQuestionIndex < this.totalQuestions - 1) {
      this.currentQuestionIndex++;
    } else {
      this.showCompletionScreen();
      return;
    }
    this.displayQuestion();
    this._debouncedSave();
  }

  showCompletionScreen() {
    this.isCompletionScreen = true;
    const answeredCount = Object.keys(this.userAnswers).filter(k=>{
      const v = this.userAnswers[k]; return v !== undefined && v !== null && String(v).trim() !== '';
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
    if (this.nextBtn) { this.nextBtn.disabled = true; this.nextBtn.style.display = 'none'; }
    this._debouncedSave();
  }

  _debouncedSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(()=> this._saveState(), this.saveDebounceMs);
  }

  _saveState() {
    try {
      const payload = {
        currentQuestionIndex: this.currentQuestionIndex,
        userAnswers: this.userAnswers,
        flaggedQuestions: this.flaggedQuestions,
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
      }
    } catch (e) {
      console.warn('Failed to restore state', e);
    }
  }

  downloadResults() {
    const resultObj = {
      generated_at: (new Date()).toISOString(),
      questions: { mcq: this.mcq, short: this.short },
      answers: this.userAnswers,
      flagged: this.flaggedQuestions
    };
    const blob = new Blob([JSON.stringify(resultObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_export_${(new Date()).toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async submitQuiz() {
    if (!confirm('Submit quiz? You will not be able to edit answers after submission.')) return;
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
        setTimeout(()=> { window.location.href = resultsUrl; }, 700);
      } else {
        throw new Error((data && data.message) ? data.message : 'Submission failed');
      }
    } catch (e) {
      console.error('Submit failed', e);
      this.showNotification('Failed to submit quiz: ' + (e.message || e), 'error');
    }
  }

  _setupEventListeners() {
    if (this.prevBtn) this.prevBtn.addEventListener('click', ()=> this.previousQuestion());
    if (this.nextBtn) this.nextBtn.addEventListener('click', ()=> this.nextQuestion());

    const dlBtn = document.getElementById('quiz-download') || document.querySelector('.download-btn');
    if (dlBtn) dlBtn.addEventListener('click', ()=> this.downloadResults());

    const submitBtn = document.getElementById('quiz-submit') || this.submitBtn || document.querySelector('.submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', ()=> this.submitQuiz());

    if (this.flagBtn) this.flagBtn.addEventListener('click', ()=> this.toggleFlag());

    const openPanelBtn = this.questionListBtn || document.getElementById('open-panel');
    if (openPanelBtn) openPanelBtn.addEventListener('click', ()=> {
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
      this.hideTimeBtn.addEventListener('click', ()=> {
        if (!this.timeDisplay) return;
        const hidden = this.timeDisplay.classList.toggle('quiz-time--hidden');
        this.hideTimeBtn.textContent = hidden ? 'Show' : 'Hide';
        this.hideTimeBtn.setAttribute('aria-pressed', String(hidden));
      });
    }

    // keyboard nav
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.previousQuestion(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.nextQuestion(); }
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); this.toggleFlag(); }
      if (e.key === 'Escape') {
        if (this.questionListModal && this.questionListModal.classList.contains('active')) {
          this.questionListModal.classList.remove('active');
          this.questionListModal.setAttribute('aria-hidden', 'true');
        }
        const panel = document.getElementById('question-panel');
        if (panel && panel.classList.contains('active')) panel.classList.remove('active');
      }
    });

    window.addEventListener('beforeunload', ()=> this._saveState());
  }

  _renderPanel() { this.renderQuestionList(); }

  showNotification(msg, type='info') {
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
    setTimeout(()=> { toast.style.display = 'none'; }, 3500);
  }
}

/* Initialize */
document.addEventListener('DOMContentLoaded', function(){
  try {
    window.quizEngine = new QuizEngine();
    console.info('QuizEngine initialized.');
  } catch (e) {
    console.error('Failed to initialize QuizEngine', e);
  }
});
