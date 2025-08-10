import { v4 as uuidv4 } from 'uuid';
import { ConversationAnalytics } from './analytics.js';
import { ConversationStorage } from './storage.js';

export class ConversationMemory {
  constructor() {
    this.conversations = new Map();
    this.currentConversationId = null;
    this.analytics = new ConversationAnalytics();
    this.storage = new ConversationStorage();
  }

  createConversation(topic, participants) {
    const id = uuidv4();
    const conversation = {
      id,
      topic,
      participants,
      history: [],
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    
    this.conversations.set(id, conversation);
    this.currentConversationId = id;
    return id;
  }

  async addMessage(speaker, content, conversationId = null, providers = []) {
    const id = conversationId || this.currentConversationId;
    if (!id || !this.conversations.has(id)) {
      throw new Error('No active conversation found');
    }

    const conversation = this.conversations.get(id);
    const message = {
      id: uuidv4(),
      speaker,
      content,
      timestamp: new Date().toISOString()
    };

    const analysis = this.analytics.analyzeMessage(content, speaker, providers);
    message.analysis = analysis;

    conversation.history.push(message);
    
    // Auto-save conversation after each message
    await this.saveConversation(id);
    
    return message.id;
  }

  getConversationHistory(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    if (!id || !this.conversations.has(id)) {
      return [];
    }
    return this.conversations.get(id).history;
  }

  getCurrentConversation() {
    if (!this.currentConversationId || !this.conversations.has(this.currentConversationId)) {
      return null;
    }
    return this.conversations.get(this.currentConversationId);
  }

  summarizeConversation(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(id);
    
    if (!conversation) return null;

    const summary = {
      topic: conversation.topic,
      participants: conversation.participants,
      messageCount: conversation.history.length,
      duration: this.getConversationDuration(id),
      lastMessage: conversation.history[conversation.history.length - 1]
    };

    return summary;
  }

  getConversationDuration(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(id);
    
    if (!conversation || conversation.history.length === 0) return '0 minutes';

    const start = new Date(conversation.createdAt);
    const end = new Date(conversation.history[conversation.history.length - 1].timestamp);
    const diffMinutes = Math.round((end - start) / 60000);
    
    return `${diffMinutes} minutes`;
  }

  searchConversations(query) {
    const results = [];
    
    for (const [id, conversation] of this.conversations) {
      const topicMatch = conversation.topic.toLowerCase().includes(query.toLowerCase());
      const contentMatch = conversation.history.some(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase())
      );
      
      if (topicMatch || contentMatch) {
        results.push({
          id,
          topic: conversation.topic,
          participants: conversation.participants,
          relevantMessages: conversation.history.filter(msg =>
            msg.content.toLowerCase().includes(query.toLowerCase())
          ).length
        });
      }
    }
    
    return results;
  }

  exportConversation(conversationId = null, format = 'json') {
    const id = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(id);
    
    if (!conversation) return null;

    if (format === 'text') {
      let output = `Topic: ${conversation.topic}\n`;
      output += `Participants: ${conversation.participants.join(', ')}\n`;
      output += `Created: ${conversation.createdAt}\n\n`;
      
      conversation.history.forEach(msg => {
        output += `[${msg.timestamp}] ${msg.speaker}: ${msg.content}\n\n`;
      });
      
      return output;
    }
    
    return JSON.stringify(conversation, null, 2);
  }

  async updateConsensus(providers = []) {
    const history = this.getConversationHistory();
    return await this.analytics.calculateConsensus(history, providers);
  }

  getAnalytics() {
    return this.analytics.exportAnalytics();
  }

  getConsensusGraph() {
    return this.analytics.getConsensusGraph();
  }

  getTopThemes(limit = 5) {
    return this.analytics.getTopThemes(limit);
  }

  getRecentInsights(limit = 10) {
    return this.analytics.getRecentInsights(limit);
  }

  // Persistent storage methods
  async saveConversation(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    if (!id || !this.conversations.has(id)) {
      return false;
    }

    const conversation = this.conversations.get(id);
    return await this.storage.saveConversation(conversation);
  }

  async loadConversation(conversationId) {
    try {
      const conversation = await this.storage.loadConversation(conversationId);
      if (conversation) {
        this.conversations.set(conversationId, conversation);
        this.currentConversationId = conversationId;
        
        // Restore analytics from conversation history
        this.analytics = new ConversationAnalytics();
        conversation.history.forEach(message => {
          if (message.content && message.speaker) {
            // Re-analyze each message to rebuild analytics state
            this.analytics.analyzeMessage(message.content, message.speaker, []);
          }
        });
        
        console.log(`📖 Loaded and restored conversation: ${conversationId}`);
        return conversation;
      }
      return null;
    } catch (error) {
      console.error(`❌ Failed to load conversation ${conversationId}:`, error);
      return null;
    }
  }

  async getAllConversations() {
    return await this.storage.getAllConversations();
  }

  async searchStoredConversations(query) {
    return await this.storage.searchConversations(query);
  }

  async deleteConversation(conversationId) {
    // Remove from memory
    if (this.conversations.has(conversationId)) {
      this.conversations.delete(conversationId);
      if (this.currentConversationId === conversationId) {
        this.currentConversationId = null;
      }
    }
    
    // Remove from storage
    return await this.storage.deleteConversation(conversationId);
  }

  async getStorageStats() {
    return await this.storage.getStorageStats();
  }

  // Resume conversation functionality
  async resumeConversation(conversationId) {
    const conversation = await this.loadConversation(conversationId);
    if (conversation) {
      conversation.status = 'resumed';
      conversation.resumedAt = new Date().toISOString();
      await this.saveConversation(conversationId);
      return conversation;
    }
    return null;
  }

  // End conversation and save final state
  async endConversation(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    if (!id || !this.conversations.has(id)) {
      return false;
    }

    const conversation = this.conversations.get(id);
    conversation.status = 'ended';
    conversation.endedAt = new Date().toISOString();
    
    await this.saveConversation(id);
    console.log(`✅ Ended and saved conversation: ${id}`);
    return true;
  }
}