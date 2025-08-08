import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClaudeProvider } from './providers/claude-provider.js';
import { ChatGPTProvider } from './providers/chatgpt-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { ConversationMemory } from './utils/memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
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
          this.memory.addMessage('Human', message, conversationId, this.providers);
          
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
            insights: analytics.insights
          });

          // Reset auto-round count when human participates
          this.autoRoundCounts.set(conversationId, 0);
          
          await this.processAIResponses(conversationId);
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('request-ai-responses', async (conversationId) => {
        await this.processAIResponses(conversationId);
      });

      socket.on('request-consensus-check', async (conversationId) => {
        const consensus = await this.memory.updateConsensus(this.providers);
        this.io.to(conversationId).emit('consensus-update', consensus);
      });

      socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.id);
      });
    });
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
    
    if (!conversation) return;

    const context = {
      topic: conversation.topic,
      participants: conversation.participants,
      conversationHistory: history
    };

    for (const provider of this.providers) {
      try {
        this.io.to(conversationId).emit('ai-thinking', { 
          provider: provider.name 
        });

        const lastMessage = history[history.length - 1];
        const prompt = `Continue the philosophical discussion about "${conversation.topic}". Build on the previous responses and work toward finding common ground. Recent context: ${lastMessage?.content || 'Begin the discussion.'}`;

        const response = await provider.sendMessage(prompt, context);
        
        // Clean response of any participant labels
        const cleanResponse = this.cleanResponseText(response, provider.name);
        
        this.memory.addMessage(provider.name, cleanResponse, conversationId, this.providers);

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
          insights: analytics.insights.slice(-5)
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error from ${provider.name}:`, error.message);
        this.io.to(conversationId).emit('ai-error', {
          provider: provider.name,
          error: error.message
        });
      }
    }

    // Check for auto-rounds
    if (config.autoRounds !== false) {
      const currentAutoRounds = this.autoRoundCounts.get(conversationId) || 0;
      
      if (currentAutoRounds < 2) {
        this.autoRoundCounts.set(conversationId, currentAutoRounds + 1);
        
        this.io.to(conversationId).emit('auto-round-notification', {
          current: currentAutoRounds + 1,
          max: 2,
          message: `Auto-round ${currentAutoRounds + 1}/2 - AIs continuing discussion...`
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
      /^Human:\s*/i,
      /^\w+:\s*/
    ];

    let cleaned = response;
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.trim();
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