document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggling
    const themeToggle = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;
    const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

    if (themeToggle && themeIcon) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        htmlEl.setAttribute('data-theme', savedTheme);
        updateIcon(savedTheme);

        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlEl.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            htmlEl.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateIcon(newTheme);
        });
    }

    function updateIcon(theme) {
        if (theme === 'dark') {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }

    // Highlight active sidebar links
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Global AI Search Input Handler with Autocomplete Suggestions
    const globalSearchInput = document.getElementById('global-ai-search');
    if (globalSearchInput) {
        // Create dynamic autocomplete suggestions container
        const searchBox = globalSearchInput.parentElement;
        const suggestionBox = document.createElement('div');
        suggestionBox.className = 'search-suggestions-dropdown card card-glass position-absolute d-none p-3';
        suggestionBox.style.top = '100%';
        suggestionBox.style.left = '0';
        suggestionBox.style.width = '100%';
        suggestionBox.style.zIndex = '1000';
        suggestionBox.style.maxHeight = '300px';
        suggestionBox.style.overflowY = 'auto';
        searchBox.appendChild(suggestionBox);

        let debounceTimeout;

        globalSearchInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            const query = globalSearchInput.value.trim();

            debounceTimeout = setTimeout(() => {
                fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`)
                    .then(res => res.json())
                    .then(data => {
                        suggestionBox.innerHTML = '';
                        let hasContent = false;

                        if (data.suggestions && data.suggestions.length > 0) {
                            hasContent = true;
                            suggestionBox.innerHTML += `<div class="fw-bold text-xs text-uppercase text-secondary mb-1">Suggestions</div>`;
                            data.suggestions.forEach(item => {
                                suggestionBox.innerHTML += `<div class="suggestion-item p-1 text-primary clickable" style="cursor:pointer;" onclick="selectSearch('${item}')">${item}</div>`;
                            });
                        }

                        if (data.recent && data.recent.length > 0) {
                            hasContent = true;
                            suggestionBox.innerHTML += `<div class="fw-bold text-xs text-uppercase text-secondary mt-2 mb-1">Recent Searches</div>`;
                            data.recent.forEach(item => {
                                suggestionBox.innerHTML += `<div class="suggestion-item p-1 text-secondary clickable" style="cursor:pointer;" onclick="selectSearch('${item}')"><i class="fa-solid fa-history me-1"></i>${item}</div>`;
                            });
                        }

                        if (data.popular && data.popular.length > 0) {
                            hasContent = true;
                            suggestionBox.innerHTML += `<div class="fw-bold text-xs text-uppercase text-secondary mt-2 mb-1">Popular Searches</div>`;
                            data.popular.forEach(item => {
                                suggestionBox.innerHTML += `<div class="suggestion-item p-1 text-success clickable" style="cursor:pointer;" onclick="selectSearch('${item}')"><i class="fa-solid fa-fire me-1"></i>${item}</div>`;
                            });
                        }

                        if (hasContent) {
                            suggestionBox.classList.remove('d-none');
                        } else {
                            suggestionBox.classList.add('d-none');
                        }
                    });
            }, 300);
        });

        globalSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = globalSearchInput.value.trim();
                if (query) {
                    window.location.href = `/search?q=${encodeURIComponent(query)}`;
                }
            }
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!searchBox.contains(e.target)) {
                suggestionBox.classList.add('d-none');
            }
        });

        // Add globally accessible selection helper
        window.selectSearch = function(val) {
            globalSearchInput.value = val;
            window.location.href = `/search?q=${encodeURIComponent(val)}`;
        };
    }

    // Floating Chatbot Handlers
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
    const chatbotBox = document.getElementById('chatbot-box');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotClearBtn = document.getElementById('chatbot-clear-btn');
    const chatbotForm = document.getElementById('chatbot-form');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotMessages = document.getElementById('chatbot-messages');

    if (chatbotToggleBtn && chatbotBox) {
        chatbotToggleBtn.addEventListener('click', () => {
            chatbotBox.classList.toggle('d-none');
            if (!chatbotBox.classList.contains('d-none')) {
                loadChatHistory();
            }
        });

        chatbotCloseBtn.addEventListener('click', () => {
            chatbotBox.classList.add('d-none');
        });

        chatbotClearBtn.addEventListener('click', () => {
            if (confirm("Clear chatbot history?")) {
                fetch('/api/chat', { method: 'DELETE' })
                    .then(() => {
                        chatbotMessages.innerHTML = '';
                    });
            }
        });

        chatbotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatbotInput.value.trim();
            if (!text) return;

            appendChatMessage('user', text, 'Just now');
            chatbotInput.value = '';

            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            })
            .then(res => res.json())
            .then(data => {
                if (data.reply) {
                    appendChatMessage('ai', data.reply, data.timestamp);
                }
            })
            .catch(() => {
                appendChatMessage('ai', 'Error sending message. Check server connection.', 'Error');
            });
        });
    }

    function loadChatHistory() {
        chatbotMessages.innerHTML = '<div class="text-center py-4 text-secondary">Loading chat logs...</div>';
        fetch('/api/chat')
            .then(res => res.json())
            .then(data => {
                chatbotMessages.innerHTML = '';
                if (data.length === 0) {
                    chatbotMessages.innerHTML = '<div class="text-center py-4 text-secondary">No chat history. Ask me anything about programming!</div>';
                    return;
                }
                data.forEach(c => {
                    appendChatMessage(c.sender, c.message, c.timestamp);
                });
            });
    }

    function appendChatMessage(sender, message, timestamp) {
        const wrapper = document.createElement('div');
        wrapper.className = `mb-3 d-flex flex-column ${sender === 'user' ? 'align-items-end' : 'align-items-start'}`;
        
        const bubble = document.createElement('div');
        bubble.className = `p-2 rounded ${sender === 'user' ? 'bg-primary text-white' : 'card-glass text-primary'}`;
        bubble.style.maxWidth = '80%';
        bubble.style.wordBreak = 'break-word';
        
        if (sender === 'ai') {
            bubble.innerHTML = typeof marked !== 'undefined' ? marked.parse(message) : message;
            if (typeof hljs !== 'undefined') {
                bubble.querySelectorAll('pre code').forEach((el) => {
                    hljs.highlightElement(el);
                });
            }
        } else {
            bubble.innerText = message;
        }

        const timeSpan = document.createElement('small');
        timeSpan.className = 'text-muted mt-1';
        timeSpan.style.fontSize = '0.75rem';
        timeSpan.innerText = timestamp;

        wrapper.appendChild(bubble);
        wrapper.appendChild(timeSpan);
        chatbotMessages.appendChild(wrapper);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Global Toast Notification Utility
    window.showToast = function(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'warning' ? 'warning text-dark' : 'danger'} border-0 show`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.style.marginBottom = '10px';
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 4000);
    };
});
