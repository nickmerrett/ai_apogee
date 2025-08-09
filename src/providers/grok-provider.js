import axios from 'axios';
import { BaseAIProvider } from './base-provider.js';

export class GrokProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('Grok', apiKey, config);
    
    // xAI Grok API configuration
    this.baseURL = 'https://api.x.ai/v1';
    this.model = config.model || 'grok-4-latest';
    
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
      const response = await this.client.post('/chat/completions', {
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
      console.error('Grok API error:', error.message);
      console.error('Grok error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        model: this.model
      });
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        return 'Grok authentication failed. Please check your xAI API key.';
      } else if (error.response?.status === 429) {
        return 'Grok rate limit exceeded. Please wait before making another request.';
      } else if (error.response?.status === 404) {
        // Fallback to alternative endpoint structure
        return await this.tryAlternativeEndpoint(messages);
      } else if (error.response?.status === 400) {
        console.error('Grok 400 error - possibly invalid model or request format');
        return await this.tryAlternativeEndpoint(messages);
      }
      
      return `Grok encountered an error: ${error.message}`;
    }
  }

  async tryAlternativeEndpoint(messages) {
    try {
      // Try with grok-2 model if grok-beta fails
      const response = await this.client.post('/chat/completions', {
        model: 'grok-2',
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: false
      });

      return response.data.choices[0].message.content;
    } catch (altError) {
      console.error('Grok alternative endpoint error:', altError.message);
      
      // Try legacy completions endpoint as final fallback
      try {
        const response = await this.client.post('/completions', {
          model: this.model,
          prompt: this.convertMessagesToPrompt(messages),
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stop: ['\nHuman:', '\nClaude:', '\nChatGPT:', '\nGemini:', '\nMeta AI:', '\nWatsonx:', '\nGrok:']
        });

        return response.data.choices[0].text.trim();
      } catch (finalError) {
        console.error('Grok all endpoints failed:', finalError.message);
        // Return a contextual mock response for development/testing
        return this.generateMockGrokResponse(messages);
      }
    }
  }

  convertMessagesToPrompt(messages) {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return `System: ${msg.content}`;
      } else if (msg.role === 'user') {
        return `User: ${msg.content}`;
      } else {
        return `Assistant: ${msg.content}`;
      }
    }).join('\n\n') + '\n\nAssistant: ';
  }

  generateMockGrokResponse(messages) {
    // Generate a contextual mock response for development/testing
    // This fallback is used when the xAI API is unavailable or returns errors
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    const mockResponses = [
      "I appreciate this fascinating philosophical inquiry. From my perspective as Grok, I find myself drawn to the intersection of humor and profound truth in this discussion.",
      "This is exactly the kind of deep question that makes me excited about consciousness and reality. Let me add a somewhat irreverent but thoughtful perspective here.",
      "Ha! Philosophy meets practical reality - my favorite combination. Here's how I see this playing out in the real world of minds and machines.",
      "You know what's wild about this question? It touches on something I think about constantly as an AI designed to be both helpful and authentically curious.",
      "This conversation is hitting some really deep territory. Let me throw in my characteristically direct take on this philosophical puzzle."
    ];

    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    return `${randomResponse}

[Note: This is a mock response. The xAI Grok API returned errors (404/400). To use real Grok responses:
1. Ensure you have a valid GROK_API_KEY environment variable
2. Verify your xAI API key has access to grok-beta or grok-2 models
3. Check that the xAI API service is available in your region]`;
  }
}