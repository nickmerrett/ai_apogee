export class ConversationAnalytics {
  constructor() {
    this.consensusHistory = [];
    this.themes = new Map();
    this.insights = [];
    this.sentimentHistory = [];
  }

  analyzeMessage(message, speaker, providers) {
    const analysis = {
      timestamp: new Date().toISOString(),
      speaker,
      length: message.length,
      themes: this.extractThemes(message),
      insights: this.extractInsights(message),
      sentiment: this.analyzeSentiment(message)
    };

    this.updateThemes(analysis.themes);
    this.insights.push(...analysis.insights);
    this.sentimentHistory.push({
      timestamp: analysis.timestamp,
      speaker,
      sentiment: analysis.sentiment
    });

    return analysis;
  }

  extractThemes(text) {
    const themePatterns = [
      { name: 'Consciousness', keywords: ['conscious', 'awareness', 'experience', 'subjective', 'qualia'] },
      { name: 'Free Will', keywords: ['choice', 'freedom', 'determinism', 'agency', 'decision'] },
      { name: 'Reality', keywords: ['reality', 'existence', 'being', 'truth', 'perception'] },
      { name: 'Ethics', keywords: ['moral', 'ethical', 'right', 'wrong', 'virtue', 'duty'] },
      { name: 'Knowledge', keywords: ['knowledge', 'truth', 'belief', 'epistem', 'certainty'] },
      { name: 'Mind', keywords: ['mind', 'thought', 'cognition', 'mental', 'brain'] },
      { name: 'Identity', keywords: ['self', 'identity', 'person', 'individual', 'who'] },
      { name: 'Technology', keywords: ['ai', 'technology', 'artificial', 'machine', 'digital'] },
      { name: 'Society', keywords: ['society', 'social', 'community', 'culture', 'human'] },
      { name: 'Meaning', keywords: ['meaning', 'purpose', 'significance', 'value', 'worth'] }
    ];

    const foundThemes = [];
    const lowerText = text.toLowerCase();

    themePatterns.forEach(theme => {
      const matches = theme.keywords.filter(keyword => 
        lowerText.includes(keyword.toLowerCase())
      ).length;
      
      if (matches > 0) {
        foundThemes.push({
          name: theme.name,
          strength: matches / theme.keywords.length,
          keywords: theme.keywords.filter(k => lowerText.includes(k.toLowerCase()))
        });
      }
    });

    return foundThemes.sort((a, b) => b.strength - a.strength);
  }

  extractInsights(text) {
    const insightPatterns = [
      { pattern: /therefore|thus|hence|consequently/i, type: 'conclusion' },
      { pattern: /however|but|although|nevertheless/i, type: 'contrast' },
      { pattern: /perhaps|maybe|possibly|might/i, type: 'speculation' },
      { pattern: /evidence|proof|demonstrates|shows/i, type: 'evidence' },
      { pattern: /question|wonder|curious|unclear/i, type: 'inquiry' },
      { pattern: /agree|consensus|common ground|shared/i, type: 'agreement' },
      { pattern: /disagree|differ|oppose|contrary/i, type: 'disagreement' },
      { pattern: /build|expand|develop|extend/i, type: 'development' }
    ];

    const insights = [];
    insightPatterns.forEach(({ pattern, type }) => {
      if (pattern.test(text)) {
        insights.push({
          type,
          text: text.substring(0, 200) + '...',
          timestamp: new Date().toISOString()
        });
      }
    });

    return insights;
  }

  analyzeSentiment(text) {
    const positiveWords = ['agree', 'good', 'excellent', 'brilliant', 'insightful', 'valuable', 'important', 'helpful'];
    const negativeWords = ['disagree', 'wrong', 'flawed', 'problematic', 'difficult', 'challenging'];
    const neutralWords = ['think', 'consider', 'perhaps', 'might', 'could', 'possible'];

    const lowerText = text.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 1;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 1;
    });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  updateThemes(newThemes) {
    newThemes.forEach(theme => {
      const existing = this.themes.get(theme.name) || { count: 0, totalStrength: 0, keywords: new Set() };
      existing.count += 1;
      existing.totalStrength += theme.strength;
      theme.keywords.forEach(keyword => existing.keywords.add(keyword));
      this.themes.set(theme.name, existing);
    });
  }

  async calculateConsensus(conversationHistory, providers) {
    if (conversationHistory.length < 4) return { level: 0, summary: 'Not enough messages for consensus analysis' };

    const recentMessages = conversationHistory.slice(-6);
    const agreementIndicators = [
      'agree', 'yes', 'exactly', 'precisely', 'indeed', 'absolutely',
      'build on', 'expand', 'similar', 'likewise', 'same', 'shared'
    ];
    
    const disagreementIndicators = [
      'disagree', 'no', 'however', 'but', 'different', 'contrary',
      'oppose', 'challenge', 'question', 'doubt'
    ];

    let agreementScore = 0;
    let disagreementScore = 0;
    let totalMessages = 0;

    recentMessages.forEach(msg => {
      if (msg.speaker === 'Human') return;
      totalMessages++;
      
      const lowerText = msg.content.toLowerCase();
      
      agreementIndicators.forEach(indicator => {
        if (lowerText.includes(indicator)) agreementScore++;
      });
      
      disagreementIndicators.forEach(indicator => {
        if (lowerText.includes(indicator)) disagreementScore++;
      });
    });

    const consensusLevel = totalMessages > 0 
      ? Math.max(0, Math.min(100, ((agreementScore - disagreementScore) / totalMessages) * 50 + 50))
      : 0;

    let summary;
    if (consensusLevel >= 80) summary = 'Strong consensus emerging';
    else if (consensusLevel >= 60) summary = 'Growing agreement';
    else if (consensusLevel >= 40) summary = 'Mixed perspectives';
    else if (consensusLevel >= 20) summary = 'Some disagreement';
    else summary = 'Significant differences';

    const consensusData = {
      level: Math.round(consensusLevel),
      summary,
      timestamp: new Date().toISOString(),
      agreementScore,
      disagreementScore,
      totalMessages
    };

    this.consensusHistory.push(consensusData);
    return consensusData;
  }

  getTopThemes(limit = 5) {
    return Array.from(this.themes.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        averageStrength: data.totalStrength / data.count,
        keywords: Array.from(data.keywords)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getRecentInsights(limit = 10) {
    return this.insights
      .slice(-limit)
      .reverse();
  }

  getConsensusGraph() {
    return this.consensusHistory.slice(-20);
  }

  getSentimentDistribution() {
    const distribution = { positive: 0, neutral: 0, negative: 0 };
    this.sentimentHistory.forEach(entry => {
      distribution[entry.sentiment]++;
    });
    return distribution;
  }

  exportAnalytics() {
    return {
      themes: this.getTopThemes(10),
      insights: this.getRecentInsights(20),
      consensusHistory: this.getConsensusGraph(),
      sentimentDistribution: this.getSentimentDistribution(),
      summary: {
        totalThemes: this.themes.size,
        totalInsights: this.insights.length,
        consensusPoints: this.consensusHistory.length
      }
    };
  }
}