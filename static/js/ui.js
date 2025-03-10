// UI functionality

// Initialize chat UI
function initializeChat() {
    // Initialize sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Initialize resizable input
    initResizable();

    // Load initial data
    loadModels();
    loadChats();

    // Initialize other event listeners
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const newChatBtn = document.getElementById('newChatBtn');

    if (sendButton && userInput) {
        sendButton.addEventListener('click', function() {
            sendMessage();
        });

        userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }

    // Initialize model selector
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            currentModel = this.value;
            localStorage.setItem('selectedModel', currentModel);
        });
    }
}

// Toggle sidebar visibility
function toggleSidebar() {
    console.log("Toggle sidebar called");
    const sidebar = document.getElementById('chatSidebar');
    const container = document.getElementById('chatContainer');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (!sidebar || !container) {
        console.error("Sidebar or container not found");
        return;
    }
    
    console.log("Before toggle:", sidebar.classList.contains('collapsed'));
    sidebar.classList.toggle('collapsed');
    console.log("After toggle:", sidebar.classList.contains('collapsed'));
    
    // Update container margin based on sidebar state
    if (sidebar.classList.contains('collapsed')) {
        console.log("Sidebar is now collapsed");
        container.style.marginLeft = '0';
        localStorage.setItem('sidebarCollapsed', 'true');
        if (toggleBtn) {
            toggleBtn.setAttribute('title', 'Expand sidebar');
        }
    } else {
        console.log("Sidebar is now expanded");
        container.style.marginLeft = '300px';
        localStorage.setItem('sidebarCollapsed', 'false');
        if (toggleBtn) {
            toggleBtn.setAttribute('title', 'Collapse sidebar');
        }
    }
    
    // Update the sidebar toggle icon
    if (typeof updateSidebarToggleIcon === 'function') {
        updateSidebarToggleIcon();
    } else {
        // Fallback if the function is not available
        const icon = toggleBtn?.querySelector('i');
        if (icon) {
            icon.className = ''; // Clear all classes
            icon.classList.add('fas', sidebar.classList.contains('collapsed') ? 'fa-chevron-right' : 'fa-chevron-left');
        }
    }
    
    // Force a reflow to ensure transitions work properly
    window.getComputedStyle(sidebar).transform;
    
    // Adjust container heights after sidebar toggle
    adjustContainerHeights();
}

// Initialize sidebar state from localStorage
function initializeSidebar() {
    console.log("Initializing sidebar");
    const sidebar = document.getElementById('chatSidebar');
    const container = document.getElementById('chatContainer');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (!sidebar || !container) {
        console.error("Sidebar or container not found during initialization");
        return;
    }
    
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    console.log("Sidebar collapsed state from localStorage:", isCollapsed);
    
    if (isCollapsed) {
        console.log("Setting sidebar to collapsed");
        sidebar.classList.add('collapsed');
        container.style.marginLeft = '0';
        if (toggleBtn) {
            toggleBtn.setAttribute('title', 'Expand sidebar');
        }
    } else {
        console.log("Setting sidebar to expanded");
        sidebar.classList.remove('collapsed');
        container.style.marginLeft = '300px';
        if (toggleBtn) {
            toggleBtn.setAttribute('title', 'Collapse sidebar');
        }
    }
    
    // Update the sidebar toggle icon
    if (typeof updateSidebarToggleIcon === 'function') {
        updateSidebarToggleIcon();
    } else {
        // Fallback if the function is not available
        const icon = toggleBtn?.querySelector('i');
        if (icon) {
            icon.className = ''; // Clear all classes
            icon.classList.add('fas', isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left');
        }
    }
    
    // Adjust container heights after setting initial sidebar state
    adjustContainerHeights();
}

// Initialize resizable input area
function initResizable() {
    const resizeHandle = document.getElementById('resizeHandle');
    const inputContainer = document.getElementById('inputContainer');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!resizeHandle || !inputContainer || !chatMessages) return;
    
    let startY, startHeight;
    
    resizeHandle.addEventListener('mousedown', startResize);
    
    function startResize(e) {
        startY = e.clientY;
        startHeight = parseInt(window.getComputedStyle(inputContainer).height, 10);
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        // Prevent text selection during resize
        e.preventDefault();
    }
    
    function resize(e) {
        const newHeight = startHeight - (e.clientY - startY);
        
        // Set min and max height constraints
        if (newHeight > 60 && newHeight < 300) {
            inputContainer.style.height = `${newHeight}px`;
            
            // Adjust chat messages container to fill remaining space
            adjustContainerHeights();
        }
    }
    
    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
}

