// Load theme from environment
async function loadTheme() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to load settings');
        const settings = await response.json();
        
        // Apply theme
        if (settings.theme_mode === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Update theme button if it exists
        const themeButton = document.getElementById('themeMode');
        if (themeButton) {
            const icon = themeButton.querySelector('i');
            const text = themeButton.querySelector('span');
            if (settings.theme_mode === 'dark') {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                text.textContent = 'Dark Mode';
            }
        }
    } catch (error) {
        console.error('Error loading theme:', error);
    }
}

// Toggle theme
async function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    const themeMode = isDark ? 'dark' : 'light';
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                theme_mode: themeMode
            })
        });
        
        if (!response.ok) throw new Error('Failed to update theme');
        
        // Update theme button if it exists
        const themeButton = document.getElementById('themeMode');
        if (themeButton) {
            const icon = themeButton.querySelector('i');
            const text = themeButton.querySelector('span');
            if (isDark) {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                text.textContent = 'Dark Mode';
            }
        }
    } catch (error) {
        console.error('Error updating theme:', error);
        // Revert theme if update failed
        document.body.classList.toggle('dark-mode');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }, 100);
}

// Theme management
function initTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    const themeToggle = document.getElementById('themeToggle');
    
    // Apply initial theme
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
    
    // Set up theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', initTheme); 