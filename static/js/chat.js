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

// Add adjustContainerHeights function at the top level
function adjustContainerHeights() {
    const chatMessages = document.getElementById('chatMessages');
    const inputContainer = document.getElementById('inputContainer');
    const chatContainer = document.getElementById('chatContainer');
    
    if (chatMessages && inputContainer && chatContainer) {
        // Get the height of the input container
        const inputHeight = inputContainer.offsetHeight;
        
        // Calculate the available height for messages
        const containerHeight = chatContainer.offsetHeight;
        const headerHeight = document.querySelector('.chat-header')?.offsetHeight || 0;
        const messagesHeight = containerHeight - headerHeight - inputHeight;
        
        // Set the height of the messages container
        chatMessages.style.height = `${messagesHeight}px`;
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all event listeners and load initial data
    initializeChat();
    initializeSidebar(); // Initialize sidebar state
    initializeScrollButtons(); // Initialize scroll navigation
    initializeTextArea();
    
    // Ensure proper sizing of containers
    adjustContainerHeights();
    
    // Call again after a short delay to ensure all elements are rendered
    setTimeout(adjustContainerHeights, 100);
    
    // Listen for window resize events
    window.addEventListener('resize', adjustContainerHeights);
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
    const sidebar = document.querySelector('.chat-sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (!sidebar || !toggleBtn) return;
    
    const isCollapsed = sidebar.classList.contains('collapsed');
    const icon = toggleBtn.querySelector('i');
    
    if (icon) {
        icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }
}

// Send message
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;
    
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = 'message message--user';
    messageDiv.innerHTML = marked.parse(message);
    chatMessages.appendChild(messageDiv);
    
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
        errorDiv.className = 'message message--error';
        errorDiv.textContent = `Error: ${error.message}`;
        chatMessages.appendChild(errorDiv);
    }
}

// Update streaming message
function updateStreamingMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const lastMessage = chatMessages.querySelector('.message--assistant:last-child');
    
    if (lastMessage) {
        lastMessage.innerHTML = marked.parse(message);
        addCopyButtonsToCodeBlocks(lastMessage);
    } else {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message--assistant';
        messageDiv.innerHTML = marked.parse(message);
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
                messageDiv.className = 'message message--user';
            } else if (msg.role === 'assistant') {
                messageDiv.className = 'message message--assistant';
            } else {
                messageDiv.className = `message message--${msg.role}`;
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
        chatList.innerHTML = '';
        
        if (data.chats && data.chats.length > 0) {
            data.chats.forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                chatItem.dataset.chatId = chat.id;
                if (chat.id === currentChatId) {
                    chatItem.classList.add('chat-item--active');
                }
                
                const date = new Date(chat.updated_at || chat.created_at);
                const formattedDate = date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                chatItem.innerHTML = `
                    <div class="chat-item__content">
                        <div class="chat-item__title">${chat.title || 'New Chat'}</div>
                        <div class="chat-item__time">${formattedDate}</div>
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

// Add at the beginning of the file, after variable declarations
function initializeSidebar() {
    const appContainer = document.querySelector('.app');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    // Initialize sidebar state from localStorage
    if (sidebarCollapsed) {
        appContainer.classList.add('app--sidebar-collapsed');
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle sidebar collapsed state
            appContainer.classList.toggle('app--sidebar-collapsed');
            
            // Update localStorage
            sidebarCollapsed = appContainer.classList.contains('app--sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
            
            // Adjust container heights after animation
            setTimeout(adjustContainerHeights, 300);
        });
    }
}

// Update initializeTextArea function with better event handling
function initializeTextArea() {
    const userInput = document.getElementById('userInput');
    const resizeHandle = document.getElementById('resizeHandle');
    let startY, startHeight;
    let isDragging = false;

    function updateTextAreaHeight(height) {
        height = Math.max(60, Math.min(300, height));
        userInput.style.height = `${height}px`;
        userInput.parentElement.style.height = `${height}px`;
        adjustContainerHeights();
    }

    function getEventY(e) {
        if (e.type.startsWith('touch')) {
            return e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? e.clientY;
        }
        return e.clientY;
    }

    function initDrag(e) {
        isDragging = true;
        startY = getEventY(e);
        startHeight = userInput.offsetHeight;
        
        // Disable transitions
        userInput.style.transition = 'none';
        userInput.parentElement.style.transition = 'none';
        
        // Prevent text selection
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDrag(e) {
        if (!isDragging) return;
        
        const currentY = getEventY(e);
        if (typeof currentY !== 'number') return;
        
        const delta = startY - currentY;
        const newHeight = startHeight + delta;
        
        requestAnimationFrame(() => {
            updateTextAreaHeight(newHeight);
        });
        
        e.preventDefault();
        e.stopPropagation();
    }

    function stopDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        
        // Re-enable transitions
        userInput.style.transition = '';
        userInput.parentElement.style.transition = '';
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        
        // Ensure final height is within bounds
        const finalHeight = userInput.offsetHeight;
        updateTextAreaHeight(finalHeight);
    }

    // Mouse events
    resizeHandle.addEventListener('mousedown', initDrag);
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);

    // Touch events
    resizeHandle.addEventListener('touchstart', initDrag, { passive: false });
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    document.addEventListener('touchcancel', stopDrag);

    // Auto-resize on input
    userInput.addEventListener('input', function() {
        if (!isDragging) {
            this.style.height = '60px';
            const newHeight = Math.min(this.scrollHeight, 300);
            updateTextAreaHeight(newHeight);
        }
    });

    // Set initial height
    updateTextAreaHeight(60);

    // Return cleanup function
    return () => {
        resizeHandle.removeEventListener('mousedown', initDrag);
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        resizeHandle.removeEventListener('touchstart', initDrag);
        document.removeEventListener('touchmove', handleDrag);
        document.removeEventListener('touchend', stopDrag);
        document.removeEventListener('touchcancel', stopDrag);
    };
} 