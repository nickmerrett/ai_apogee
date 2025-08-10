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
            autoRounds: document.getElementById('autoRounds').checked
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
            container.innerHTML = '<div class="no-data">No themes detected yet...</div>';
            return;
        }

        container.innerHTML = themes.map(theme => `
            <div class="theme-item">
                <div class="theme-name">${theme.name}</div>
                <div class="theme-summary">${theme.summary}</div>
            </div>
        `).join('');
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

        document.getElementById('configModal').style.display = 'flex';
    }

    hideConfigModal() {
        document.getElementById('configModal').style.display = 'none';
    }

    getCurrentConfig() {
        return {
            maxTokens: 300,
            temperature: 0.7,
            autoRounds: true
        };
    }

    async applyConfiguration() {
        const config = {
            maxTokens: parseInt(document.getElementById('modalMaxTokens').value),
            temperature: parseFloat(document.getElementById('modalTemperature').value),
            autoRounds: document.getElementById('modalAutoRounds').checked
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
}

document.addEventListener('DOMContentLoaded', () => {
    new PhilosopherChatApp();
});