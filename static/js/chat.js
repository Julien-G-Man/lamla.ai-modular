import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase services
let app;
let db;
let auth;
let userId;
let appId;
let isAuthReady = false;

// Set Firebase debug logs
setLogLevel('debug');

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');
const userIdDisplay = document.getElementById('user-id-display');

// Initialize Firebase and Auth
async function initFirebase() {
    try {
        // Mandatory global variables for Firestore integration
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Sign in with custom token or anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        // Listen for auth state changes to get the user ID
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                userIdDisplay.textContent = `User ID: ${userId}`;
                isAuthReady = true;
                sendBtn.disabled = false;
                listenForMessages();
            } else {
                userId = null;
                isAuthReady = false;
                userIdDisplay.textContent = 'Disconnected';
                sendBtn.disabled = true;
            }
        });

    } catch (error) {
        console.error("Error initializing Firebase:", error);
        userIdDisplay.textContent = 'Error';
    }
}

// Add a message to the chat display
function addMessageToUI(message, sender, isNew) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble', `${sender}-message`);
    
    if (sender === 'ai') {
        const senderName = document.createElement('div');
        senderName.classList.add('sender-name');
        senderName.textContent = 'Lamla AI';
        messageElement.appendChild(senderName);
    }
    
    const messageText = document.createElement('p');
    messageText.textContent = message;
    messageElement.appendChild(messageText);

    chatMessages.appendChild(messageElement);
    if (isNew) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Listen for new messages in Firestore
function listenForMessages() {
    const messagesRef = collection(db, `artifacts/${appId}/public/data/chat_messages`);
    const q = query(messagesRef, orderBy('createdAt'));
    
    // onSnapshot provides real-time updates
    onSnapshot(q, (snapshot) => {
        if (!isAuthReady) {
            return;
        }

        const changes = snapshot.docChanges();
        if (changes.length > 0) {
            // Only add new messages to the UI to avoid re-rendering the entire list
            changes.forEach(change => {
                if (change.type === "added") {
                    const messageData = change.doc.data();
                    addMessageToUI(messageData.text, messageData.sender, true);
                }
            });
        }
    }, (error) => {
        console.error("Error listening to messages:", error);
    });
}

// Send message to Firestore
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '') return;

    // Display a typing indicator
    typingIndicator.style.display = 'block';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // Add the user's message to Firestore
        await addDoc(collection(db, `artifacts/${appId}/public/data/chat_messages`), {
            text: text,
            sender: 'user',
            userId: userId,
            createdAt: serverTimestamp(),
        });
        messageInput.value = '';

        // Simulate AI response after a delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const aiResponseText = "This is a placeholder AI response. Once you're ready, we can integrate with a powerful model like Gemini to give you real-time, helpful answers!";

        // Add the AI's response to Firestore
        await addDoc(collection(db, `artifacts/${appId}/public/data/chat_messages`), {
            text: aiResponseText,
            sender: 'ai',
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        typingIndicator.style.display = 'none';
    }
}

// File upload placeholder
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        console.log("File selected:", file.name);
        // In the future, you would add code here to process the file and send it to the AI for analysis.
        const aiMessage = `Got it! I received your file, "${file.name}". What would you like to know about it?`;
        addDoc(collection(db, `artifacts/${appId}/public/data/chat_messages`), {
            text: aiMessage,
            sender: 'ai',
            createdAt: serverTimestamp(),
        });
    }
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
document.getElementById('file-input').addEventListener('change', handleFileUpload);

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});

// Initialize the app on page load
initFirebase();
