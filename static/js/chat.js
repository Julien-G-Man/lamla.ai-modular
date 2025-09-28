// static/js/chat.js

const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const typingIndicator = document.getElementById("typing-indicator");

// Enable/disable send button
messageInput.addEventListener("input", () => {
  sendBtn.disabled = messageInput.value.trim().length === 0;
});

// Auto-resize textarea
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
});

// Handle send button
sendBtn.addEventListener("click", () => sendMessage());

// Send message on Enter (Shift+Enter = new line)
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  // Clear input
  messageInput.value = "";
  sendBtn.disabled = true;
  messageInput.style.height = "auto";

  // Add user message bubble
  addMessageBubble(text, "user");

  // Add empty AI bubble
  const aiBubble = addMessageBubble("", "ai", "AI Tutor");

  // Show typing indicator
  typingIndicator.style.display = "flex";

  try {
    const res = await fetch("/ai/chatbot/stream/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok || !res.body) {
      aiBubble.querySelector("p").textContent = "[Error: failed to connect]";
      typingIndicator.style.display = "none";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;

      aiBubble.querySelector("p").textContent = fullText;
      scrollToBottom();
    }
  } catch (err) {
    console.error("Stream error:", err);
    aiBubble.querySelector("p").textContent = "[Error: connection issue]";
  } finally {
    typingIndicator.style.display = "none";
  }
}

function addMessageBubble(text, type, sender = null) {
  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", type === "user" ? "user-message" : "ai-message");

  if (type === "ai") {
    const nameEl = document.createElement("div");
    nameEl.className = "sender-name";
    nameEl.textContent = sender || "AI Tutor";
    bubble.appendChild(nameEl);
  }

  const p = document.createElement("p");
  p.textContent = text;
  bubble.appendChild(p);

  chatMessages.appendChild(bubble);
  scrollToBottom();

  return bubble;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
