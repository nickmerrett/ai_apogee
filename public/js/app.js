class PhilosopherChatApp {
    constructor() {
        this.socket = null;
        this.conversationId = null;
        this.currentPage = 1;
        this.messagesPerPage = 20;
        this.allMessages = [];
        this.consensusChart = null;
        this.historyChart = null;
        
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
        document.getElementById('consensusBtn').addEventListener('click', () => this.checkConsensus());
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
            this.updateConsensus(data.consensus);
            this.updateThemes(data.themes);
            this.updateInsights(data.insights);
        });

        this.socket.on('consensus-update', (consensus) => {
            this.updateConsensus(consensus);
        });

        this.socket.on('auto-round-notification', (data) => {
            this.showAutoRoundNotification(data);
            this.updateAIStatus(data.message);
        });

        this.socket.on('auto-round-complete', (data) => {
            this.showNotification(data.message, 'success');
            this.updateAIStatus(data.message);
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
            this.initializeCharts();
            
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

    checkConsensus() {
        this.socket.emit('request-consensus-check', this.conversationId);
        this.updateAIStatus('Checking for consensus...');
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

    initializeCharts() {
        this.initConsensusChart();
        this.initHistoryChart();
    }

    initConsensusChart() {
        const ctx = document.getElementById('consensusChart').getContext('2d');
        this.consensusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#5a67d8', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    initHistoryChart() {
        const ctx = document.getElementById('consensusHistory').getContext('2d');
        this.historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Consensus Level',
                    data: [],
                    borderColor: '#5a67d8',
                    backgroundColor: 'rgba(90, 103, 216, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    updateConsensus(consensus) {
        if (!consensus) return;

        document.getElementById('consensusLevel').textContent = consensus.level + '%';
        document.getElementById('consensusStatus').textContent = consensus.summary;

        if (this.consensusChart) {
            this.consensusChart.data.datasets[0].data = [consensus.level, 100 - consensus.level];
            this.consensusChart.update();
        }

        if (this.historyChart) {
            const labels = this.historyChart.data.labels;
            const data = this.historyChart.data.datasets[0].data;
            
            labels.push(new Date().toLocaleTimeString());
            data.push(consensus.level);
            
            if (labels.length > 10) {
                labels.shift();
                data.shift();
            }
            
            this.historyChart.update();
        }
    }

    updateThemes(themes) {
        const container = document.getElementById('themesContainer');
        
        if (!themes || themes.length === 0) {
            container.innerHTML = '<div class="no-data">No themes detected yet...</div>';
            return;
        }

        container.innerHTML = themes.map(theme => `
            <div class="theme-item">
                <span class="theme-name">${theme.name}</span>
                <span class="theme-count">${theme.count}</span>
            </div>
        `).join('');
    }

    updateInsights(insights) {
        const container = document.getElementById('insightsContainer');
        
        if (!insights || insights.length === 0) {
            container.innerHTML = '<div class="no-data">No insights extracted yet...</div>';
            return;
        }

        container.innerHTML = insights.slice(0, 5).map(insight => `
            <div class="insight-item">
                <span class="insight-type ${insight.type}">${insight.type}</span>
                <div class="insight-text">${insight.text}</div>
            </div>
        `).join('');
    }

    updateAnalytics(analytics) {
        if (!analytics) return;
        
        this.updateThemes(analytics.themes);
        this.updateInsights(analytics.insights);
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
}

document.addEventListener('DOMContentLoaded', () => {
    new PhilosopherChatApp();
});