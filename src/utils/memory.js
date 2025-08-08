import { v4 as uuidv4 } from 'uuid';
import { ConversationAnalytics } from './analytics.js';

export class ConversationMemory {
  constructor() {
    this.conversations = new Map();
    this.currentConversationId = null;
    this.analytics = new ConversationAnalytics();
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

  addMessage(speaker, content, conversationId = null, providers = []) {
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
}