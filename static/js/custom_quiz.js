// static/js/custom_quiz.js
document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Update tab states
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Update content visibility
            tabContents.forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            
            const activeContent = document.getElementById(targetTab);
            if (activeContent) {
                activeContent.style.display = 'block';
                activeContent.classList.add('active');
                
                // Add animation class
                activeContent.classList.add('slide-in');
                
                // Remove animation class after animation completes
                setTimeout(() => {
                    activeContent.classList.remove('slide-in');
                }, 400);
            }
        });
    });

    // Subject selection handling
    const subjectSelect = document.getElementById('subjectSelect');
    const customSubjectContainer = document.getElementById('customSubjectContainer');
    const customSubjectInput = document.getElementById('customSubjectInput');
    const subjectHidden = document.getElementById('subjectHidden');

    function updateSubjectValue() {
        if (subjectSelect.value === 'Other') {
            subjectHidden.value = customSubjectInput.value.trim();
        } else {
            subjectHidden.value = subjectSelect.value;
        }
    }

    subjectSelect.addEventListener('change', function() {
        if (this.value === 'Other') {
            customSubjectContainer.style.display = 'block';
            customSubjectInput.focus();
        } else {
            customSubjectContainer.style.display = 'none';
            updateSubjectValue();
        }
    });

    customSubjectInput.addEventListener('input', updateSubjectValue);

    // File upload handling
    const slideFile = document.getElementById('slideFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const uploadZone = document.getElementById('uploadZone');
    const extractSpinner = document.getElementById('extractSpinner');
    const studyText = document.getElementById('studyText');
    const selectFileButton = document.getElementById('selectFileButton');

    // Function to switch to text tab and populate textarea
    function switchToTextTabWithContent(content) {
        // Switch to text tab
        document.getElementById('textTab').click();
        
        // Populate the textarea with extracted content
        studyText.value = content;
        
        // Scroll to textarea and focus it
        studyText.focus();
        studyText.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Update character count
        updateCharacterCount();
    }

    // Function to update character count
    function updateCharacterCount() {
        const charCount = studyText.value.length;
        const charCountElement = document.getElementById('charCount');
        if (charCountElement) {
            charCountElement.textContent = charCount;
        }
    }

    // Initialize character count
    updateCharacterCount();
    studyText.addEventListener('input', updateCharacterCount);

    slideFile.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            const file = this.files[0];
            fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
            fileNameDisplay.style.display = 'block';
            
            // Show extraction spinner
            extractSpinner.style.display = 'flex';
            selectFileButton.disabled = true;
            selectFileButton.textContent = 'Processing...';
            
            // Extract text from file
            extractTextFromFile(file);
        }
    });

    // Drag and drop functionality
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderColor = '#FFD600';
        this.style.background = 'rgba(255, 214, 0, 0.05)';
    });

    uploadZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.style.borderColor = '#E6C200';
        this.style.background = '';
    });

    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = '#E6C200';
        this.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            slideFile.files = files;
            const event = new Event('change');
            slideFile.dispatchEvent(event);
        }
    });

    // Text extraction function - FIXED THE TYPO HERE
    function extractTextFromFile(file) {
        const formData = new FormData();
        formData.append('slide_file', file);
        
        // Get the correct URL - FIXED: Use the correct path with /practice/
        const extractTextUrl = '/practice/ajax/extract-text/';
        
        console.log('Extracting text from file:', file.name, 'Size:', file.size, 'Type:', file.type);
        console.log('Using URL:', extractTextUrl);
        
        fetch(extractTextUrl, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken(),
            },
            body: formData
        })
        .then(response => {
            console.log('Response status:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data from server:', data);
            extractSpinner.style.display = 'none';
            selectFileButton.disabled = false;
            selectFileButton.textContent = 'Select file';
            
            if (data.error) {
                showToast('Error: ' + data.error, 'error');
                fileNameDisplay.innerHTML = `<span style="color: var(--enactus-error-red)">Error: ${data.error}</span>`;
            } else if (data.text) {
                // Success - switch to text tab and populate textarea
                switchToTextTabWithContent(data.text);
                showToast(`Text extracted successfully! (${data.text.length} characters)`, 'success');
                
                // Update file name display with success message
                fileNameDisplay.innerHTML = `<span style="color: var(--enactus-success-green)">✓ Text extracted successfully</span>`;
            } else {
                throw new Error('No text data received from server');
            }
        })
        .catch(error => {
            console.error('Text extraction error:', error);
            extractSpinner.style.display = 'none';
            selectFileButton.disabled = false;
            selectFileButton.textContent = 'Select file';
            
            showToast('Error extracting text from file: ' + error.message, 'error');
            fileNameDisplay.innerHTML = `<span style="color: var(--enactus-error-red)">Extraction failed: ${error.message}</span>`;
        });
    }

    // Form validation
    const quizForm = document.getElementById('quizForm');
    quizForm.addEventListener('submit', function(e) {
        let isValid = true;
        const errors = [];

        // Validate subject
        updateSubjectValue(); // Ensure subject is updated
        if (!subjectHidden.value || subjectHidden.value.trim() === '') {
            errors.push('Please select or enter a subject');
            isValid = false;
        }

        // Validate content based on active tab
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab) {
            errors.push('Please select an input method (text or file)');
            isValid = false;
        } else {
            const activeTabId = activeTab.getAttribute('data-tab');
            
            if (activeTabId === 'textContent') {
                const textContent = studyText.value.trim();
                if (!textContent || textContent.length < 30) {
                    errors.push('Please enter at least 30 characters of text');
                    isValid = false;
                } else if (textContent.length > 50000) {
                    errors.push('Text is too long (maximum 50,000 characters)');
                    isValid = false;
                }
            } else if (activeTabId === 'fileContent') {
                if (!slideFile.files.length) {
                    errors.push('Please select a file to upload');
                    isValid = false;
                }
            }
        }

        // Validate question counts
        const numMcq = parseInt(document.getElementById('numMcqInput').value);
        const numShort = parseInt(document.getElementById('numShortInput').value);
        
        if (numMcq <= 0 && numShort <= 0) {
            errors.push('Please select at least one question type (MCQ or Short Answer)');
            isValid = false;
        }
        
        if (numMcq > 20) {
            errors.push('Maximum MCQ questions is 20');
            isValid = false;
        }
        
        if (numShort > 10) {
            errors.push('Maximum Short Answer questions is 10');
            isValid = false;
        }

        if (!isValid) {
            e.preventDefault();
            showToast(errors.join(', '), 'error');
            
            // Scroll to first error
            if (errors.length > 0) {
                const firstErrorElement = document.querySelector('.subject-section') || quizForm;
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            // Show loading state
            const generateButton = quizForm.querySelector('.main-btn');
            const originalText = generateButton.innerHTML;
            generateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Questions...';
            generateButton.disabled = true;
            
            // Re-enable button after 10 seconds if still processing (safety net)
            setTimeout(() => {
                generateButton.innerHTML = originalText;
                generateButton.disabled = false;
            }, 10000);
        }
    });

    // Clear form
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all fields? This will remove any extracted text.')) {
            quizForm.reset();
            fileNameDisplay.style.display = 'none';
            customSubjectContainer.style.display = 'none';
            studyText.value = '';
            subjectHidden.value = '';
            subjectSelect.value = '';
            updateCharacterCount();
            showToast('Form cleared', 'info');
        }
    });

    // Utility functions
    function getCSRFToken() {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
        return csrfToken ? csrfToken.value : '';
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        // Remove existing classes
        toast.className = 'toast';
        
        // Add type-specific class and set message
        toast.classList.add(type);
        toast.textContent = message;
        toast.style.display = 'block';
        
        // Auto-hide after delay
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }

    // Add character count display to textarea if it doesn't exist
    if (!document.getElementById('charCount')) {
        const textInputContainer = studyText.parentElement;
        const charCountDiv = document.createElement('div');
        charCountDiv.className = 'character-count';
        charCountDiv.innerHTML = '<span id="charCount">0</span> characters';
        textInputContainer.appendChild(charCountDiv);
    }

    // Initialize subject value
    updateSubjectValue();
    
    // Add some helpful event listeners for better UX
    studyText.addEventListener('focus', function() {
        this.parentElement.style.borderColor = '#FFD600';
    });
    
    studyText.addEventListener('blur', function() {
        this.parentElement.style.borderColor = '';
    });
});