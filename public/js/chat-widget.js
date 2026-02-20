// public/js/chat-widget.js
// Floating AI Chat Widget for all pages

// Create and inject the chat widget HTML
function injectChatWidget() {
    // Check if widget already exists
    if (document.getElementById('floating-chat-widget')) return;
    
    const widgetHTML = `
        <div id="floating-chat-widget" class="fixed bottom-6 right-6 z-50">
            <!-- Chat Button -->
            <button id="chat-toggle-btn" class="w-14 h-14 bg-gradient-to-r from-primary-600 to-accent-500 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-white">
                <i class="fas fa-robot text-2xl"></i>
            </button>
            
            <!-- Chat Panel (hidden by default) -->
            <div id="chat-panel" class="absolute bottom-16 right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl hidden transition-all duration-300 origin-bottom-right scale-0 opacity-0">
                <!-- Chat Header -->
                <div class="bg-gradient-to-r from-primary-600 to-accent-500 text-white p-3 rounded-t-lg flex justify-between items-center">
                    <div class="flex items-center">
                        <i class="fas fa-robot mr-2"></i>
                        <span class="font-semibold" data-i18n="aiAssistant">AI Assistant</span>
                    </div>
                    <button id="close-chat-btn" class="text-white hover:text-gray-200 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Chat Messages -->
                <div id="widget-chat-messages" class="h-64 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
                    <div class="flex items-start space-x-2">
                        <div class="w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-robot text-primary-600 text-xs"></i>
                        </div>
                        <div class="bg-gray-200 dark:bg-gray-700 rounded-lg p-2 max-w-[80%]">
                            <p class="text-xs text-gray-800 dark:text-gray-200" id="widget-welcome-message">
                                👋 Hi! I'm your quick assistant. Ask me anything!
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Chat Input -->
                <div class="p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
                    <div class="flex space-x-2">
                        <input type="text" id="widget-chat-input" 
                               class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                               placeholder="Type a message...">
                        <button id="widget-send-btn" 
                                class="px-3 py-1 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <!-- Quick suggestions -->
                    <div class="mt-2 flex flex-wrap gap-1">
                        <button onclick="widgetAsk('streak')" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            📊 Streak
                        </button>
                        <button onclick="widgetAsk('motivation')" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            🔥 Motivation
                        </button>
                        <button onclick="widgetAsk('tip')" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            💡 Tip
                        </button>
                        <button onclick="widgetAsk('help')" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            ❓ Help
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    
    // Add event listeners
    setupChatWidget();
}

// Setup chat widget functionality
function setupChatWidget() {
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const closeBtn = document.getElementById('close-chat-btn');
    const chatPanel = document.getElementById('chat-panel');
    const sendBtn = document.getElementById('widget-send-btn');
    const chatInput = document.getElementById('widget-chat-input');
    const chatMessages = document.getElementById('widget-chat-messages');
    
    if (!toggleBtn || !chatPanel) return;
    
    // Toggle chat panel
    toggleBtn.addEventListener('click', () => {
        chatPanel.classList.toggle('hidden');
        setTimeout(() => {
            chatPanel.classList.toggle('scale-0');
            chatPanel.classList.toggle('opacity-0');
            chatPanel.classList.toggle('scale-100');
            chatPanel.classList.toggle('opacity-100');
        }, 10);
        
        // Focus input when opened
        if (!chatPanel.classList.contains('hidden')) {
            setTimeout(() => chatInput?.focus(), 300);
        }
    });
    
    // Close chat
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            chatPanel.classList.add('scale-0', 'opacity-0');
            chatPanel.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => chatPanel.classList.add('hidden'), 300);
        });
    }
    
    // Send message
    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', () => {
            sendWidgetMessage(chatInput.value);
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendWidgetMessage(chatInput.value);
            }
        });
    }
    
    // Close chat when clicking outside
    document.addEventListener('click', (e) => {
        if (!chatPanel.contains(e.target) && !toggleBtn.contains(e.target) && !chatPanel.classList.contains('hidden')) {
            chatPanel.classList.add('scale-0', 'opacity-0');
            chatPanel.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => chatPanel.classList.add('hidden'), 300);
        }
    });
}

// Send message from widget
// Send message from widget - IMPROVED ERROR HANDLING
async function sendWidgetMessage(message) {
    if (!message || !message.trim()) return;
    
    const chatInput = document.getElementById('widget-chat-input');
    const chatMessages = document.getElementById('widget-chat-messages');
    const sendBtn = document.getElementById('widget-send-btn');
    
    if (!chatMessages) return;
    
    // Disable input while processing
    if (chatInput) chatInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    
    // Add user message
    addWidgetMessage(message, true);
    if (chatInput) chatInput.value = '';
    
    // Show typing indicator
    const typingId = showWidgetTyping();
    
    try {
        console.log('Sending message to chatbot:', message); // Debug log
        
        const response = await fetch('/api/chatbot/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        // Remove typing indicator
        removeWidgetTyping(typingId);
        
        if (response.ok) {
            const data = await response.json();
            addWidgetMessage(data.response);
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Chatbot error response:', errorData);
            
            if (response.status === 401) {
                addWidgetMessage("Please log in to use the chat feature.");
                // Optionally redirect to login
                setTimeout(() => window.location.href = '/', 2000);
            } else if (response.status === 404) {
                addWidgetMessage("Chatbot service not available. Please check server configuration.");
            } else {
                addWidgetMessage(errorData.error || "Sorry, I'm having trouble responding. Please try again.");
            }
        }
    } catch (error) {
        removeWidgetTyping(typingId);
        console.error('Chat fetch error:', error);
        addWidgetMessage("Network error. Cannot connect to server. Please check your connection.");
    } finally {
        // Re-enable input
        if (chatInput) chatInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (chatInput) chatInput.focus();
    }
}

// Add message to widget
function addWidgetMessage(message, isUser = false) {
    const chatMessages = document.getElementById('widget-chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex items-start space-x-2 ${isUser ? 'justify-end' : ''} animate-fade-in`;
    
    if (!isUser) {
        messageDiv.innerHTML = `
            <div class="w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-robot text-primary-600 text-xs"></i>
            </div>
            <div class="bg-gray-200 dark:bg-gray-700 rounded-lg p-2 max-w-[80%]">
                <p class="text-xs text-gray-800 dark:text-gray-200">${escapeHtml(message)}</p>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="bg-primary-100 dark:bg-primary-900 rounded-lg p-2 max-w-[80%] ml-auto">
                <p class="text-xs text-gray-800 dark:text-gray-200">${escapeHtml(message)}</p>
            </div>
            <div class="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-user text-white text-xs"></i>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show typing indicator
function showWidgetTyping() {
    const chatMessages = document.getElementById('widget-chat-messages');
    if (!chatMessages) return null;
    
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = 'flex items-start space-x-2';
    typingDiv.innerHTML = `
        <div class="w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0">
            <i class="fas fa-robot text-primary-600 text-xs"></i>
        </div>
        <div class="bg-gray-200 dark:bg-gray-700 rounded-lg p-2">
            <div class="flex space-x-1">
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingId;
}

// Remove typing indicator
function removeWidgetTyping(typingId) {
    if (typingId) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
    }
}