// Load chat history
async function loadChats() {
    try {
        const response = await fetch('/api/chats');
        if (!response.ok) throw new Error('Failed to load chats');
        
        const data = await response.json();
        const chatList = document.getElementById('chatList');
        
        if (chatList) {
            chatList.innerHTML = '';
            
            if (data.chats.length === 0) {
                chatList.innerHTML = '<div class="text-center p-4" style="color: var(--text-secondary);">No chats yet. Start a new conversation!</div>';
                return;
            }
            
            data.chats.forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                if (chat.id === currentChatId) {
                    chatItem.classList.add('active');
                }
                
                const date = new Date(chat.created_at);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                chatItem.innerHTML = `
                    <div class="chat-item-content">
                        <div>
                            <div class="chat-title">${chat.title || 'New Chat'}</div>
                            <div class="chat-time">${formattedDate}</div>
                        </div>
                        <div class="chat-item-actions">
                            <button onclick="deleteChat('${chat.id}')" title="Delete chat">
                                <i class="fas fa-trash" style="color: var(--color-error);"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                chatItem.addEventListener('click', function(e) {
                    // Don't trigger if clicking on the delete button
                    if (e.target.closest('.chat-item-actions')) return;
                    
                    loadChat(chat.id);
                });
                
                chatList.appendChild(chatItem);
            });
        }
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Delete a chat
async function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
        const response = await fetch(`/api/chats/${chatId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete chat');
        
        // If we deleted the current chat, clear the messages
        if (chatId === currentChatId) {
            currentChatId = null;
            document.getElementById('chatMessages').innerHTML = '';
            // Start a new chat automatically
            await startNewChat();
        } else {
            // Just refresh the chat list
            await loadChats();
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}

// Start a new chat
async function startNewChat() {
    try {
        const response = await fetch('/api/chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        if (!response.ok) throw new Error('Failed to create new chat');
        
        const data = await response.json();
        loadChat(data.chat_id);
    } catch (error) {
        console.error('Error creating new chat:', error);
    }
}

// Load available models
async function loadModels() {
    try {
        console.log("Loading models...");
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error('Failed to load models');
        
        const data = await response.json();
        console.log("Models data:", data);
        
        const modelSelect = document.getElementById('modelSelect');
        
        if (modelSelect) {
            modelSelect.innerHTML = '';
            
            // Check if data.models exists
            if (!data.models) {
                console.error("No models property in response");
                modelSelect.innerHTML = '<option value="">No models available</option>';
                return;
            }
            
            // Handle different response formats
            let modelsList = data.models;
            
            // If models is an object with a models property (nested structure)
            if (!Array.isArray(modelsList) && modelsList.models) {
                console.log("Found nested models structure");
                modelsList = modelsList.models;
            }
            
            // Ensure modelsList is an array
            if (!Array.isArray(modelsList)) {
                console.error("Models is not an array:", modelsList);
                modelSelect.innerHTML = '<option value="">No models available</option>';
                return;
            }
            
            if (modelsList.length === 0) {
                console.log("Empty models list");
                modelSelect.innerHTML = '<option value="">No models available</option>';
                return;
            }
            
            console.log("Processing models:", modelsList);
            
            // Get previously selected model from localStorage or use default
            const savedModel = localStorage.getItem('selectedModel');
            let defaultModel = data.default_model || '';
            
            // If default_model is nested in the models object
            if (!defaultModel && data.models.default_model) {
                defaultModel = data.models.default_model;
            }
            
            modelsList.forEach(model => {
                const option = document.createElement('option');
                
                // Handle both string models and object models
                const modelId = typeof model === 'object' ? (model.name || model.id) : model;
                const modelName = typeof model === 'object' ? (model.name || model.id) : model;
                
                option.value = modelId;
                option.textContent = modelName;
                
                // Select the saved model, default model, or first model
                if (savedModel === modelId) {
                    option.selected = true;
                    currentModel = modelId;
                } else if (!savedModel && !currentModel && modelId === defaultModel) {
                    option.selected = true;
                    currentModel = modelId;
                } else if (!savedModel && !currentModel && !defaultModel && modelsList.indexOf(model) === 0) {
                    // If no saved model, no current model, and no default model, select the first one
                    option.selected = true;
                    currentModel = modelId;
                }
                
                modelSelect.appendChild(option);
            });
            
            // If we set a current model, save it
            if (currentModel) {
                localStorage.setItem('selectedModel', currentModel);
            }
            
            console.log("Models loaded successfully. Current model:", currentModel);
        }
    } catch (error) {
        console.error('Error loading models:', error);
        // Fallback to a safe default if everything fails
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.innerHTML = '<option value="default">Default Model</option>';
            currentModel = 'default';
        }
    }
}

// Adjust container heights to ensure proper layout
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
        
        // Scroll to bottom of messages
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
} 