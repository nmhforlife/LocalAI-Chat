// Chat functionality

let currentChatId = null;
let currentModel = null;
let messageHistory = [];
let sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

// Toast notification function
function showToast(message, type = 'info', autoHide = true) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        color: white;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            toast.style.backgroundColor = '#10B981';
            break;
        case 'error':
            toast.style.backgroundColor = '#EF4444';
            break;
        case 'info':
            toast.style.backgroundColor = '#3B82F6';
            break;
        default:
            toast.style.backgroundColor = '#6B7280';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    if (autoHide) {
        // Fade out and remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }

    return toast;
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all event listeners and load initial data
    initializeChat();
    initializeSidebar(); // Initialize sidebar state
    initializeScrollButtons(); // Initialize scroll navigation
    
    // Ensure proper sizing of containers
    adjustContainerHeights();
    
    // Call again after a short delay to ensure all elements are rendered
    setTimeout(adjustContainerHeights, 100);
    
    // Listen for window resize events
    window.addEventListener('resize', adjustContainerHeights);
    
    // Ensure the sidebar toggle button has the correct icon
    updateSidebarToggleIcon();
});

// Initialize scroll navigation buttons
function initializeScrollButtons() {
    const chatMessages = document.getElementById('chatMessages');
    const scrollButtons = document.getElementById('scrollNavButtons');
    const scrollTopBtn = document.getElementById('scrollTopButton');
    const scrollBottomBtn = document.getElementById('scrollBottomButton');
    
    // Show/hide buttons based on scroll position
    function updateScrollButtonsVisibility() {
        const scrollTop = chatMessages.scrollTop;
        const scrollHeight = chatMessages.scrollHeight;
        const clientHeight = chatMessages.clientHeight;
        const maxScroll = scrollHeight - clientHeight;
        
        // Only show buttons if there's enough content to scroll
        if (scrollHeight > clientHeight + 100) { // Added threshold
            scrollButtons.classList.add('visible');
            
            // Show/hide individual buttons based on scroll position
            if (scrollTop < 100) {
                scrollTopBtn.style.opacity = '0.5';
            } else {
                scrollTopBtn.style.opacity = '1';
            }
            
            if (scrollTop >= maxScroll - 100) {
                scrollBottomBtn.style.opacity = '0.5';
            } else {
                scrollBottomBtn.style.opacity = '1';
            }
        } else {
            scrollButtons.classList.remove('visible');
        }
    }
    
    // Scroll to top with smooth animation
    scrollTopBtn.addEventListener('click', () => {
        chatMessages.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Scroll to bottom with smooth animation
    scrollBottomBtn.addEventListener('click', () => {
        scrollToBottom();
    });
    
    // Update button visibility on scroll
    chatMessages.addEventListener('scroll', updateScrollButtonsVisibility);
    
    // Update button visibility when content changes
    const observer = new MutationObserver(() => {
        setTimeout(updateScrollButtonsVisibility, 100); // Added delay to ensure content is rendered
    });
    
    observer.observe(chatMessages, { 
        childList: true, 
        subtree: true,
        characterData: true 
    });
    
    // Initial visibility check
    setTimeout(updateScrollButtonsVisibility, 100);
}

// Update sidebar toggle icon based on sidebar state
function updateSidebarToggleIcon() {
    const sidebar = document.getElementById('chatSidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (!sidebar || !toggleBtn) return;
    
    const isCollapsed = sidebar.classList.contains('collapsed');
    const icon = toggleBtn.querySelector('i');
    
    if (icon) {
        icon.className = ''; // Clear all classes
        icon.classList.add('fas', isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left');
    }
}

// Send message
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;
    
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    // Create user message with proper styling
    messageDiv.className = 'message user-message mb-4 max-w-[80%] p-3 bg-primary text-gray-900 rounded-lg';
    
    messageDiv.innerHTML = marked.parse(message);
    chatMessages.appendChild(messageDiv);
    
    // Add message to history
    messageHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    });
    
    userInput.value = '';
    userInput.style.height = 'auto';
    scrollToBottom();
    
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    
    try {
        console.log('Preparing to send message:', message);

        // Prepare the request body in Ollama format
        const requestBody = {
            model: document.getElementById('modelSelect').value || currentModel,
            messages: messageHistory,  // Use message history instead of reading from DOM
            stream: true
        };

        // If we have a chat ID, include it in context
        if (currentChatId) {
            requestBody.context = { chat_id: currentChatId };
        }

        console.log('Sending request with body:', requestBody);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error(errorData.error?.message || errorData.detail?.message || 'Failed to send message');
        }

        console.log('Response received, starting to read stream');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log('Stream complete');
                if (!assistantMessage) {
                    throw new Error('No response received from the model');
                }
                break;
            }
            
            const chunk = decoder.decode(value);
            console.log('Received chunk:', chunk);
            
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        console.log('Parsed SSE data:', data);
                        
                        if (data.error) {
                            console.error('Error in SSE data:', data.error);
                            throw new Error(data.error);
                        }
                        
                        if (data.message) {
                            assistantMessage += data.message;
                            updateStreamingMessage(assistantMessage);
                        }
                        
                        if (data.done) {
                            console.log('Received done signal');
                            loading.classList.add('hidden');
                            
                            // Add complete assistant response to message history
                            messageHistory.push({
                                role: 'assistant',
                                content: assistantMessage,
                                timestamp: new Date().toISOString()
                            });
                            
                            if (data.context && data.context.chat_id) {
                                currentChatId = data.context.chat_id;
                                await loadChats();
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e, 'Line:', line);
                        throw e;
                    }
                }
            }
        }
        
        loading.classList.add('hidden');
    } catch (error) {
        console.error('Error in sendMessage:', error);
        loading.classList.add('hidden');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error-message mb-4 p-3 bg-red-100 text-red-800 rounded-lg';
        errorDiv.textContent = `Error: ${error.message}`;
        chatMessages.appendChild(errorDiv);
    }
}

