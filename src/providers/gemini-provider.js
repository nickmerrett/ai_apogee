import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base-provider.js';

export class GeminiProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('Gemini', apiKey, config);
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async sendMessage(message, context = {}) {
    const { topic, participants, conversationHistory } = context;
    
    const systemPrompt = this.getSystemPrompt(topic, participants);
    
    let conversationContext = systemPrompt + '\n\nConversation so far:\n';
    conversationHistory.forEach(entry => {
      if (entry.speaker === 'Human') {
        conversationContext += `Human moderator: ${entry.content}\n`;
      } else {
        conversationContext += `${entry.speaker} responded: ${entry.content}\n`;
      }
    });
    conversationContext += `\nContinue the discussion: ${message}\n\nRespond ONLY as ${this.name} (no labels or participant names in your response):`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: conversationContext }] }],
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature
        }
      });

      const content = result.response.text();
      this.addToHistory('assistant', content);
      return content;
    } catch (error) {
      console.error('Gemini API error:', error);
      return `Gemini encountered an error: ${error.message}`;
    }
  }
}