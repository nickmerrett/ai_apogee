export class ConversationAnalytics {
  constructor() {
    this.consensusHistory = [];
    this.themes = new Map();
    this.insights = [];
    this.sentimentHistory = [];
    this.wordFrequency = new Map();
    this.messageContext = [];
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

    this.updateUniqueIdeas(analysis.themes, message);
    this.updateWordFrequency(message);
    this.messageContext.push({ message, speaker, timestamp: analysis.timestamp });
    this.insights.push(...analysis.insights);
    this.sentimentHistory.push({
      timestamp: analysis.timestamp,
      speaker,
      sentiment: analysis.sentiment
    });

    return analysis;
  }

  extractThemes(text) {
    // Extract unique ideas and concepts from the text
    const uniqueIdeas = [];
    
    // Look for philosophical concepts, novel ideas, and key arguments
    const ideaPatterns = [
      // Conceptual markers - captures concepts introduced
      { 
        regex: /(?:the (?:idea|concept|notion|principle) (?:that|of))\s+([^.,;!?]{10,80})/gi,
        type: 'concept'
      },
      // Arguments and propositions
      { 
        regex: /(?:I (?:propose|argue|suggest|contend|believe)|consider that|what if|suppose that)\s+([^.,;!?]{15,100})/gi,
        type: 'argument'
      },
      // Definitions and explanations
      { 
        regex: /(?:\b\w+\b)\s+(?:means|refers to|can be understood as|is defined as)\s+([^.,;!?]{10,80})/gi,
        type: 'definition'
      },
      // Hypothetical scenarios and thought experiments
      { 
        regex: /(?:imagine|suppose|consider|if we|let's say)\s+([^.,;!?]{20,120})/gi,
        type: 'thought_experiment'
      },
      // Key insights and realizations
      { 
        regex: /(?:insight|realization|understanding|revelation|discovery)(?:\s+is)?\s+(?:that\s+)?([^.,;!?]{15,100})/gi,
        type: 'insight'
      },
      // Philosophical frameworks and models
      { 
        regex: /(?:framework|model|theory|approach|methodology)(?:\s+(?:of|for|to))?\s+([^.,;!?]{10,80})/gi,
        type: 'framework'
      },
      // Paradoxes and contradictions
      { 
        regex: /(?:paradox|contradiction|dilemma|tension)(?:\s+(?:of|in|between))?\s+([^.,;!?]{10,80})/gi,
        type: 'paradox'
      },
      // Novel connections and relationships
      { 
        regex: /(?:connection|relationship|link|parallel) between\s+([^.,;!?]{15,100})/gi,
        type: 'connection'
      },
      // Questions that reveal new dimensions
      { 
        regex: /(?:what if|why (?:is|does)|how (?:can|might|does))\s+([^.,;!?]{15,100})/gi,
        type: 'question'
      }
    ];

    // Extract ideas using patterns
    ideaPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const idea = match[1].trim();
        if (idea.length > 10) { // Filter out very short matches
          uniqueIdeas.push({
            text: this.cleanIdeaText(idea),
            type: pattern.type,
            context: match[0],
            strength: this.calculateIdeaStrength(idea, text)
          });
        }
      }
    });

    // Also extract key noun phrases that might represent concepts
    const nounPhrases = this.extractKeyNounPhrases(text);
    nounPhrases.forEach(phrase => {
      uniqueIdeas.push({
        text: phrase,
        type: 'key_concept',
        context: `Key concept: ${phrase}`,
        strength: 0.7
      });
    });

    // Remove duplicates and rank by relevance
    const deduplicated = this.deduplicateIdeas(uniqueIdeas);
    
    return deduplicated
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10); // Limit to top 10 most relevant ideas
  }

  cleanIdeaText(text) {
    return text
      .replace(/^(that|the|a|an)\s+/i, '') // Remove leading articles
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  calculateIdeaStrength(idea, fullText) {
    const ideaWords = idea.toLowerCase().split(/\s+/);
    const textWords = fullText.toLowerCase().split(/\s+/);
    
    // Base strength on idea length and specificity
    let strength = Math.min(ideaWords.length / 10, 1.0);
    
    // Boost for philosophical keywords
    const philosophicalWords = ['existence', 'consciousness', 'reality', 'truth', 'knowledge', 'being', 'mind', 'self', 'freedom', 'choice', 'moral', 'ethical', 'meaning', 'purpose'];
    const philosophicalCount = ideaWords.filter(word => 
      philosophicalWords.some(pw => word.includes(pw))
    ).length;
    strength += philosophicalCount * 0.2;
    
    // Boost for uniqueness (less common words)
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
    const uniqueWords = ideaWords.filter(word => 
      !commonWords.includes(word) && word.length > 3
    ).length;
    strength += uniqueWords * 0.1;
    
    return Math.min(strength, 1.0);
  }

  extractKeyNounPhrases(text) {
    // Simple noun phrase extraction - look for capitalized phrases and technical terms
    const nounPhrasePatterns = [
      // Capitalized phrases (potential proper nouns or important concepts)
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
      // Technical or domain-specific terms (words with specific suffixes)
      /\b\w*(?:ism|ity|tion|ness|ment|ology)\b/g,
      // Compound philosophical terms
      /\b(?:meta|pseudo|proto|quasi|semi)-\w+/g
    ];

    const phrases = new Set();
    
    nounPhrasePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        if (match.length > 4 && match.length < 50) {
          phrases.add(match);
        }
      });
    });

    return Array.from(phrases).slice(0, 5); // Limit to 5 key phrases
  }

  deduplicateIdeas(ideas) {
    const seen = new Set();
    const deduplicated = [];
    
    ideas.forEach(idea => {
      // Create a normalized version for comparison
      const normalized = idea.text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Check for similarity with existing ideas
      let isDuplicate = false;
      for (const seenText of seen) {
        if (this.calculateSimilarity(normalized, seenText) > 0.8) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seen.add(normalized);
        deduplicated.push(idea);
      }
    });
    
    return deduplicated;
  }

  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
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

  updateUniqueIdeas(ideas, messageContext = '') {
    ideas.forEach(idea => {
      const ideaKey = `${idea.type}:${idea.text.toLowerCase().substring(0, 50)}`;
      const existing = this.themes.get(ideaKey) || { 
        count: 0, 
        totalStrength: 0, 
        text: idea.text,
        type: idea.type,
        contexts: [],
        relatedSpeakers: new Set(),
        summary: idea.text,
        firstIntroduced: new Date().toISOString()
      };
      
      existing.count += 1;
      existing.totalStrength += idea.strength;
      
      // Track context and speakers
      if (messageContext && messageContext.length > 0) {
        const contextSnippet = messageContext.substring(0, 200);
        existing.contexts.push({
          snippet: contextSnippet,
          timestamp: new Date().toISOString()
        });
        
        // Update summary with new context if this is a recurring idea
        if (existing.count > 1) {
          existing.summary = this.generateIdeaSummary(idea, existing.contexts);
        }
      }
      
      this.themes.set(ideaKey, existing);
    });
  }

  generateIdeaSummary(idea, contexts) {
    if (contexts.length <= 1) {
      return idea.text;
    }
    
    const typeDescriptions = {
      'concept': 'This concept has been explored',
      'argument': 'This argument has been developed',
      'definition': 'This definition has been discussed',
      'thought_experiment': 'This thought experiment has been considered',
      'insight': 'This insight has emerged',
      'framework': 'This framework has been applied',
      'paradox': 'This paradox has been examined',
      'connection': 'This connection has been drawn',
      'question': 'This question has been raised',
      'key_concept': 'This key concept has appeared'
    };
    
    const description = typeDescriptions[idea.type] || 'This idea has been mentioned';
    return `${description} ${contexts.length} times in the discussion: "${idea.text}"`;
  }

  updateThemes(newThemes, messageContext = '') {
    newThemes.forEach(theme => {
      const existing = this.themes.get(theme.name) || { 
        count: 0, 
        totalStrength: 0, 
        keywords: new Set(),
        contexts: [],
        keyPoints: new Set(),
        summary: ''
      };
      existing.count += 1;
      existing.totalStrength += theme.strength;
      theme.keywords.forEach(keyword => existing.keywords.add(keyword));
      
      // Store message context and extract key points for summary generation
      if (messageContext && messageContext.length > 0) {
        const contextSnippet = this.extractRelevantContext(messageContext, theme.keywords);
        if (contextSnippet) {
          existing.contexts.push(contextSnippet);
          
          // Extract key philosophical points from this context
          const keyPoint = this.extractKeyPoint(contextSnippet, theme.name);
          if (keyPoint) {
            existing.keyPoints.add(keyPoint);
          }
        }
      }
      
      // Regenerate summary each time we get new context
      if (existing.contexts.length >= 1) {
        existing.summary = this.generateThematicSummary(theme.name, existing.keyPoints, existing.contexts);
      }
      
      this.themes.set(theme.name, existing);
    });
  }

  extractRelevantContext(message, keywords) {
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 20);
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()))) {
        return sentence.trim().substring(0, 150) + (sentence.length > 150 ? '...' : '');
      }
    }
    return null;
  }

  extractKeyPoint(contextSnippet, themeName) {
    // Extract meaningful philosophical points from context based on theme
    const lowerContext = contextSnippet.toLowerCase();
    
    const themePatterns = {
      'Consciousness': {
        patterns: [
          /what.*consciousness.*(?:is|means|involves)/,
          /subjective.*experience.*(?:of|involves|includes)/,
          /awareness.*(?:emerges|develops|exists)/,
          /qualia.*(?:are|represent|constitute)/,
          /conscious.*(?:beings|entities|minds)/
        ],
        concepts: ['subjective experience', 'awareness levels', 'mental states', 'phenomenal consciousness', 'self-awareness']
      },
      'Free Will': {
        patterns: [
          /(?:free will|freedom).*(?:exists|illusion|determined)/,
          /choices.*(?:predetermined|genuine|constrained)/,
          /determinism.*(?:conflicts|compatible|undermines)/,
          /agency.*(?:human|moral|causal)/,
          /decision.*(?:making|process|autonomy)/
        ],
        concepts: ['moral responsibility', 'causal determinism', 'choice autonomy', 'decision-making', 'behavioral freedom']
      },
      'Reality': {
        patterns: [
          /reality.*(?:constructed|objective|subjective)/,
          /existence.*(?:nature|fundamental|depends)/,
          /perception.*(?:shapes|creates|distorts)/,
          /truth.*(?:absolute|relative|correspondence)/,
          /being.*(?:essence|fundamental|nature)/
        ],
        concepts: ['objective vs subjective reality', 'nature of existence', 'perceptual reality', 'truth correspondence', 'ontological being']
      },
      'Ethics': {
        patterns: [
          /(?:right|wrong).*(?:determined|absolute|relative)/,
          /moral.*(?:principles|obligations|framework)/,
          /virtue.*(?:ethics|character|cultivation)/,
          /duty.*(?:categorical|moral|obligation)/,
          /consequences.*(?:determine|justify|evaluate)/
        ],
        concepts: ['moral principles', 'ethical frameworks', 'virtue development', 'duty-based ethics', 'consequentialist reasoning']
      },
      'Knowledge': {
        patterns: [
          /knowledge.*(?:acquired|justified|certain)/,
          /truth.*(?:discovered|constructed|verified)/,
          /belief.*(?:justified|warranted|reasonable)/,
          /certainty.*(?:possible|impossible|degrees)/,
          /epistem.*(?:foundation|method|approach)/
        ],
        concepts: ['justified belief', 'truth verification', 'knowledge acquisition', 'epistemic certainty', 'reasoning methods']
      },
      'Mind': {
        patterns: [
          /mind.*(?:body|brain|separate|identical)/,
          /mental.*(?:states|processes|phenomena)/,
          /cognition.*(?:involves|requires|produces)/,
          /thought.*(?:processes|patterns|emergence)/,
          /brain.*(?:produces|generates|correlates)/
        ],
        concepts: ['mind-body relationship', 'mental processes', 'cognitive mechanisms', 'thought patterns', 'neural correlates']
      },
      'Identity': {
        patterns: [
          /personal.*identity.*(?:persists|changes|constituted)/,
          /self.*(?:continuous|constructed|essential)/,
          /individual.*(?:unique|defined|characterized)/,
          /person.*(?:remains|becomes|essentially)/,
          /who.*(?:are|am|defines)/
        ],
        concepts: ['personal continuity', 'self-construction', 'individual uniqueness', 'identity persistence', 'essential self']
      },
      'Technology': {
        patterns: [
          /(?:ai|artificial.*intelligence).*(?:consciousness|rights|ethics)/,
          /technology.*(?:enhances|replaces|augments)/,
          /machine.*(?:intelligence|consciousness|learning)/,
          /digital.*(?:existence|identity|reality)/,
          /automation.*(?:impact|benefits|concerns)/
        ],
        concepts: ['AI consciousness', 'technological enhancement', 'machine intelligence', 'digital existence', 'automation impact']
      },
      'Society': {
        patterns: [
          /social.*(?:structures|norms|construction)/,
          /community.*(?:values|obligations|identity)/,
          /culture.*(?:shapes|influences|determines)/,
          /human.*(?:nature|cooperation|conflict)/,
          /collective.*(?:action|responsibility|decision)/
        ],
        concepts: ['social structures', 'community values', 'cultural influence', 'human cooperation', 'collective responsibility']
      },
      'Meaning': {
        patterns: [
          /meaning.*(?:life|existence|created|discovered)/,
          /purpose.*(?:human|individual|universal)/,
          /significance.*(?:personal|cosmic|inherent)/,
          /value.*(?:intrinsic|assigned|created)/,
          /worth.*(?:human|moral|inherent)/
        ],
        concepts: ['life purpose', 'existential meaning', 'personal significance', 'intrinsic value', 'human worth']
      }
    };

    const themeData = themePatterns[themeName];
    if (!themeData) return null;

    // Try to match patterns and return relevant concept
    for (const pattern of themeData.patterns) {
      if (pattern.test(lowerContext)) {
        // Return a relevant concept for this theme
        const randomConcept = themeData.concepts[Math.floor(Math.random() * themeData.concepts.length)];
        return randomConcept;
      }
    }

    return null;
  }

  generateThematicSummary(themeName, keyPoints, contexts) {
    const pointsArray = Array.from(keyPoints);
    
    if (pointsArray.length === 0) {
      // Fallback summaries when no specific points are detected
      const fallbackSummaries = {
        'Consciousness': 'Exploring the nature of subjective experience and awareness',
        'Free Will': 'Examining human agency and the reality of choice',
        'Reality': 'Investigating the fundamental nature of existence and truth',
        'Ethics': 'Analyzing moral principles and ethical decision-making',
        'Knowledge': 'Questioning how we acquire and justify beliefs',
        'Mind': 'Understanding mental processes and consciousness',
        'Identity': 'Exploring what defines personal identity over time',
        'Technology': 'Examining technology\'s impact on human existence',
        'Society': 'Analyzing social structures and human cooperation',
        'Meaning': 'Searching for purpose and significance in existence'
      };
      return fallbackSummaries[themeName] || 'Philosophical discussion of core concepts';
    }

    // Generate summary based on detected key points
    if (pointsArray.length === 1) {
      return `Discussion focuses on ${pointsArray[0]}`;
    } else if (pointsArray.length === 2) {
      return `Exploring ${pointsArray[0]} and ${pointsArray[1]}`;
    } else {
      const firstTwo = pointsArray.slice(0, 2).join(', ');
      const remaining = pointsArray.length - 2;
      return `Examining ${firstTwo} and ${remaining} other aspect${remaining > 1 ? 's' : ''}`;
    }
  }

  updateWordFrequency(message) {
    // Filter out common stop words and extract meaningful words
    const stopWords = new Set([
      // Articles, conjunctions, prepositions
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'nor', 'yet', 'so', 'as', 'if', 'than', 'then', 'else', 'while', 'until', 'unless',
      
      // Verbs (common auxiliary and linking verbs)
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'cannot',
      'am', 'going', 'get', 'got', 'getting', 'gets', 'go', 'goes', 'went', 'gone',
      
      // Personal pronouns (all forms)
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'hers', 'its', 'our', 'ours', 'their', 'theirs', 'mine', 'yours',
      'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
      
      // Demonstrative pronouns and determiners
      'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when', 'why', 'how',
      'what', 'which', 'who', 'whom', 'whose', 'whatever', 'whoever', 'whichever', 'whenever',
      'wherever', 'however', 'whether',
      
      // Prepositions (extended list)
      'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'before',
      'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'beyond', 'during', 'except',
      'from', 'inside', 'into', 'like', 'near', 'off', 'onto', 'over', 'since', 'through',
      'toward', 'towards', 'under', 'upon', 'within', 'without', 'underneath', 'alongside',
      'throughout', 'concerning', 'regarding', 'despite', 'according', 'including', 'excluding',
      
      // Adverbs and qualifiers
      'too', 'very', 'quite', 'rather', 'really', 'truly', 'actually', 'certainly', 'definitely',
      'probably', 'possibly', 'perhaps', 'maybe', 'likely', 'unlikely', 'clearly', 'obviously',
      'apparently', 'seemingly', 'presumably', 'supposedly', 'allegedly', 'reportedly',
      'just', 'now', 'only', 'also', 'back', 'even', 'still', 'yet', 'already', 'again',
      'once', 'twice', 'always', 'never', 'often', 'sometimes', 'usually', 'frequently',
      'rarely', 'hardly', 'barely', 'nearly', 'almost', 'quite', 'enough', 'much', 'many',
      'more', 'most', 'less', 'least', 'few', 'several', 'some', 'any', 'each', 'every',
      'all', 'both', 'either', 'neither', 'another', 'other', 'others', 'such', 'same',
      'different', 'similar', 'various', 'certain', 'particular', 'specific', 'general',
      
      // Common verbs (action and state)
      'way', 'well', 'know', 'make', 'see', 'come', 'take', 'use', 'work', 'say', 'think', 
      'look', 'want', 'need', 'seem', 'become', 'feel', 'find', 'give', 'tell', 'ask',
      'try', 'help', 'show', 'play', 'move', 'live', 'believe', 'hold', 'bring', 'happen',
      'write', 'provide', 'sit', 'stand', 'lose', 'add', 'hear', 'meet', 'include', 'continue',
      'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create',
      'speak', 'read', 'allow', 'run', 'walk', 'talk', 'turn', 'start', 'call', 'keep',
      
      // Other common words that add little semantic value
      'thing', 'things', 'something', 'anything', 'nothing', 'everything', 'someone', 'anyone',
      'everyone', 'nobody', 'somebody', 'anybody', 'everybody', 'somewhere', 'anywhere',
      'everywhere', 'nowhere', 'somehow', 'anyhow', 'somewhat', 'therefore', 'however',
      'moreover', 'furthermore', 'nevertheless', 'nonetheless', 'meanwhile', 'otherwise',
      'instead', 'besides', 'indeed', 'although', 'though', 'because', 'since', 'given',
      'considering', 'despite', 'regardless', 'concerning', 'regarding'
    ]);

    const words = message.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word) && !/^\d+$/.test(word));

    words.forEach(word => {
      const count = this.wordFrequency.get(word) || 0;
      this.wordFrequency.set(word, count + 1);
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
      .map(([key, data]) => {
        // Handle both old theme format and new unique ideas format
        if (data.text && data.type) {
          // New unique ideas format
          return {
            name: data.text,
            type: data.type,
            averageStrength: data.totalStrength / data.count,
            count: data.count,
            summary: data.summary,
            firstIntroduced: data.firstIntroduced
          };
        } else {
          // Legacy theme format (fallback)
          return {
            name: key,
            type: 'legacy_theme',
            averageStrength: data.totalStrength / data.count,
            count: data.count,
            keywords: Array.from(data.keywords || []),
            summary: data.summary || key
          };
        }
      })
      .sort((a, b) => {
        // Sort by count first (recurring ideas are more important), then by strength
        if (a.count !== b.count) {
          return b.count - a.count;
        }
        return b.averageStrength - a.averageStrength;
      })
      .slice(0, limit);
  }

  getWordMap(limit = 30) {
    const sortedWords = Array.from(this.wordFrequency.entries())
      .filter(([word, count]) => count >= 2) // Only include words that appear multiple times
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sortedWords.map(([word, frequency]) => {
      let size = 'md';
      if (frequency >= 10) size = 'xl';
      else if (frequency >= 7) size = 'lg';
      else if (frequency >= 5) size = 'md';
      else if (frequency >= 3) size = 'sm';
      else size = 'xs';

      return {
        word,
        frequency,
        size
      };
    });
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
      wordMap: this.getWordMap(30),
      consensusHistory: this.getConsensusGraph(),
      sentimentDistribution: this.getSentimentDistribution(),
      summary: {
        totalThemes: this.themes.size,
        totalWords: this.wordFrequency.size,
        consensusPoints: this.consensusHistory.length
      }
    };
  }
}