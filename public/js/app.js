class PhilosopherChatApp {
    constructor() {
        this.socket = null;
        this.conversationId = null;
        this.currentPage = 1;
        this.messagesPerPage = 20;
        this.allMessages = [];
        this.availableProviders = [];
        this.activeProviders = new Set();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectSocket();
        this.checkProviderStatus();
        this.loadRecentConversations();
    }

    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.startConversation());
        document.getElementById('topicInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startConversation();
        });
        
        document.querySelectorAll('.topic-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                document.getElementById('topicInput').value = e.target.dataset.topic;
            });
        });

        // Temperature slider updates
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = e.target.value;
        });

        document.getElementById('modalTemperature').addEventListener('input', (e) => {
            document.getElementById('modalTempValue').textContent = e.target.value;
        });

        document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('nextRoundBtn').addEventListener('click', () => this.requestAIResponses());
        document.getElementById('endConversationBtn').addEventListener('click', () => this.endConversation());
        document.getElementById('configBtn').addEventListener('click', () => this.showConfigModal());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportConversation());
        document.getElementById('historyBtn').addEventListener('click', () => this.showHistoryModal());

        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));

        // Modal events
        document.getElementById('closeConfigModal').addEventListener('click', () => this.hideConfigModal());
        document.getElementById('cancelConfigBtn').addEventListener('click', () => this.hideConfigModal());
        document.getElementById('applyConfigBtn').addEventListener('click', () => this.applyConfiguration());

        // Click outside modal to close
        document.getElementById('configModal').addEventListener('click', (e) => {
            if (e.target.id === 'configModal') {
                this.hideConfigModal();
            }
        });

        // Summary modal events
        document.getElementById('closeSummaryModal').addEventListener('click', () => this.hideSummaryModal());
        document.getElementById('closeSummaryBtn').addEventListener('click', () => this.hideSummaryModal());
        document.getElementById('downloadSummaryBtn').addEventListener('click', () => this.downloadSummary());

        document.getElementById('summaryModal').addEventListener('click', (e) => {
            if (e.target.id === 'summaryModal') {
                this.hideSummaryModal();
            }
        });

        // History modal events
        document.getElementById('closeHistoryModal').addEventListener('click', () => this.hideHistoryModal());
        document.getElementById('closeHistoryBtn').addEventListener('click', () => this.hideHistoryModal());
        document.getElementById('newConversationBtn').addEventListener('click', () => this.startNewConversation());
        document.getElementById('searchBtn').addEventListener('click', () => this.searchConversations());
        document.getElementById('historySearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchConversations();
        });

        document.getElementById('historyModal').addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') {
                this.hideHistoryModal();
            }
        });

        // Landing page history events
        document.getElementById('viewAllHistoryBtn').addEventListener('click', () => this.showHistoryModal());
    }

    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateStatus('ready', 'Connected - Ready to start');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('error', 'Disconnected from server');
        });

        this.socket.on('conversation-state', (data) => {
            this.allMessages = data.history || [];
            this.displayMessages();
            this.updateAnalytics(data.analytics);
        });

        this.socket.on('new-message', (message) => {
            this.allMessages.push(message);
            this.displayMessages();
            this.scrollToBottom();
        });

        this.socket.on('ai-thinking', (data) => {
            this.showThinkingIndicator(data.provider);
            this.updateAIStatus(`${data.provider} is thinking...`);
        });

        this.socket.on('ai-error', (data) => {
            this.hideThinkingIndicator();
            this.updateAIStatus(`${data.provider} encountered an error: ${data.error}`);
        });

        this.socket.on('demo-response', (data) => {
            this.updateAIStatus(data.message);
        });

        this.socket.on('analytics-update', (data) => {
            this.updateThemes(data.themes);
            this.updateWordMap(data.wordMap);
        });

        this.socket.on('summary-generating', (data) => {
            this.updateSummaryProgress(data.status);
        });

        this.socket.on('summary-generated', (data) => {
            this.displaySummary(data.summary);
        });

        this.socket.on('providers-updated', (data) => {
            this.updateAIControls(data.providers);
        });

        this.socket.on('auto-round-notification', (data) => {
            this.showAutoRoundNotification(data);
            this.updateAIStatus(data.message);
        });

        this.socket.on('auto-round-complete', (data) => {
            this.showNotification(data.message, 'success');
            this.updateAIStatus(data.message);
        });

        this.socket.on('moderation-pause', (data) => {
            this.showModerationPauseNotification(data);
            this.updateAIStatus(data.message);
        });

        this.socket.on('random-selection', (data) => {
            this.showRandomSelectionNotification(data);
            this.updateAIStatus('Random selection: ' + data.message.replace('🎲 ', ''));
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.updateStatus('error', error.message);
        });
    }

    async checkProviderStatus() {
        try {
            const response = await fetch('/api/providers');
            const data = await response.json();
            
            this.availableProviders = data.providers || [];
            this.activeProviders = new Set(this.availableProviders.map(p => p.name));
            
            if (!data.available) {
                this.updateAIStatus('Demo mode - Add API keys for full functionality');
            } else {
                this.updateAIStatus(`${data.providers.length} AI provider(s) available: ${data.providers.map(p => p.name).join(', ')}`);
            }
        } catch (error) {
            console.error('Failed to check provider status:', error);
        }
    }

    async startConversation() {
        const topic = document.getElementById('topicInput').value.trim();
        if (!topic) {
            alert('Please enter a topic for discussion');
            return;
        }

        const config = {
            maxTokens: parseInt(document.getElementById('maxTokens').value),
            temperature: parseFloat(document.getElementById('temperature').value),
            autoRounds: document.getElementById('autoRounds').checked,
            moderationPause: parseInt(document.getElementById('moderationPause').value)
        };

        try {
            this.updateStatus('connecting', 'Starting conversation...');
            
            const response = await fetch('/api/conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, config })
            });

            const data = await response.json();
            this.conversationId = data.conversationId;

            document.getElementById('setupPanel').style.display = 'none';
            document.getElementById('mainInterface').style.display = 'flex';
            document.getElementById('conversationTopic').textContent = topic;
            
            this.displayParticipants(data.participants);
            this.socket.emit('join-conversation', this.conversationId);
            this.initializeAIControls();
            
            this.updateStatus('ready', 'Conversation started');
            
        } catch (error) {
            console.error('Failed to start conversation:', error);
            this.updateStatus('error', 'Failed to start conversation');
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;

        this.socket.emit('human-message', {
            conversationId: this.conversationId,
            message
        });

        messageInput.value = '';
        this.updateAIStatus('Processing your message...');
    }

    requestAIResponses() {
        this.socket.emit('request-ai-responses', this.conversationId);
        this.updateAIStatus('Requesting AI responses...');
    }

    endConversation() {
        if (!this.conversationId) {
            this.showNotification('No active conversation to end', 'error');
            return;
        }
        
        this.showSummaryModal();
        this.socket.emit('end-conversation', this.conversationId);
        this.updateAIStatus('Ending conversation and generating summary...');
    }

    displayParticipants(participants) {
        const container = document.getElementById('participants');
        container.innerHTML = participants.map(name => 
            `<span class="participant">${name}</span>`
        ).join('');
    }

    displayMessages() {
        const container = document.getElementById('messages');
        const startIndex = (this.currentPage - 1) * this.messagesPerPage;
        const endIndex = startIndex + this.messagesPerPage;
        const paginated = this.allMessages.slice(startIndex, endIndex);

        container.innerHTML = paginated.map(msg => this.formatMessage(msg)).join('');
        
        this.updatePagination();
        this.hideThinkingIndicator();
    }

    formatMessage(message) {
        const isHuman = message.speaker === 'Human';
        const speakerClass = isHuman ? 'human' : `ai ${message.speaker.toLowerCase()}`;
        const timestamp = new Date(message.timestamp).toLocaleTimeString();

        return `
            <div class="message ${speakerClass}">
                <div class="message-header">
                    <span class="speaker">${message.speaker}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${this.formatContent(message.content)}</div>
            </div>
        `;
    }

    formatContent(content) {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    showThinkingIndicator(provider) {
        const container = document.getElementById('messages');
        this.hideThinkingIndicator(); // Remove any existing indicator
        
        const indicator = document.createElement('div');
        indicator.className = 'thinking-indicator';
        indicator.id = 'thinkingIndicator';
        indicator.innerHTML = `
            <span>${provider} is thinking</span>
            <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        container.appendChild(indicator);
        this.scrollToBottom();
    }

    hideThinkingIndicator() {
        const indicator = document.getElementById('thinkingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    initializeAIControls() {
        const container = document.getElementById('aiControlsContainer');
        
        if (this.availableProviders.length === 0) {
            container.innerHTML = '<div class="no-data">No AI providers available</div>';
            return;
        }

        container.innerHTML = this.availableProviders.map(provider => {
            const isActive = this.activeProviders.has(provider.name);
            const iconClass = provider.name.toLowerCase();
            const iconText = provider.name.charAt(0);
            
            return `
                <div class="ai-control-item">
                    <div class="ai-provider-info">
                        <div class="ai-provider-icon ${iconClass}">${iconText}</div>
                        <span class="ai-provider-name">${provider.name}</span>
                    </div>
                    <div class="ai-toggle ${isActive ? 'active' : ''}" data-provider="${provider.name}"></div>
                </div>
            `;
        }).join('');

        // Add click handlers for toggles
        container.querySelectorAll('.ai-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const providerName = e.target.dataset.provider;
                this.toggleAIProvider(providerName);
            });
        });
    }

    toggleAIProvider(providerName) {
        if (this.activeProviders.has(providerName)) {
            this.activeProviders.delete(providerName);
        } else {
            this.activeProviders.add(providerName);
        }

        // Update UI
        const toggle = document.querySelector(`.ai-toggle[data-provider="${providerName}"]`);
        if (toggle) {
            toggle.classList.toggle('active', this.activeProviders.has(providerName));
        }

        // Notify server
        this.socket.emit('update-active-providers', {
            conversationId: this.conversationId,
            activeProviders: Array.from(this.activeProviders)
        });

        const status = this.activeProviders.has(providerName) ? 'enabled' : 'disabled';
        this.updateAIStatus(`${providerName} ${status}`);
    }

    updateThemes(themes) {
        const container = document.getElementById('themesContainer');
        
        if (!themes || themes.length === 0) {
            container.innerHTML = '<div class="no-data">No unique ideas detected yet...</div>';
            return;
        }

        container.innerHTML = themes.map(theme => {
            const typeIcon = {
                'concept': 'fa-lightbulb',
                'argument': 'fa-balance-scale',
                'definition': 'fa-book',
                'thought_experiment': 'fa-flask',
                'insight': 'fa-eye',
                'framework': 'fa-sitemap',
                'paradox': 'fa-question-circle',
                'connection': 'fa-link',
                'question': 'fa-question',
                'key_concept': 'fa-key',
                'legacy_theme': 'fa-tag'
            }[theme.type] || 'fa-comment';

            const typeLabel = {
                'concept': 'Concept',
                'argument': 'Argument',
                'definition': 'Definition',
                'thought_experiment': 'Thought Experiment',
                'insight': 'Insight',
                'framework': 'Framework',
                'paradox': 'Paradox',
                'connection': 'Connection',
                'question': 'Question',
                'key_concept': 'Key Concept',
                'legacy_theme': 'Theme'
            }[theme.type] || 'Idea';

            return `
                <div class="unique-idea-item">
                    <div class="idea-header">
                        <div class="idea-type">
                            <i class="fas ${typeIcon}"></i>
                            <span class="type-label">${typeLabel}</span>
                            ${theme.count > 1 ? `<span class="recurrence-badge">${theme.count}x</span>` : ''}
                        </div>
                    </div>
                    <div class="idea-name">${theme.name}</div>
                    <div class="idea-summary">${theme.summary}</div>
                </div>
            `;
        }).join('');
    }

    updateWordMap(wordMap) {
        const container = document.getElementById('wordmapContainer');
        
        if (!wordMap || wordMap.length === 0) {
            container.innerHTML = '<div class="no-data">Word map will populate as the discussion progresses...</div>';
            return;
        }

        const wordCloudHtml = wordMap.map(word => `
            <span class="word-item size-${word.size}" 
                  data-frequency="${Math.min(word.frequency, 5)}" 
                  title="${word.word}: ${word.frequency} occurrences">
                ${word.word}
            </span>
        `).join('');

        container.innerHTML = `<div class="word-cloud">${wordCloudHtml}</div>`;
    }

    updateAnalytics(analytics) {
        if (!analytics) return;
        
        this.updateThemes(analytics.themes);
        this.updateWordMap(analytics.wordMap);
    }

    updatePagination() {
        const totalPages = Math.ceil(this.allMessages.length / this.messagesPerPage);
        
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages}`;
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
        
        const paginationControls = document.getElementById('paginationControls');
        paginationControls.style.display = totalPages > 1 ? 'flex' : 'none';
    }

    changePage(direction) {
        const totalPages = Math.ceil(this.allMessages.length / this.messagesPerPage);
        const newPage = this.currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.displayMessages();
        }
    }

    scrollToBottom() {
        const container = document.getElementById('chatContainer');
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    updateStatus(type, message) {
        const indicator = document.getElementById('statusIndicator');
        const icon = indicator.querySelector('i');
        
        indicator.className = `status-${type}`;
        indicator.innerHTML = `<i class="fas fa-circle"></i> ${message}`;
    }

    updateAIStatus(message) {
        document.getElementById('aiStatus').textContent = message;
    }

    showConfigModal() {
        // Sync values from current config
        const currentConfig = this.getCurrentConfig();
        document.getElementById('modalMaxTokens').value = currentConfig.maxTokens;
        document.getElementById('modalTemperature').value = currentConfig.temperature;
        document.getElementById('modalTempValue').textContent = currentConfig.temperature;
        document.getElementById('modalAutoRounds').checked = currentConfig.autoRounds;
        document.getElementById('modalModerationPause').value = currentConfig.moderationPause;

        document.getElementById('configModal').style.display = 'flex';
    }

    hideConfigModal() {
        document.getElementById('configModal').style.display = 'none';
    }

    getCurrentConfig() {
        return {
            maxTokens: 300,
            temperature: 0.7,
            autoRounds: true,
            moderationPause: 4
        };
    }

    async applyConfiguration() {
        const config = {
            maxTokens: parseInt(document.getElementById('modalMaxTokens').value),
            temperature: parseFloat(document.getElementById('modalTemperature').value),
            autoRounds: document.getElementById('modalAutoRounds').checked,
            moderationPause: parseInt(document.getElementById('modalModerationPause').value)
        };

        if (!this.conversationId) {
            this.showNotification('No active conversation to configure', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/conversation/${this.conversationId}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Configuration updated successfully', 'success');
                this.hideConfigModal();
            } else {
                this.showNotification('Failed to update configuration', 'error');
            }
        } catch (error) {
            console.error('Failed to update configuration:', error);
            this.showNotification('Failed to update configuration', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notificationArea');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconClass = {
            'info': 'fa-info-circle',
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'auto-round': 'fa-sync-alt'
        }[type] || 'fa-info-circle';

        notification.innerHTML = `
            <i class="fas ${iconClass} notification-icon"></i>
            <span class="notification-text">${message}</span>
        `;

        notificationArea.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    showAutoRoundNotification(data) {
        const chatContainer = document.getElementById('chatContainer');
        const indicator = document.createElement('div');
        indicator.className = 'auto-round-indicator';
        indicator.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>${data.message}</span>
        `;

        chatContainer.appendChild(indicator);
        this.scrollToBottom();

        // Remove after 8 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 8000);

        // Also show as notification
        this.showNotification(data.message, 'auto-round');
    }

    showModerationPauseNotification(data) {
        const chatContainer = document.getElementById('chatContainer');
        const indicator = document.createElement('div');
        indicator.className = 'moderation-pause-indicator';
        indicator.innerHTML = `
            <i class="fas fa-pause-circle"></i>
            <div class="pause-content">
                <div class="pause-title">${data.message}</div>
                <div class="pause-suggestion">${data.suggestion}</div>
                <div class="pause-stats">Consecutive AI messages: ${data.consecutiveMessages}</div>
            </div>
        `;
        chatContainer.appendChild(indicator);
        this.scrollToBottom();
        
        // Remove after 15 seconds (longer than auto-round since it's important)
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 15000);
        
        // Also show as notification
        this.showNotification(data.message, 'warning');
    }

    showRandomSelectionNotification(data) {
        const chatContainer = document.getElementById('chatContainer');
        const indicator = document.createElement('div');
        indicator.className = 'random-selection-indicator';
        indicator.innerHTML = `
            <i class="fas fa-dice"></i>
            <span>${data.message}</span>
        `;

        chatContainer.appendChild(indicator);
        this.scrollToBottom();

        // Remove after 6 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 6000);

        // Also show as notification
        this.showNotification(data.message.replace('🎲 ', ''), 'info');
    }

    async exportConversation() {
        if (!this.conversationId) return;
        
        try {
            const response = await fetch(`/api/conversation/${this.conversationId}`);
            const data = await response.json();
            
            const exportData = {
                conversation: data.history,
                analytics: data.analytics,
                exportedAt: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `philosopher-chat-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.updateAIStatus('Conversation exported successfully');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.updateAIStatus('Export failed');
        }
    }

    showSummaryModal() {
        document.getElementById('summaryModal').style.display = 'flex';
        document.getElementById('summaryContent').innerHTML = `
            <div class="loading-summary">
                <i class="fas fa-spinner fa-spin"></i>
                <div class="progress-text">Preparing comprehensive analysis...</div>
                <div class="progress-note">This may take 1-2 minutes for a detailed white paper style summary</div>
            </div>
        `;
        document.getElementById('downloadSummaryBtn').style.display = 'none';
    }

    updateSummaryProgress(status) {
        const loadingDiv = document.querySelector('.loading-summary');
        if (loadingDiv) {
            const progressText = loadingDiv.querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = status;
            }
        }
    }

    hideSummaryModal() {
        document.getElementById('summaryModal').style.display = 'none';
    }

    displaySummary(summary) {
        const content = document.getElementById('summaryContent');
        content.innerHTML = `<div class="summary-text">${summary}</div>`;
        document.getElementById('downloadSummaryBtn').style.display = 'inline-flex';
        this.currentSummary = summary;
    }

    downloadSummary() {
        if (!this.currentSummary) return;
        
        const conversation = this.memory?.getCurrentConversation() || {};
        const summaryData = {
            topic: conversation.topic || 'Philosophical Discussion',
            summary: this.currentSummary,
            generatedAt: new Date().toISOString(),
            messageCount: this.allMessages.length
        };
        
        const blob = new Blob([this.formatSummaryForDownload(summaryData)], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-summary-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showNotification('Summary downloaded successfully', 'success');
    }

    formatSummaryForDownload(summaryData) {
        // Convert HTML back to clean text format for download
        const cleanText = summaryData.summary
            .replace(/<h1[^>]*>(.*?)<\/h1>/g, '\n\n$1\n' + '='.repeat(50) + '\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/g, '\n\n$1\n' + '-'.repeat(30) + '\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/g, '\n\n$1\n' + '~'.repeat(20) + '\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/g, '\n\n$1:\n')
            .replace(/<p[^>]*>(.*?)<\/p>/g, '\n$1\n')
            .replace(/<li[^>]*>(.*?)<\/li>/g, '• $1\n')
            .replace(/<ul[^>]*>|<\/ul>/g, '')
            .replace(/<ol[^>]*>|<\/ol>/g, '')
            .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/g, '\n"$1"\n')
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .replace(/<em>(.*?)<\/em>/g, '*$1*')
            .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
            .replace(/<br>/g, '\n')
            .replace(/<hr[^>]*>/g, '\n' + '-'.repeat(50) + '\n')
            .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
            .replace(/\n\n\n+/g, '\n\n'); // Clean up excessive newlines

        return `COMPREHENSIVE PHILOSOPHICAL ANALYSIS
========================================

CONVERSATION METADATA:
Topic: ${summaryData.topic}
Generated: ${new Date(summaryData.generatedAt).toLocaleString()}
Total Messages: ${summaryData.messageCount}
Analysis Type: Detailed White Paper Style Summary
Word Count: ~${cleanText.split(' ').length} words

${cleanText}

=====================================
Generated by AI Philosopher Chat
Academic Analysis Engine v2.0
=====================================
`;
    }

    // Chat History Management Methods
    async showHistoryModal() {
        document.getElementById('historyModal').style.display = 'flex';
        await this.loadConversationsList();
        await this.loadHistoryStats();
    }

    hideHistoryModal() {
        document.getElementById('historyModal').style.display = 'none';
    }

    async loadConversationsList() {
        try {
            const response = await fetch('/api/conversations');
            const data = await response.json();
            
            if (data.success) {
                this.displayConversationsList(data.conversations);
            } else {
                this.showNotification('Failed to load conversations', 'error');
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
            this.showNotification('Failed to load conversations', 'error');
        }
    }

    displayConversationsList(conversations) {
        const container = document.getElementById('conversationsList');
        
        if (!conversations || conversations.length === 0) {
            container.innerHTML = `
                <div class="no-conversations">
                    <i class="fas fa-comments"></i>
                    <h3>No conversations yet</h3>
                    <p>Start your first philosophical debate to see it here.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = conversations.map(conv => {
            const lastMessagePreview = conv.lastMessage 
                ? `${conv.lastMessage.speaker}: ${conv.lastMessage.content.substring(0, 100)}...`
                : 'No messages yet';
            
            const statusIcon = {
                'active': 'fa-play-circle',
                'ended': 'fa-stop-circle',
                'resumed': 'fa-redo-alt'
            }[conv.status] || 'fa-question-circle';

            const timeAgo = this.getTimeAgo(conv.createdAt);

            return `
                <div class="conversation-item" data-id="${conv.id}">
                    <div class="conversation-header">
                        <div class="conversation-title">
                            <i class="fas ${statusIcon} status-icon status-${conv.status}"></i>
                            <h4>${conv.topic}</h4>
                        </div>
                        <div class="conversation-actions">
                            <button class="resume-btn" onclick="app.resumeConversation('${conv.id}')" title="Resume conversation">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="delete-btn" onclick="app.deleteConversation('${conv.id}')" title="Delete conversation">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="conversation-meta">
                        <span class="participants">
                            <i class="fas fa-users"></i> ${conv.participants.join(', ')}
                        </span>
                        <span class="message-count">
                            <i class="fas fa-comments"></i> ${conv.messageCount} messages
                        </span>
                        <span class="created-date">
                            <i class="fas fa-clock"></i> ${timeAgo}
                        </span>
                    </div>
                    <div class="conversation-preview">
                        ${lastMessagePreview}
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadHistoryStats() {
        try {
            const response = await fetch('/api/storage/stats');
            const data = await response.json();
            
            if (data.success) {
                this.displayHistoryStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load history stats:', error);
        }
    }

    displayHistoryStats(stats) {
        const container = document.getElementById('historyStats');
        const sizeInMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <i class="fas fa-comments"></i>
                    <span class="stat-value">${stats.totalConversations}</span>
                    <span class="stat-label">Conversations</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-comment"></i>
                    <span class="stat-value">${stats.totalMessages}</span>
                    <span class="stat-label">Messages</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-hdd"></i>
                    <span class="stat-value">${sizeInMB} MB</span>
                    <span class="stat-label">Storage Used</span>
                </div>
            </div>
        `;
    }

    async searchConversations() {
        const query = document.getElementById('historySearch').value.trim();
        
        if (!query) {
            await this.loadConversationsList();
            return;
        }

        try {
            const response = await fetch(`/api/conversations/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayConversationsList(data.results);
            } else {
                this.showNotification('Search failed', 'error');
            }
        } catch (error) {
            console.error('Search failed:', error);
            this.showNotification('Search failed', 'error');
        }
    }

    async resumeConversation(conversationId) {
        try {
            const response = await fetch(`/api/conversation/${conversationId}/resume`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                // Hide history modal
                this.hideHistoryModal();
                
                // Update conversation state
                this.conversationId = data.conversation.id;
                this.allMessages = data.history || [];
                
                // Switch to main interface
                document.getElementById('setupPanel').style.display = 'none';
                document.getElementById('mainInterface').style.display = 'flex';
                document.getElementById('conversationTopic').textContent = data.conversation.topic;
                
                // Display participants and messages
                this.displayParticipants(data.conversation.participants);
                this.displayMessages();
                this.initializeAIControls();
                
                // Join the conversation room
                this.socket.emit('join-conversation', this.conversationId);
                
                this.updateStatus('ready', 'Conversation resumed');
                this.showNotification(`Resumed: ${data.conversation.topic}`, 'success');
                
            } else {
                this.showNotification('Failed to resume conversation', 'error');
            }
        } catch (error) {
            console.error('Failed to resume conversation:', error);
            this.showNotification('Failed to resume conversation', 'error');
        }
    }

    async deleteConversation(conversationId) {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/conversation/${conversationId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Conversation deleted', 'success');
                await this.loadConversationsList();
                await this.loadHistoryStats();
            } else {
                this.showNotification('Failed to delete conversation', 'error');
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            this.showNotification('Failed to delete conversation', 'error');
        }
    }

    startNewConversation() {
        this.hideHistoryModal();
        // Reset to setup panel
        document.getElementById('mainInterface').style.display = 'none';
        document.getElementById('setupPanel').style.display = 'block';
        document.getElementById('topicInput').value = '';
        this.conversationId = null;
        this.allMessages = [];
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 60) {
            return `${diffInMinutes} minutes ago`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return `${hours} hours ago`;
        } else {
            const days = Math.floor(diffInMinutes / 1440);
            return `${days} days ago`;
        }
    }

    // Landing Page Recent Conversations
    async loadRecentConversations() {
        try {
            const response = await fetch('/api/conversations');
            const data = await response.json();
            
            if (data.success) {
                this.displayRecentConversations(data.conversations.slice(0, 3)); // Show only 3 most recent
            } else {
                this.hideRecentConversations();
            }
        } catch (error) {
            console.error('Failed to load recent conversations:', error);
            this.hideRecentConversations();
        }
    }

    displayRecentConversations(conversations) {
        const container = document.getElementById('recentConversationsContainer');
        const section = document.getElementById('recentConversations');
        
        if (!conversations || conversations.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = conversations.map(conv => {
            const timeAgo = this.getTimeAgo(conv.createdAt);
            const statusIcon = {
                'active': 'fa-play-circle',
                'ended': 'fa-stop-circle', 
                'resumed': 'fa-redo-alt'
            }[conv.status] || 'fa-question-circle';

            const lastMessagePreview = conv.lastMessage 
                ? `${conv.lastMessage.speaker}: ${conv.lastMessage.content.substring(0, 80)}...`
                : 'No messages yet';

            return `
                <div class="recent-conversation-card" data-id="${conv.id}">
                    <div class="recent-card-header">
                        <div class="recent-card-title">
                            <i class="fas ${statusIcon} status-icon status-${conv.status}"></i>
                            <h4>${conv.topic}</h4>
                        </div>
                        <button class="resume-conversation-btn" onclick="app.resumeConversationFromLanding('${conv.id}')" title="Resume conversation">
                            <i class="fas fa-play"></i>
                            Resume
                        </button>
                    </div>
                    <div class="recent-card-meta">
                        <span class="participants-count">
                            <i class="fas fa-users"></i> ${conv.participants.length} participants
                        </span>
                        <span class="message-count">
                            <i class="fas fa-comments"></i> ${conv.messageCount} messages
                        </span>
                        <span class="time-ago">
                            <i class="fas fa-clock"></i> ${timeAgo}
                        </span>
                    </div>
                    <div class="recent-card-preview">
                        ${lastMessagePreview}
                    </div>
                </div>
            `;
        }).join('');
    }

    hideRecentConversations() {
        document.getElementById('recentConversations').style.display = 'none';
    }

    // Resume conversation from landing page (wrapper method)
    async resumeConversationFromLanding(conversationId) {
        await this.resumeConversation(conversationId);
    }
}

// Make app available globally for onclick handlers
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new PhilosopherChatApp();
});