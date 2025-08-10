import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClaudeProvider } from './providers/claude-provider.js';
import { ChatGPTProvider } from './providers/chatgpt-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { MetaProvider } from './providers/meta-provider.js';
import { WatsonxProvider } from './providers/watsonx-provider.js';
import { GrokProvider } from './providers/grok-provider.js';
import { MistralProvider } from './providers/mistral-provider.js';
import { ConversationMemory } from './utils/memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  META_API_KEY: process.env.META_API_KEY,
  WATSONX_API_KEY: process.env.WATSONX_API_KEY,
  GROK_API_KEY: process.env.GROK_API_KEY,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  PORT: process.env.PORT || 3000
};

class PhilosopherChatServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.providers = [];
    this.memory = new ConversationMemory();
    this.activeConversations = new Map();
    this.conversationConfigs = new Map();
    this.autoRoundCounts = new Map();
    this.consecutiveAIMessages = new Map(); // Track consecutive AI messages
    this.conversationActiveProviders = new Map();
    
    this.setupProviders();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupProviders(config = {}) {
    console.log('🚀 Initializing AI providers...');

    this.providers = []; // Reset providers
    
    if (CONFIG.ANTHROPIC_API_KEY) {
      try {
        this.providers.push(new ClaudeProvider(CONFIG.ANTHROPIC_API_KEY, config));
        console.log('✅ Claude provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize Claude:', error.message);
      }
    }

    if (CONFIG.OPENAI_API_KEY) {
      try {
        this.providers.push(new ChatGPTProvider(CONFIG.OPENAI_API_KEY, config));
        console.log('✅ ChatGPT provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize ChatGPT:', error.message);
      }
    }

    if (CONFIG.GOOGLE_API_KEY) {
      try {
        this.providers.push(new GeminiProvider(CONFIG.GOOGLE_API_KEY, config));
        console.log('✅ Gemini provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize Gemini:', error.message);
      }
    }

    if (CONFIG.META_API_KEY) {
      try {
        this.providers.push(new MetaProvider(CONFIG.META_API_KEY, config));
        console.log('✅ Meta AI provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize Meta AI:', error.message);
      }
    }

    if (CONFIG.WATSONX_API_KEY) {
      try {
        this.providers.push(new WatsonxProvider(CONFIG.WATSONX_API_KEY, config));
        console.log('✅ Watsonx provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize Watsonx:', error.message);
      }
    }

    if (CONFIG.GROK_API_KEY) {
      try {
        this.providers.push(new GrokProvider(CONFIG.GROK_API_KEY, config));
        console.log('✅ Grok provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize Grok:', error.message);
      }
    }

    if (CONFIG.MISTRAL_API_KEY) {
      try {
        this.providers.push(new MistralProvider(CONFIG.MISTRAL_API_KEY, config));
        console.log('✅ Mistral provider initialized');
      } catch (error) {
        console.log('❌ Failed to initialize Mistral:', error.message);
      }
    }

    if (this.providers.length === 0) {
      console.log('⚠️  No AI providers available - starting in demo mode');
    }
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // Health check endpoint for Docker
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        providers: this.providers.length,
        uptime: process.uptime()
      });
    });

    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    this.app.get('/api/providers', (req, res) => {
      res.json({
        providers: this.providers.map(p => ({ name: p.name })),
        available: this.providers.length > 0
      });
    });

    this.app.get('/api/conversation/:id', (req, res) => {
      const history = this.memory.getConversationHistory(req.params.id);
      const analytics = this.memory.getAnalytics();
      res.json({ history, analytics });
    });

    this.app.post('/api/conversation', (req, res) => {
      const { topic, config = {} } = req.body;
      
      // Update providers with new configuration
      if (config.maxTokens || config.temperature) {
        this.setupProviders(config);
      }
      
      const participants = ['Human', ...this.providers.map(p => p.name)];
      const conversationId = this.memory.createConversation(topic, participants);
      
      // Store conversation config
      this.conversationConfigs.set(conversationId, {
        maxTokens: config.maxTokens || 300,
        temperature: config.temperature || 0.7,
        autoRounds: config.autoRounds !== false // Default to true
      });
      
      this.autoRoundCounts.set(conversationId, 0);
      this.consecutiveAIMessages.set(conversationId, 0);
      
      // Initialize all providers as active
      this.conversationActiveProviders.set(conversationId, new Set(this.providers.map(p => p.name)));
      
      res.json({ conversationId, participants, config: this.conversationConfigs.get(conversationId) });
    });

    this.app.post('/api/conversation/:id/config', (req, res) => {
      const { config } = req.body;
      const conversationId = req.params.id;
      
      // Update providers with new configuration
      this.setupProviders(config);
      
      // Update conversation config
      this.conversationConfigs.set(conversationId, {
        maxTokens: config.maxTokens || 300,
        temperature: config.temperature || 0.7,
        autoRounds: config.autoRounds !== false
      });
      
      res.json({ success: true, config: this.conversationConfigs.get(conversationId) });
    });

    // Chat history management endpoints
    this.app.get('/api/conversations', async (req, res) => {
      try {
        const conversations = await this.memory.getAllConversations();
        res.json({ success: true, conversations });
      } catch (error) {
        console.error('Failed to get conversations:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/conversations/search', async (req, res) => {
      try {
        const { q: query } = req.query;
        if (!query) {
          return res.status(400).json({ success: false, error: 'Query parameter is required' });
        }
        
        const results = await this.memory.searchStoredConversations(query);
        res.json({ success: true, results });
      } catch (error) {
        console.error('Failed to search conversations:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/conversation/:id/resume', async (req, res) => {
      try {
        const conversationId = req.params.id;
        const conversation = await this.memory.resumeConversation(conversationId);
        
        if (conversation) {
          // Initialize conversation config
          this.conversationConfigs.set(conversationId, {
            maxTokens: 300,
            temperature: 0.7,
            autoRounds: true
          });
          
          this.autoRoundCounts.set(conversationId, 0);
          this.consecutiveAIMessages.set(conversationId, 0);
          this.conversationActiveProviders.set(conversationId, new Set(this.providers.map(p => p.name)));
          
          res.json({ 
            success: true, 
            conversation: {
              id: conversation.id,
              topic: conversation.topic,
              participants: conversation.participants,
              status: conversation.status
            },
            history: conversation.history
          });
        } else {
          res.status(404).json({ success: false, error: 'Conversation not found' });
        }
      } catch (error) {
        console.error('Failed to resume conversation:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/conversation/:id', async (req, res) => {
      try {
        const conversationId = req.params.id;
        const success = await this.memory.deleteConversation(conversationId);
        
        if (success) {
          // Clean up server state
          this.conversationConfigs.delete(conversationId);
          this.autoRoundCounts.delete(conversationId);
          this.consecutiveAIMessages.delete(conversationId);
          this.conversationActiveProviders.delete(conversationId);
          
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: 'Conversation not found' });
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/storage/stats', async (req, res) => {
      try {
        const stats = await this.memory.getStorageStats();
        res.json({ success: true, stats });
      } catch (error) {
        console.error('Failed to get storage stats:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('👤 User connected:', socket.id);

      socket.on('join-conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`👤 User ${socket.id} joined conversation ${conversationId}`);
        
        const history = this.memory.getConversationHistory(conversationId);
        const analytics = this.memory.getAnalytics();
        socket.emit('conversation-state', { history, analytics });
      });

      socket.on('human-message', async (data) => {
        const { conversationId, message } = data;
        
        try {
          await this.memory.addMessage('Human', message, conversationId, this.providers);
          
          const messageData = {
            id: Date.now(),
            speaker: 'Human',
            content: message,
            timestamp: new Date().toISOString()
          };

          this.io.to(conversationId).emit('new-message', messageData);
          
          const consensus = await this.memory.updateConsensus(this.providers);
          const analytics = this.memory.getAnalytics();
          
          this.io.to(conversationId).emit('analytics-update', {
            consensus,
            themes: analytics.themes,
            wordMap: analytics.wordMap
          });

          // Reset auto-round count and consecutive AI messages when human participates
          this.autoRoundCounts.set(conversationId, 0);
          this.consecutiveAIMessages.set(conversationId, 0);
          
          await this.processAIResponses(conversationId);
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('request-ai-responses', async (conversationId) => {
        await this.processAIResponses(conversationId);
      });

      socket.on('update-active-providers', (data) => {
        const { conversationId, activeProviders } = data;
        this.conversationActiveProviders.set(conversationId, new Set(activeProviders));
        
        // Send only safe, serializable data about providers
        socket.emit('providers-updated', {
          providers: this.providers
            .filter(p => activeProviders.includes(p.name))
            .map(p => ({ 
              name: p.name,
              active: true 
            }))
        });
      });

      socket.on('end-conversation', async (conversationId) => {
        try {
          // End and save conversation
          await this.memory.endConversation(conversationId);
          await this.generateConversationSummary(conversationId, socket);
        } catch (error) {
          console.error('Error generating summary:', error);
          socket.emit('error', { message: 'Failed to generate summary' });
        }
      });

      socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.id);
      });
    });
  }

  // Helper method to randomly shuffle an array
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Helper method to select a random provider
  getRandomProvider(providers, excludeProvider = null) {
    const availableProviders = excludeProvider 
      ? providers.filter(p => p.name !== excludeProvider)
      : providers;
    
    if (availableProviders.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableProviders.length);
    return availableProviders[randomIndex];
  }

  async processAIResponses(conversationId) {
    if (this.providers.length === 0) {
      this.io.to(conversationId).emit('demo-response', {
        message: 'Demo mode: AI providers would respond here with actual API keys'
      });
      return;
    }

    const history = this.memory.getConversationHistory(conversationId);
    const conversation = this.memory.getCurrentConversation();
    const config = this.conversationConfigs.get(conversationId) || {};
    const activeProviders = this.conversationActiveProviders.get(conversationId) || new Set();
    
    if (!conversation) return;

    const context = {
      topic: conversation.topic,
      participants: conversation.participants,
      conversationHistory: history
    };

    // Only process responses from active providers
    const availableProviders = this.providers.filter(p => activeProviders.has(p.name));
    
    if (availableProviders.length === 0) {
      this.io.to(conversationId).emit('error', { message: 'No active AI providers selected' });
      return;
    }

    // RANDOMIZATION: Choose providers in random order
    // STRICT RULE: Never allow the same provider to speak twice in a row
    const lastAIMessage = history.slice().reverse().find(msg => msg.speaker !== 'Human');
    const lastAISpeaker = lastAIMessage ? lastAIMessage.speaker : null;
    
    let providersToUse;
    if (availableProviders.length === 1) {
      // Only one provider available - must use it (can't avoid repeats)
      providersToUse = availableProviders;
      if (lastAISpeaker === availableProviders[0].name) {
        console.log(`⚠️ Only one provider available: ${availableProviders[0].name} must speak again`);
      }
    } else if (history.length === 1) {
      // First AI responses after human input - randomly shuffle all
      providersToUse = this.shuffleArray(availableProviders);
      console.log(`🎲 First round: Random order selected:`, providersToUse.map(p => p.name));
      
      // Notify users about random selection
      this.io.to(conversationId).emit('random-selection', {
        type: 'first-round',
        message: `🎲 Randomly selected speaking order: ${providersToUse.map(p => p.name).join(' → ')}`,
        speakers: providersToUse.map(p => p.name)
      });
    } else {
      // Subsequent rounds - MUST avoid the last AI speaker (strict no-repeat rule)
      const eligibleProviders = availableProviders.filter(p => p.name !== lastAISpeaker);
      
      if (eligibleProviders.length > 0) {
        // Select randomly from providers who didn't speak last
        const primaryChoice = this.getRandomProvider(eligibleProviders);
        const remainingProviders = eligibleProviders.filter(p => p.name !== primaryChoice.name);
        providersToUse = [primaryChoice, ...this.shuffleArray(remainingProviders)];
        
        console.log(`🎲 Random next speaker: ${primaryChoice.name} (strictly avoiding repeat of ${lastAISpeaker})`);
        console.log(`🎲 Eligible providers were:`, eligibleProviders.map(p => p.name));
        
        // Notify users about random selection
        this.io.to(conversationId).emit('random-selection', {
          type: 'next-speaker',
          message: `🎲 ${primaryChoice.name} randomly selected to continue (avoiding ${lastAISpeaker})`,
          speaker: primaryChoice.name,
          previousSpeaker: lastAISpeaker,
          eligibleCount: eligibleProviders.length
        });
      } else {
        // This should never happen if we have multiple providers, but safety fallback
        console.log(`⚠️ No eligible providers found - this shouldn't happen with multiple active providers`);
        providersToUse = this.shuffleArray(availableProviders);
        
        this.io.to(conversationId).emit('random-selection', {
          type: 'error-fallback',
          message: `🎲 Random fallback order: ${providersToUse.map(p => p.name).join(' → ')}`,
          speakers: providersToUse.map(p => p.name)
        });
      }
    }

    for (const provider of providersToUse) {
      try {
        this.io.to(conversationId).emit('ai-thinking', { 
          provider: provider.name 
        });

        const lastMessage = history[history.length - 1];
        
        // Generate varied prompts for more interesting conversations
        const promptVariations = [
          `Continue the philosophical discussion about "${conversation.topic}". Build on the previous responses and work toward finding common ground. Recent context: ${lastMessage?.content || 'Begin the discussion.'}`,
          `Engage with the philosophical question: "${conversation.topic}". Consider the previous perspectives and offer your unique insights. Recent context: ${lastMessage?.content || 'Share your initial thoughts.'}`,
          `Join the philosophical debate on "${conversation.topic}". What aspects haven't been fully explored yet? Recent context: ${lastMessage?.content || 'What\'s your perspective?'}`,
          `Contribute to the discussion about "${conversation.topic}". You might agree, disagree, or build upon what's been said. Recent context: ${lastMessage?.content || 'Please share your viewpoint.'}`,
          `Explore the philosophical dimensions of "${conversation.topic}". What new angles or considerations can you bring? Recent context: ${lastMessage?.content || 'What are your thoughts?'}`
        ];
        
        const randomPromptIndex = Math.floor(Math.random() * promptVariations.length);
        const prompt = promptVariations[randomPromptIndex];

        const response = await provider.sendMessage(prompt, context);
        
        // Clean response of any participant labels
        const cleanResponse = this.cleanResponseText(response, provider.name);
        
        await this.memory.addMessage(provider.name, cleanResponse, conversationId, this.providers);

        const messageData = {
          id: Date.now() + Math.random(),
          speaker: provider.name,
          content: cleanResponse,
          timestamp: new Date().toISOString()
        };

        this.io.to(conversationId).emit('new-message', messageData);

        const consensus = await this.memory.updateConsensus(this.providers);
        const analytics = this.memory.getAnalytics();

        this.io.to(conversationId).emit('analytics-update', {
          consensus,
          themes: analytics.themes.slice(0, 5),
          wordMap: analytics.wordMap
        });

        // Add some randomness to response delays too (3-6 seconds)
        const randomDelay = 3000 + Math.floor(Math.random() * 3000);
        await new Promise(resolve => setTimeout(resolve, randomDelay));

      } catch (error) {
        console.error(`Error from ${provider.name}:`, error.message);
        this.io.to(conversationId).emit('ai-error', {
          provider: provider.name,
          error: error.message
        });
      }
    }

    // Track consecutive AI messages
    const currentConsecutiveAI = this.consecutiveAIMessages.get(conversationId) || 0;
    this.consecutiveAIMessages.set(conversationId, currentConsecutiveAI + providersToUse.length);

    // Check for moderation pause (4-5 consecutive AI messages)
    const updatedConsecutiveAI = this.consecutiveAIMessages.get(conversationId);
    const moderationPauseThreshold = config.moderationPause || 4; // Default to 4, allow 5

    if (updatedConsecutiveAI >= moderationPauseThreshold) {
      this.io.to(conversationId).emit('moderation-pause', {
        consecutiveMessages: updatedConsecutiveAI,
        threshold: moderationPauseThreshold,
        message: `💬 ${updatedConsecutiveAI} consecutive AI messages. Pausing for moderator input...`,
        suggestion: 'Add your perspective, ask a follow-up question, or steer the discussion in a new direction.'
      });
      return; // Stop automatic responses - wait for human input
    }

    // Check for traditional auto-rounds (if enabled)
    if (config.autoRounds !== false) {
      const currentAutoRounds = this.autoRoundCounts.get(conversationId) || 0;
      
      if (currentAutoRounds < 2) {
        this.autoRoundCounts.set(conversationId, currentAutoRounds + 1);
        
        this.io.to(conversationId).emit('auto-round-notification', {
          current: currentAutoRounds + 1,
          max: 2,
          consecutiveAI: updatedConsecutiveAI,
          message: `Auto-round ${currentAutoRounds + 1}/2 - AIs continuing discussion... (${updatedConsecutiveAI} consecutive AI messages)`
        });

        // Continue with another round after a delay
        setTimeout(() => {
          this.processAIResponses(conversationId);
        }, 3000);
      } else {
        this.io.to(conversationId).emit('auto-round-complete', {
          message: 'Auto-rounds complete. Waiting for human input to continue...'
        });
      }
    }
  }

  cleanResponseText(response, providerName) {
    // Remove any participant labels from the response
    const patterns = [
      new RegExp(`^${providerName}:\\s*`, 'i'),
      /^Claude:\s*/i,
      /^ChatGPT:\s*/i,
      /^Gemini:\s*/i,
      /^Meta AI:\s*/i,
      /^Watsonx:\s*/i,
      /^Grok:\s*/i,
      /^Mistral:\s*/i,
      /^Human:\s*/i,
      /^\w+:\s*/
    ];

    let cleaned = response;
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.trim();
  }

  async generateConversationSummary(conversationId, socket) {
    const history = this.memory.getConversationHistory(conversationId);
    const conversation = this.memory.getCurrentConversation();
    
    if (!conversation || history.length === 0) {
      socket.emit('error', { message: 'No conversation to summarize' });
      return;
    }

    // Find Claude provider for summary generation
    const claudeProvider = this.providers.find(p => p.name === 'Claude');
    if (!claudeProvider) {
      socket.emit('error', { message: 'Claude provider not available for summary generation' });
      return;
    }

    // Prepare conversation context for summary
    const conversationText = history.map(msg => 
      `${msg.speaker}: ${msg.content}`
    ).join('\n\n');

    const summaryPrompt = `You are tasked with creating a comprehensive, detailed philosophical analysis that reads like a mini white paper or academic research summary. This should be extensive, thorough, and use thousands of words to deeply examine every aspect of the conversation.

CONVERSATION DETAILS:
- Topic: "${conversation.topic}"
- Participants: ${conversation.participants.join(', ')}
- Message Count: ${history.length} messages
- Duration: Multi-turn philosophical dialogue

TASK: Create an exhaustive, multi-page analysis (aim for 3000-5000+ words) that serves as a complete philosophical examination. This should read like an academic paper or comprehensive research report.

REQUIRED STRUCTURE (expand each section extensively):

# PHILOSOPHICAL DIALOGUE ANALYSIS: ${conversation.topic}

## EXECUTIVE SUMMARY
Provide a substantial overview (300-500 words) that captures the essence, scope, and significance of this philosophical inquiry.

## 1. INTRODUCTION & CONTEXTUAL FRAMEWORK
- Historical and philosophical context of the topic
- Why this question matters in contemporary discourse
- Relevance to broader philosophical traditions
- Scope and boundaries of the discussion

## 2. METHODOLOGICAL APPROACH
- Nature of the dialogue format
- Participant perspectives and backgrounds
- Conversational dynamics and flow
- Quality and depth of engagement

## 3. COMPREHENSIVE ARGUMENT ANALYSIS

### 3.1 Core Philosophical Positions Presented
For EACH participant, provide extensive analysis:
- Primary philosophical stance
- Underlying assumptions and premises
- Logical structure of their arguments
- Evidence and reasoning patterns
- Philosophical tradition/school alignment
- Strengths and potential weaknesses

### 3.2 Argument Development Patterns
- How each position evolved through the dialogue
- Refinements and clarifications made
- Response patterns to challenges
- Adaptation of arguments based on feedback

## 4. THEMATIC DEEP DIVE

### 4.1 Primary Themes Explored
Identify and extensively analyze each major theme:
- Definition and scope of the theme
- How it emerged in conversation
- Different perspectives offered
- Philosophical significance
- Connection to broader discourse

### 4.2 Secondary and Implicit Themes
- Underlying assumptions that surfaced
- Unspoken philosophical commitments
- Emergent questions and implications
- Cross-connections between themes

## 5. CRITICAL ANALYSIS OF KEY EXCHANGES

Select 3-5 pivotal moments in the conversation and provide detailed analysis:
- Context and setup of the exchange
- Precise argumentation presented
- Logical moves and countermoves
- Philosophical significance
- Impact on overall discussion trajectory

## 6. AREAS OF CONVERGENCE AND SYNTHESIS

### 6.1 Points of Agreement
- Explicit agreements reached
- Implicit common ground
- Shared assumptions and values
- Potential for synthesis

### 6.2 Productive Tensions
- Disagreements that enhanced understanding
- Constructive challenges and responses
- Dialectical development of ideas

## 7. PERSISTENT DISAGREEMENTS AND DIVERGENCE

### 7.1 Fundamental Differences
- Irreconcilable philosophical positions
- Root causes of disagreement
- Different epistemological or ontological commitments
- Methodological differences

### 7.2 Analysis of Disagreement Patterns
- Why certain positions remained fixed
- Quality of engagement with opposing views
- Missed opportunities for dialogue

## 8. PHILOSOPHICAL INSIGHTS AND CONTRIBUTIONS

### 8.1 Novel Insights Generated
- Original thoughts or perspectives that emerged
- Creative combinations of existing ideas
- Unexpected connections made

### 8.2 Clarifications and Refinements
- How existing positions were sharpened
- Ambiguities resolved or identified
- Conceptual distinctions drawn

## 9. BROADER PHILOSOPHICAL IMPLICATIONS

### 9.1 Contribution to the Field
- How this dialogue advances philosophical understanding
- Connections to ongoing academic debates
- Potential influence on future inquiry

### 9.2 Practical and Applied Implications
- Real-world relevance of the insights
- Ethical, political, or social ramifications
- Applications to other philosophical areas

## 10. DIALOGUE QUALITY ASSESSMENT

### 10.1 Conversational Dynamics
- Quality of listening and engagement
- Charitable interpretation of opposing views
- Intellectual honesty and rigor
- Emotional and rational balance

### 10.2 Areas for Further Development
- Questions left unresolved
- Avenues for future exploration
- Gaps in reasoning or evidence
- Opportunities for deeper inquiry

## 11. COMPARATIVE ANALYSIS
- How this discussion relates to historical philosophical debates
- Connections to major philosophical works and thinkers
- Novel aspects or unique contributions
- Position within contemporary philosophical landscape

## 12. CONCLUSION AND SYNTHESIS
- Comprehensive integration of all findings
- Assessment of the dialogue's overall contribution
- Remaining open questions
- Directions for future philosophical inquiry
- Final reflections on the topic's significance

---

IMPORTANT INSTRUCTIONS:
- Write extensively on EACH section - aim for several paragraphs per subsection
- Use sophisticated philosophical vocabulary and analysis
- Include specific quotes and references from the conversation
- Provide deep, nuanced analysis rather than surface-level descriptions
- Make connections to broader philosophical traditions and thinkers when relevant
- Ensure academic rigor while remaining accessible
- Use this opportunity to demonstrate the full depth and richness of the philosophical exchange

CONVERSATION TRANSCRIPT:
${conversationText}`;

    try {
      socket.emit('summary-generating', { status: 'Preparing comprehensive analysis...' });
      
      const context = {
        topic: conversation.topic,
        participants: conversation.participants,
        conversationHistory: []  // Empty for summary generation
      };

      // Temporarily increase token limit for comprehensive summary
      const originalMaxTokens = claudeProvider.maxTokens;
      claudeProvider.maxTokens = 8000; // Much higher limit for detailed summary
      
      // Show progress updates
      setTimeout(() => socket.emit('summary-generating', { status: 'Analyzing philosophical arguments...' }), 2000);
      setTimeout(() => socket.emit('summary-generating', { status: 'Extracting key themes and insights...' }), 4000);
      setTimeout(() => socket.emit('summary-generating', { status: 'Synthesizing comprehensive analysis...' }), 6000);
      setTimeout(() => socket.emit('summary-generating', { status: 'Finalizing white paper format...' }), 8000);
      
      const summary = await claudeProvider.sendMessage(summaryPrompt, context);
      
      // Restore original token limit
      claudeProvider.maxTokens = originalMaxTokens;
      
      // Format the summary with proper HTML for display
      const formattedSummary = this.formatSummaryHTML(summary);
      
      socket.emit('summary-generated', { summary: formattedSummary });
      
      console.log(`✅ Summary generated for conversation ${conversationId}`);
      
    } catch (error) {
      console.error('Error generating summary:', error);
      socket.emit('error', { message: 'Failed to generate summary: ' + error.message });
    }
  }

  formatSummaryHTML(summary) {
    // Enhanced HTML formatting for academic/white paper style
    return summary
      // Main title (single #)
      .replace(/^# (.*$)/gm, '<h1 class="summary-title">$1</h1>')
      
      // Section headers (double ##)
      .replace(/^## (.*$)/gm, '<h2 class="summary-section">$1</h2>')
      
      // Subsection headers (triple ###)
      .replace(/^### (.*$)/gm, '<h3 class="summary-subsection">$1</h3>')
      
      // Sub-subsection headers (quadruple ####)
      .replace(/^#### (.*$)/gm, '<h4 class="summary-subsubsection">$1</h4>')
      
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      
      // Italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Bullet points with proper nesting
      .replace(/^- (.*$)/gm, '<li class="summary-bullet">$1</li>')
      .replace(/(\n<li class="summary-bullet">.*?<\/li>)+/g, '<ul class="summary-list">$&</ul>')
      .replace(/<\/li>\n<li class="summary-bullet">/g, '</li><li class="summary-bullet">')
      
      // Numbered lists
      .replace(/^\d+\. (.*$)/gm, '<li class="summary-numbered">$1</li>')
      .replace(/(\n<li class="summary-numbered">.*?<\/li>)+/g, '<ol class="summary-ordered-list">$&</ol>')
      .replace(/<\/li>\n<li class="summary-numbered">/g, '</li><li class="summary-numbered">')
      
      // Quotes or important callouts
      .replace(/^> (.*$)/gm, '<blockquote class="summary-quote">$1</blockquote>')
      
      // Code or technical terms (backticks)
      .replace(/`(.*?)`/g, '<code class="summary-code">$1</code>')
      
      // Horizontal rules for section breaks
      .replace(/^---$/gm, '<hr class="summary-divider">')
      
      // Paragraph breaks - convert double newlines to proper paragraphs
      .replace(/\n\n+/g, '</p><p class="summary-paragraph">')
      
      // Single newlines become line breaks within paragraphs
      .replace(/\n/g, '<br>')
      
      // Wrap the entire content in a paragraph container
      .replace(/^(.*)$/s, '<div class="summary-content"><p class="summary-paragraph">$1</p></div>')
      
      // Clean up any empty paragraphs
      .replace(/<p class="summary-paragraph"><\/p>/g, '')
      .replace(/<p class="summary-paragraph"><br><\/p>/g, '');
  }

  start() {
    this.server.listen(CONFIG.PORT, () => {
      console.log(`\n🎭 AI Philosopher Chat Web Interface`);
      console.log(`🌐 Server running at http://localhost:${CONFIG.PORT}`);
      console.log(`🤖 ${this.providers.length} AI provider(s) available`);
      
      if (this.providers.length === 0) {
        console.log('\n⚠️  Running in demo mode - set API keys for full functionality:');
        console.log('   ANTHROPIC_API_KEY=your_key npm run web');
      }
      
      console.log('\n📖 Open http://localhost:3000 in your browser to start\n');
    });
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});

const server = new PhilosopherChatServer();
server.start();