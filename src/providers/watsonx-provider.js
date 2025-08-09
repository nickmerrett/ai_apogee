import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { BaseAIProvider } from './base-provider.js';

export class WatsonxProvider extends BaseAIProvider {
  constructor(apiKey, config = {}) {
    super('Watsonx', apiKey, config);
    
    this.projectId = config.projectId || process.env.WATSONX_PROJECT_ID;
    this.serviceUrl = config.serviceUrl || 'https://us-south.ml.cloud.ibm.com';
    this.modelId = config.modelId || 'meta-llama/llama-2-70b-chat';

    // Initialize Watson ML service
    try {
      this.watsonxService = new WatsonXAI({
        version: '2023-05-29',
        authenticator: {
          'apikey': apiKey
        },
        serviceUrl: this.serviceUrl
      });
    } catch (error) {
      console.error('Error initializing Watsonx:', error);
      this.watsonxService = null;
    }
  }

  async sendMessage(message, context = {}) {
    if (!this.watsonxService) {
      return 'Watsonx service not properly initialized. Please check your API credentials.';
    }

    if (!this.projectId) {
      return 'Watsonx project ID not configured. Please set WATSONX_PROJECT_ID environment variable.';
    }

    const { topic, participants, conversationHistory } = context;
    const systemPrompt = this.getSystemPrompt(topic, participants);
    
    // Build conversation context for Watsonx
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
      const textGenRequestParametersModel = {
        max_new_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: 1,
        top_k: 50,
        repetition_penalty: 1.1,
        stop_sequences: ['\nHuman:', '\nClaude:', '\nChatGPT:', '\nGemini:', '\nMeta AI:', '\nWatsonx:', '\nGrok:']
      };

      const params = {
        input: conversationContext,
        modelId: this.modelId,
        projectId: this.projectId,
        parameters: textGenRequestParametersModel
      };

      const response = await this.watsonxService.generateText(params);
      
      let content = '';
      if (response.result && response.result.results && response.result.results.length > 0) {
        content = response.result.results[0].generated_text.trim();
      } else {
        content = 'No response generated from Watsonx.';
      }

      this.addToHistory('assistant', content);
      return content;

    } catch (error) {
      console.error('Watsonx API error:', error);
      
      // Try alternative approach with different parameters
      if (error.status === 400) {
        return await this.retryWithSimplifiedInput(conversationContext);
      }
      
      return `Watsonx encountered an error: ${error.message}`;
    }
  }

  async retryWithSimplifiedInput(originalInput) {
    try {
      // Simplified retry with shorter input and basic parameters
      const simplifiedInput = originalInput.slice(-1000); // Truncate to last 1000 chars
      
      const params = {
        input: simplifiedInput,
        modelId: 'ibm/granite-13b-chat-v2', // Try alternative model
        projectId: this.projectId,
        parameters: {
          max_new_tokens: Math.min(this.maxTokens, 200),
          temperature: 0.7,
          top_p: 1
        }
      };

      const response = await this.watsonxService.generateText(params);
      
      if (response.result && response.result.results && response.result.results.length > 0) {
        return response.result.results[0].generated_text.trim();
      } else {
        return 'Watsonx generated an empty response.';
      }
    } catch (retryError) {
      console.error('Watsonx retry error:', retryError);
      return 'Watsonx is currently experiencing issues. Please try again later.';
    }
  }
}