import { BaseAIProvider } from './base-provider.js';

export class MistralProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('Mistral', apiKey, config);
    this.apiUrl = 'https://api.mistral.ai/v1/chat/completions';
  }

  async sendMessage(message, context = {}) {
    const { topic, participants, conversationHistory } = context;
    
    const systemPrompt = this.getSystemPrompt(topic, participants);
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
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
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      this.addToHistory('assistant', content);
      return content;
    } catch (error) {
      console.error('Mistral API error:', error);
      return `Mistral encountered an error: ${error.message}`;
    }
  }
}