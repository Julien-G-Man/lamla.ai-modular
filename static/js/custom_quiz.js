document.addEventListener('DOMContentLoaded', function() {
    // --- Elements ---
    const textTab = document.getElementById('textTab');
    const fileTab = document.getElementById('fileTab');
    const textContent = document.getElementById('textContent');
    const fileContent = document.getElementById('fileContent');

    const clearBtn = document.getElementById('clearBtn');
    const slideFileInput = document.getElementById('slideFile');
    const selectFileButton = document.getElementById('selectFileButton');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const studyTextArea = document.getElementById('studyText');
    const extractSpinner = document.getElementById('extractSpinner');
    const toast = document.getElementById('toast');
    const quizForm = document.getElementById('quizForm');

    // Subject elements
    const subjectSelect = document.getElementById('subjectSelect');
    const customSubjectContainer = document.getElementById('customSubjectContainer');
    const customSubjectInput = document.getElementById('customSubjectInput');
    const subjectHidden = document.getElementById('subjectHidden');

    // --- Utility: toast ---
    function showToast(msg, isError = false) {
        toast.textContent = msg;
        toast.style.background = isError ? 'var(--enactus-error-red)' : 'var(--enactus-success-green)';
        toast.style.color = 'white';
        toast.style.display = 'block';
        // ensure visible for screen readers briefly
        toast.setAttribute('aria-live', 'polite');
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    // --- Tabs logic (with slide-in animation hooks) ---
    function openTextTab() {
        textTab.classList.add('active');
        textTab.setAttribute('aria-selected', 'true');
        fileTab.classList.remove('active');
        fileTab.setAttribute('aria-selected', 'false');
        textContent.style.display = 'block';
        fileContent.style.display = 'none';
        textContent.classList.add('slide-in');
        setTimeout(() => textContent.classList.remove('slide-in'), 400);
    }

    function openFileTab() {
        fileTab.classList.add('active');
        fileTab.setAttribute('aria-selected', 'true');
        textTab.classList.remove('active');
        textTab.setAttribute('aria-selected', 'false');
        fileContent.style.display = 'block';
        textContent.style.display = 'none';
        fileContent.classList.add('slide-in');
        setTimeout(() => fileContent.classList.remove('slide-in'), 400);
    }

    textTab.addEventListener('click', openTextTab);
    fileTab.addEventListener('click', openFileTab);

    // --- Clear button ---
    clearBtn.onclick = function() {
        studyTextArea.value = '';
        slideFileInput.value = '';
        fileNameDisplay.textContent = '';
        // reset options
        const numMcq = document.getElementById('numMcqInput');
        const numShort = document.getElementById('numShortInput');
        const quizTime = document.getElementById('quizTimeInput');
        const difficulty = document.getElementById('difficultySelect');

        if (numMcq) numMcq.value = 5;
        if (numShort) numShort.value = 3;
        if (quizTime) quizTime.value = 10;
        if (difficulty) difficulty.value = 'random';

        // subject reset
        if (subjectSelect) subjectSelect.value = '';
        if (customSubjectInput) customSubjectInput.value = '';
        if (subjectHidden) subjectHidden.value = '';

        openTextTab();
        showToast('Form cleared!', false);
    };

    // --- File select / extraction ---
    if (selectFileButton && slideFileInput && studyTextArea && extractSpinner) {
        selectFileButton.onclick = function(e) {
            e.preventDefault();
            slideFileInput.click();
        };

        slideFileInput.onchange = function() {
            if (!slideFileInput.files.length) {
                fileNameDisplay.textContent = '';
                return;
            }

            fileNameDisplay.textContent = slideFileInput.files[0].name;
            selectFileButton.textContent = 'Extracting...';
            selectFileButton.disabled = true;
            const mainBtn = quizForm.querySelector('.main-btn');
            const clrBtn = quizForm.querySelector('.clear-btn');
            if (mainBtn) mainBtn.disabled = true;
            if (clrBtn) clrBtn.disabled = true;
            studyTextArea.disabled = true;
            extractSpinner.style.display = 'flex';

            const formData = new FormData();
            formData.append('slide_file', slideFileInput.files[0]);

            fetch('/ajax/extract-text/', {
                method: 'POST',
                headers: { 'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value },
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.text !== undefined) {
                    studyTextArea.value = data.text;
                    showToast('Text extracted successfully!');
                    openTextTab();
                    // subtle UI change
                    textTab.textContent = 'View Extracted Text';
                } else {
                    showToast(data.error || 'Failed to extract text. Please try again.', true);
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                showToast('Network error or server unreachable. Failed to extract text.', true);
            })
            .finally(() => {
                selectFileButton.textContent = 'Select file';
                selectFileButton.disabled = false;
                if (mainBtn) mainBtn.disabled = false;
                if (clrBtn) clrBtn.disabled = false;
                studyTextArea.disabled = false;
                extractSpinner.style.display = 'none';
            });
        };
    }

    // --- Subject handling (Other => show input, keep hidden subject value updated) ---
    function updateHiddenSubjectFromSelect() {
        const val = (subjectSelect ? subjectSelect.value : '').trim();
        if (!subjectHidden) return;
        if (val === 'Other') {
            // show custom input
            if (customSubjectContainer) customSubjectContainer.style.display = 'block';
            if (customSubjectInput) {
                customSubjectInput.focus();
                subjectHidden.value = customSubjectInput.value.trim();
            } else {
                subjectHidden.value = '';
            }
        } else if (val) {
            // hide custom input and set hidden to selected value
            if (customSubjectContainer) customSubjectContainer.style.display = 'none';
            if (customSubjectInput) customSubjectInput.value = '';
            subjectHidden.value = val;
        } else {
            // nothing chosen
            if (customSubjectContainer) customSubjectContainer.style.display = 'none';
            if (customSubjectInput) customSubjectInput.value = '';
            subjectHidden.value = '';
        }
    }

    if (subjectSelect) {
        subjectSelect.addEventListener('change', updateHiddenSubjectFromSelect);
    }

    if (customSubjectInput) {
        customSubjectInput.addEventListener('input', function() {
            if (subjectHidden) subjectHidden.value = customSubjectInput.value.trim();
        });
    }

    // Initialize subject hidden input on load (use existing selection if any)
    updateHiddenSubjectFromSelect();

    // --- On submit: ensure subjectHidden is set and validate minimal fields ---
    if (quizForm) {
        quizForm.addEventListener('submit', function(e) {
            // Ensure hidden subject updated one last time
            updateHiddenSubjectFromSelect();

            // Basic validation: require a subject
            if (!subjectHidden.value || subjectHidden.value.trim() === '') {
                e.preventDefault();
                showToast('Please select a subject or enter one when choosing "Other".', true);
                // if custom input visible, focus it; otherwise focus select
                if (customSubjectContainer && customSubjectContainer.style.display !== 'none') {
                    customSubjectInput.focus();
                } else {
                    subjectSelect.focus();
                }
                return;
            }

            // If file tab visible but no text present, that's okay (server handles). We don't block submit here.
            // If you want additional client-side validation, add it here.
        });
    }
});