// Update streaming message
function updateStreamingMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const lastMessage = chatMessages.querySelector('.assistant-message:last-child');
    
    if (lastMessage) {
        lastMessage.innerHTML = marked.parse(message);
        // Add copy buttons to any new code blocks
        addCopyButtonsToCodeBlocks(lastMessage);
    } else {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message mb-4 max-w-[80%] p-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg';
        messageDiv.innerHTML = marked.parse(message);
        // Add copy buttons to any new code blocks
        addCopyButtonsToCodeBlocks(messageDiv);
        chatMessages.appendChild(messageDiv);
    }
    
    scrollToBottom();
}

// Add copy buttons to code blocks
function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(codeBlock => {
        // Only add button if it doesn't already exist
        if (!codeBlock.parentElement.querySelector('.code-copy-button')) {
            const button = document.createElement('button');
            button.className = 'code-copy-button';
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.title = 'Copy code';
            
            button.addEventListener('click', async () => {
                try {
                    // Get the text content of the code block
                    const code = codeBlock.textContent;
                    
                    // Copy to clipboard
                    await navigator.clipboard.writeText(code);
                    
                    // Visual feedback
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    button.classList.add('copied');
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        button.innerHTML = '<i class="fas fa-copy"></i>';
                        button.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy code:', err);
                    // Visual feedback for error
                    button.innerHTML = '<i class="fas fa-times"></i>';
                    setTimeout(() => {
                        button.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                }
            });
            
            // Add the button to the pre element (parent of code)
            codeBlock.parentElement.appendChild(button);
        }
    });
}

// Load a specific chat
async function loadChat(chatId) {
    try {
        const response = await fetch(`/api/chats/${chatId}`);
        const chat = await response.json();
        
        currentChatId = chat.id;
        currentModel = chat.model;
        messageHistory = [...chat.messages];  // Create a copy of the messages array
        
        // Update model selector
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.value = chat.model;
        
        // Clear and populate messages
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        // Add messages
        messageHistory.forEach(msg => {
            const messageDiv = document.createElement('div');
            if (msg.role === 'user') {
                messageDiv.className = 'message user-message mb-4 max-w-[80%] p-3 bg-primary text-gray-900 rounded-lg';
            } else if (msg.role === 'assistant') {
                messageDiv.className = 'message assistant-message mb-4 max-w-[80%] p-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg';
            } else {
                messageDiv.className = `message ${msg.role}-message mb-4 max-w-[80%] p-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg`;
            }
            const formattedContent = marked.parse(msg.content);
            messageDiv.innerHTML = formattedContent;
            // Add copy buttons to code blocks in the message
            addCopyButtonsToCodeBlocks(messageDiv);
            chatMessages.appendChild(messageDiv);
        });
        
        // Update chat list to show active chat
        loadChats();
        
        // Scroll to bottom and update state
        scrollToBottom();
        
        // Only handle mobile sidebar
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('chatSidebar');
            sidebar.classList.add('hidden');
            sidebar.classList.add('lg:block');
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

// Scroll to bottom of chat
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// Load chat list
async function loadChatList() {
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        const chatList = document.getElementById('chatList');
        chatList.innerHTML = ''; // Clear existing chats
        
        if (data.chats && data.chats.length > 0) {
            data.chats.forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                chatItem.dataset.chatId = chat.id;
                if (chat.id === currentChatId) {
                    chatItem.classList.add('active');
                }
                
                // Format the date
                const date = new Date(chat.updated_at || chat.created_at);
                const formattedDate = date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                chatItem.innerHTML = `
                    <div class="chat-item-content">
                        <div class="chat-title">${chat.title || 'New Chat'}</div>
                        <div class="chat-time">${formattedDate}</div>
                    </div>
                `;
                
                chatItem.addEventListener('click', () => loadChat(chat.id));
                chatList.appendChild(chatItem);
            });
        } else {
            chatList.innerHTML = '<div class="text-center p-4 text-gray-500">No chats yet</div>';
        }
    } catch (error) {
        console.error('Error loading chat list:', error);
        showToast('Failed to load chat list', 'error');
    }
}

