import OpenAI from 'openai';
import { BaseAIProvider } from './base-provider.js';

export class ChatGPTProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('ChatGPT', apiKey, config);
    this.client = new OpenAI({ apiKey });
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
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0].message.content;
      this.addToHistory('assistant', content);
      return content;
    } catch (error) {
      console.error('ChatGPT API error:', error);
      return `ChatGPT encountered an error: ${error.message}`;
    }
  }
}