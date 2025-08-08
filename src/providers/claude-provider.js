import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base-provider.js';

export class ClaudeProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('Claude', apiKey, config);
    this.client = new Anthropic({ apiKey });
  }

  async sendMessage(message, context = {}) {
    const { topic, participants, conversationHistory } = context;
    
    const systemPrompt = this.getSystemPrompt(topic, participants);
    
    const messages = [];
    
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
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt,
        messages
      });

      const content = response.content[0].text;
      this.addToHistory('assistant', content);
      return content;
    } catch (error) {
      console.error('Claude API error:', error);
      return `Claude encountered an error: ${error.message}`;
    }
  }
}