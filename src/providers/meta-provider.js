import axios from 'axios';
import { BaseAIProvider } from './base-provider.js';

export class MetaProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('Meta AI', apiKey, config);
    
    // Meta AI can be accessed through various endpoints
    // This implementation assumes a Llama API endpoint
    this.baseURL = config.baseURL || 'https://api.llama-api.com/chat/completions';
    this.model = config.model || 'llama-2-70b-chat';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async sendMessage(message, context = {}) {
    const { topic, participants, conversationHistory } = context;
    
    const systemPrompt = this.getSystemPrompt(topic, participants);
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    conversationHistory.forEach(entry => {
      if (entry.speaker === 'Human') {
        messages.push({
          role: 'user',
          content: `Human moderator: ${entry.content}`
        });
      } else if (entry.speaker !== this.name) {
        messages.push({
          role: 'user',
          content: `${entry.speaker} responded: ${entry.content}`
        });
      } else {
        messages.push({
          role: 'assistant',
          content: entry.content
        });
      }
    });

    messages.push({
      role: 'user',
      content: `Continue the discussion: ${message}`
    });

    try {
      const response = await this.client.post('', {
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: false
      });

      const content = response.data.choices[0].message.content;
      this.addToHistory('assistant', content);
      return content;
    } catch (error) {
      console.error('Meta AI API error:', error.message);
      
      // Fallback to OpenAI-compatible format if direct Llama API fails
      if (error.response?.status === 404 || error.response?.status === 401) {
        return await this.fallbackToOpenAIFormat(messages);
      }
      
      return `Meta AI encountered an error: ${error.message}`;
    }
  }

  async fallbackToOpenAIFormat(messages) {
    try {
      // Try OpenAI-compatible endpoint for Llama models (like Together AI, Replicate, etc.)
      const fallbackResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo', // Fallback model
        messages: messages.slice(-10), // Limit context for fallback
        max_tokens: this.maxTokens,
        temperature: this.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return fallbackResponse.data.choices[0].message.content;
    } catch (fallbackError) {
      console.error('Meta AI fallback error:', fallbackError.message);
      return 'Meta AI is currently unavailable. Please check your API configuration.';
    }
  }
}