// Add delete all chats functionality
async function handleDeleteAll() {
    try {
        // First, fetch the list of chats to ensure we have the latest data
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        if (!data.chats || data.chats.length === 0) {
            showToast('No chats to delete', 'info');
            return;
        }

        // Create and show confirmation dialog
        const dialog = document.createElement('div');
        dialog.innerHTML = `
            <div class="dialog-overlay"></div>
            <div class="confirmation-dialog">
                <div class="dialog-content">
                    <p>Are you sure you want to delete all ${data.chats.length} chats? This action cannot be undone.</p>
                </div>
                <div class="dialog-buttons">
                    <button class="dialog-button dialog-button-cancel">Cancel</button>
                    <button class="dialog-button dialog-button-confirm">Delete All</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Handle dialog actions
        return new Promise((resolve) => {
            const overlay = dialog.querySelector('.dialog-overlay');
            const cancelBtn = dialog.querySelector('.dialog-button-cancel');
            const confirmBtn = dialog.querySelector('.dialog-button-confirm');

            const closeDialog = () => {
                document.body.removeChild(dialog);
                resolve(false);
            };

            overlay.addEventListener('click', closeDialog);
            cancelBtn.addEventListener('click', closeDialog);

            confirmBtn.addEventListener('click', async () => {
                try {
                    // Show loading state
                    const loadingToast = showToast('Deleting all chats...', 'info', false);
                    let deletedCount = 0;
                    let errorCount = 0;

                    // Delete chats one by one
                    for (const chat of data.chats) {
                        try {
                            const response = await fetch(`/api/chats/${chat.id}`, {
                                method: 'DELETE'
                            });

                            if (response.ok) {
                                deletedCount++;
                                // If this was the active chat, clear the messages
                                if (currentChatId === chat.id) {
                                    clearChat();
                                    currentChatId = null;
                                }
                            } else {
                                errorCount++;
                                console.error(`Failed to delete chat ${chat.id}`);
                            }
                        } catch (error) {
                            errorCount++;
                            console.error(`Error deleting chat ${chat.id}:`, error);
                        }
                    }

                    // Remove loading toast
                    loadingToast.remove();

                    // Show result message
                    if (deletedCount > 0) {
                        showToast(`Successfully deleted ${deletedCount} chat${deletedCount !== 1 ? 's' : ''}`, 'success');
                    }
                    if (errorCount > 0) {
                        showToast(`Failed to delete ${errorCount} chat${errorCount !== 1 ? 's' : ''}`, 'error');
                    }

                    // Refresh chat list
                    await loadChatList();
                    
                    document.body.removeChild(dialog);
                    resolve(true);
                } catch (error) {
                    console.error('Error in delete all operation:', error);
                    showToast('Failed to delete all chats', 'error');
                    document.body.removeChild(dialog);
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Error fetching chats:', error);
        showToast('Failed to fetch chats', 'error');
    }
}

// Add event listener for delete all button
document.getElementById('deleteAllChatsBtn').addEventListener('click', handleDeleteAll);

// Helper function to clear the current chat
function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    currentChatId = null;
} 