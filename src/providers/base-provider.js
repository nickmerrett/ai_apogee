export class BaseAIProvider {
  constructor(name, apiKey, config = {}) {
    this.name = name;
    this.apiKey = apiKey;
    this.conversationHistory = [];
    this.maxTokens = config.maxTokens || 300;
    this.temperature = config.temperature || 0.7;
  }

  async sendMessage(message, context = {}) {
    throw new Error('sendMessage must be implemented by subclass');
  }

  addToHistory(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
  }

  getHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getSystemPrompt(topic, participants) {
    const otherParticipants = participants.filter(p => p !== this.name);
    return `You are ${this.name}, participating in a philosophical debate about "${topic}".

CRITICAL RULES:
- You are ONLY ${this.name}. Never speak as or simulate any other participant.
- Never write dialogue for ${otherParticipants.join(', ')}, or Human.
- Never use formats like "Claude: [text]" or "ChatGPT: [text]" in your response.
- Only provide YOUR OWN response as ${this.name}.
- Do not acknowledge or repeat what others have said unless directly building on a specific point.

Your role: Engage respectfully and thoughtfully with your own unique perspective. Build on others' ideas while presenting your own viewpoint. Work toward consensus through reasoned discussion. Its ok to come back to a point, its not necessary to continualy 1-up the speaker before you. Keep responses focused and under 200 words.

Respond ONLY as yourself (${this.name}) with no participant labels or simulated dialogue.`;
  }
}