// Quick question handler - Updated to use English only
window.widgetAsk = function(topic) {
    let question = '';
    
    switch(topic) {
        case 'streak': 
            question = 'What is my current streak?'; 
            break;
        case 'motivation': 
            question = 'Give me some motivation'; 
            break;
        case 'tip': 
            question = 'Give me a tip for building habits'; 
            break;
        case 'help':
            question = 'What can you help me with?';
            break;
        default: 
            question = topic;
    }
    
    sendWidgetMessage(question);
};

// Add styles with check to prevent duplicate
if (!document.getElementById('chat-widget-styles')) {
    const style = document.createElement('style');
    style.id = 'chat-widget-styles';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.2s ease-out;
        }
        #chat-panel {
            transform-origin: bottom right;
            transition: transform 0.3s, opacity 0.3s;
        }
        #widget-chat-messages {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e0 #f1f5f9;
        }
        #widget-chat-messages::-webkit-scrollbar {
            width: 4px;
        }
        #widget-chat-messages::-webkit-scrollbar-track {
            background: #f1f5f9;
        }
        #widget-chat-messages::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 4px;
        }
        .dark #widget-chat-messages::-webkit-scrollbar-track {
            background: #1f2937;
        }
        .dark #widget-chat-messages::-webkit-scrollbar-thumb {
            background: #4b5563;
        }
    `;
    document.head.appendChild(style);
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    injectChatWidget();
    
    // Welcome message is always in English now
    const welcomeEl = document.getElementById('widget-welcome-message');
    if (welcomeEl) {
        welcomeEl.textContent = '👋 Hi! I\'m your quick assistant. Ask me anything!';
    }
});