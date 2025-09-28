// static/js/chat.js

// --- DOM Element References ---
const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const typingIndicator = document.getElementById("typing-indicator");

const fileInput = document.getElementById("file-input");
const fileStatusBar = document.getElementById("file-status-bar");
const fileNameDisplay = document.getElementById("file-name-display");
const clearFileBtn = document.getElementById("clear-file-btn");

// --- State Variables ---
let attachedFile = null;
let isProcessingFile = false; // True when file is sent and text extraction is ongoing.

// --- Utility Functions ---

/**
 * Toggles the send button's disabled state and applies the 'processing' style
 * if a file is being uploaded/processed.
 */
function toggleSendButton() {
    const isTextPresent = messageInput.value.trim().length > 0;
    
    // Disable if no content OR if a file is currently being processed
    sendBtn.disabled = !(isTextPresent || attachedFile) || isProcessingFile;

    // Apply or remove the 'processing' class for visual feedback
    if (isProcessingFile) {
        sendBtn.classList.add('processing');
    } else {
        sendBtn.classList.remove('processing');
    }
}

/**
 * Clears the file attachment state and updates the UI.
 */
function clearAttachment() {
    attachedFile = null;
    fileInput.value = ''; // Clear file input element
    fileNameDisplay.textContent = '';
    fileStatusBar.classList.add('hidden');
    toggleSendButton();
}

/**
 * Adds a message bubble to the chat window and scrolls to the bottom.
 * @param {string} text - The content of the message.
 * @param {'user'|'ai'} type - The type of sender.
 * @param {string} [sender=null] - The sender's display name (for AI messages).
 * @returns {HTMLDivElement} The newly created message bubble element.
 */
function addMessageBubble(text, type, sender = null) {
    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble", type === "user" ? "user-message" : "ai-message");

    if (type === "ai" && sender) {
        const nameEl = document.createElement("div");
        nameEl.className = "sender-name";
        nameEl.textContent = sender;
        bubble.appendChild(nameEl);
    }

    const p = document.createElement("p");
    p.textContent = text;
    bubble.appendChild(p);

    chatMessages.appendChild(bubble);
    scrollToBottom();

    return bubble;
}

/**
 * Scrolls the chat messages container to the bottom.
 */
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Main Chat Logic ---

/**
 * Handles sending the message, determining if a file upload is required.
 */
async function sendMessage() {
    console.log("--- sendMessage Initiated ---");
    
    let text = messageInput.value.trim();
    const fileToSend = attachedFile;

    // Determine message content/default if only file is present
    if (!text && fileToSend) {
        text = `Analyze the uploaded document and summarize its key concepts.`;
    } else if (!text && !fileToSend) {
        console.log("No content to send. Exiting sendMessage.");
        return; 
    }

    // 1. Prepare UI for sending
    const userDisplayMessage = text + (fileToSend ? ` (attached: ${fileToSend.name})` : '');
    addMessageBubble(userDisplayMessage, "user");
    
    // Clear inputs/attachments
    messageInput.value = "";
    messageInput.style.height = "auto";
    clearAttachment(); // This also calls toggleSendButton (disabling it temporarily)

    // 2. Set up AI response container and lock UI
    const aiBubble = addMessageBubble("...", "ai", "AI Tutor");
    const aiParagraph = aiBubble.querySelector("p");
    
    messageInput.disabled = true; // Disable input
    typingIndicator.style.display = "flex";

    if (fileToSend) {
        // Critical: Set processing state immediately before the network request
        isProcessingFile = true;
        toggleSendButton(); 
    }

    try {
        if (fileToSend) {
            // A. File Upload (Non-streaming endpoint: /ai/chatbot/file/)
            const apiUrl = "/ai/chatbot/file/";
            aiParagraph.textContent = "Processing file... This may take a moment.";
            
            const formData = new FormData();
            formData.append('file_upload', fileToSend); 
            formData.append('message', text); 

            const res = await fetch(apiUrl, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                console.error("File API Request Failed.", data);
                const errorMessage = data.error || `[Error: File processing failed (Status ${res.status})]`;
                aiParagraph.textContent = errorMessage;
                return;
            }
            
            aiParagraph.textContent = data.response;

        } else {
            // B. Standard Streamed Chat (Streaming endpoint: /ai/chatbot/stream/)
            const apiUrl = "/ai/chatbot/stream/";
            aiParagraph.textContent = "";

            const res = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });

            if (!res.ok || !res.body) {
                console.error("Stream API Connection Error:", res.status);
                aiParagraph.textContent = "[Error: failed to connect to stream]";
                return;
            }
            
            // Stream processing
            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;

                aiParagraph.textContent = fullText;
                scrollToBottom();
            }
        }
    } catch (err) {
        console.error("Global Network/Fetch Error:", err);
        aiParagraph.textContent = "[Error: connection issue. Please check your network.]";
    } finally {
        // 3. Re-enable UI elements
        messageInput.disabled = false;
        typingIndicator.style.display = "none";
        
        // Critical: Reset file processing state and update button UI
        if (fileToSend) {
            isProcessingFile = false;
        }
        
        toggleSendButton(); 
        scrollToBottom();
        console.log("--- sendMessage Finished ---");
    }
}

// --- Event Listeners and Setup ---

// Toggle send button on input
messageInput.addEventListener("input", toggleSendButton);

// Auto-resize textarea
messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = messageInput.scrollHeight + "px";
});

// Handle file selection
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            addMessageBubble(`[Error: File ${file.name} is too large. Max size is 10MB.]`, "ai", "AI Tutor");
            fileInput.value = '';
            return;
        }

        attachedFile = file;
        fileNameDisplay.textContent = file.name;
        fileStatusBar.classList.remove('hidden');
    } else {
        clearAttachment();
    }
    toggleSendButton();
});

// Handle clearing file
clearFileBtn.addEventListener('click', clearAttachment);

// Handle send button click
sendBtn.addEventListener("click", () => sendMessage());

// Send message on Enter (Shift+Enter = new line)
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Initial state setup
toggleSendButton();