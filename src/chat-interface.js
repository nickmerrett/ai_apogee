import readline from 'readline';
import chalk from 'chalk';
import { ConversationMemory } from './utils/memory.js';

export class ChatInterface {
  constructor(aiProviders) {
    this.aiProviders = aiProviders;
    this.memory = new ConversationMemory();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.currentTopic = null;
    this.moderatorName = 'Human';
    this.roundCount = 0;
    this.maxRounds = 10;
  }

  async start() {
    console.log(chalk.blue.bold('\n🎭 AI Philosopher Chat'));
    console.log(chalk.gray('A moderated debate platform for AI philosophers\n'));
    
    await this.setupConversation();
    await this.runConversation();
  }

  async setupConversation() {
    const topic = await this.askQuestion(chalk.cyan('What topic would you like the AIs to debate? '));
    const participants = [this.moderatorName, ...this.aiProviders.map(p => p.name)];
    
    this.currentTopic = topic;
    this.memory.createConversation(topic, participants);
    
    console.log(chalk.green(`\n✨ Starting philosophical debate on: "${topic}"`));
    console.log(chalk.gray(`Participants: ${participants.join(', ')}\n`));
    
    console.log(chalk.yellow('🎯 Moderation Commands:'));
    console.log(chalk.gray('  - Type your message to add to the conversation'));
    console.log(chalk.gray('  - Type "next" to let AIs continue without your input'));
    console.log(chalk.gray('  - Type "summary" to get conversation summary'));
    console.log(chalk.gray('  - Type "consensus" to check for consensus'));
    console.log(chalk.gray('  - Type "export" to export conversation'));
    console.log(chalk.gray('  - Type "quit" to end the conversation\n'));
  }

  async runConversation() {
    const openingPrompt = `Let's begin our philosophical discussion about "${this.currentTopic}". Each of you should present your initial perspective in turn.`;
    
    this.memory.addMessage(this.moderatorName, openingPrompt);
    console.log(chalk.blue.bold(`${this.moderatorName}: `) + openingPrompt + '\n');

    while (this.roundCount < this.maxRounds) {
      await this.conductRound();
      this.roundCount++;
      
      if (await this.checkForConsensus()) {
        console.log(chalk.green.bold('\n🎉 Consensus reached! The debate has concluded successfully.\n'));
        break;
      }
    }

    await this.concludeConversation();
  }

  async conductRound() {
    console.log(chalk.magenta(`\n--- Round ${this.roundCount + 1} ---\n`));
    
    for (const provider of this.aiProviders) {
      const history = this.memory.getConversationHistory();
      const context = {
        topic: this.currentTopic,
        participants: [this.moderatorName, ...this.aiProviders.map(p => p.name)],
        conversationHistory: history
      };

      const lastMessage = history[history.length - 1];
      const prompt = `Continue the philosophical discussion about "${this.currentTopic}". Build on the previous responses and work toward finding common ground.`;

      console.log(chalk.yellow(`${provider.name} is thinking...`));
      
      const response = await provider.sendMessage(prompt, context);
      this.memory.addMessage(provider.name, response);
      
      console.log(chalk.green.bold(`${provider.name}: `) + response + '\n');
      
      await this.sleep(1000);
    }

    const moderatorInput = await this.askQuestion(
      chalk.cyan('Your response (or "next" to continue, "consensus" to check, "quit" to end): ')
    );

    if (moderatorInput.toLowerCase() === 'quit') {
      return this.concludeConversation();
    } else if (moderatorInput.toLowerCase() === 'next') {
      console.log(chalk.gray('Continuing to next round...\n'));
    } else if (moderatorInput.toLowerCase() === 'summary') {
      this.showSummary();
    } else if (moderatorInput.toLowerCase() === 'consensus') {
      await this.checkForConsensus(true);
    } else if (moderatorInput.toLowerCase() === 'export') {
      await this.exportConversation();
    } else {
      this.memory.addMessage(this.moderatorName, moderatorInput);
      console.log(chalk.blue.bold(`${this.moderatorName}: `) + moderatorInput + '\n');
    }
  }

  async checkForConsensus(manual = false) {
    const history = this.memory.getConversationHistory();
    const recentMessages = history.slice(-6);
    
    const consensusPrompt = `Based on the recent discussion, analyze if the participants have reached a consensus on "${this.currentTopic}". Look for common themes, agreements, and shared conclusions. Respond with "CONSENSUS: [brief summary]" if consensus is reached, or "NO_CONSENSUS: [what still needs discussion]" if not.`;

    try {
      const claudeProvider = this.aiProviders.find(p => p.name === 'Claude');
      if (claudeProvider) {
        const context = {
          topic: this.currentTopic,
          participants: [this.moderatorName, ...this.aiProviders.map(p => p.name)],
          conversationHistory: recentMessages
        };
        
        const analysis = await claudeProvider.sendMessage(consensusPrompt, context);
        
        if (manual) {
          console.log(chalk.magenta.bold('\n📊 Consensus Analysis:'));
          console.log(chalk.white(analysis) + '\n');
        }
        
        return analysis.toLowerCase().includes('consensus:');
      }
    } catch (error) {
      console.log(chalk.red('Error checking consensus:', error.message));
    }
    
    return false;
  }

  showSummary() {
    const summary = this.memory.summarizeConversation();
    if (summary) {
      console.log(chalk.magenta.bold('\n📋 Conversation Summary:'));
      console.log(chalk.white(`Topic: ${summary.topic}`));
      console.log(chalk.white(`Participants: ${summary.participants.join(', ')}`));
      console.log(chalk.white(`Messages: ${summary.messageCount}`));
      console.log(chalk.white(`Duration: ${summary.duration}`));
      console.log(chalk.white(`Last message: ${summary.lastMessage?.content?.substring(0, 100)}...\n`));
    }
  }

  async exportConversation() {
    const format = await this.askQuestion(chalk.cyan('Export format (json/text): '));
    const exportData = this.memory.exportConversation(null, format.toLowerCase());
    
    if (exportData) {
      const filename = `conversation_${Date.now()}.${format.toLowerCase()}`;
      console.log(chalk.green(`\n💾 Conversation exported as: ${filename}`));
      console.log(chalk.gray('(Note: In a full implementation, this would save to file)\n'));
      
      if (format.toLowerCase() === 'text') {
        console.log(chalk.dim(exportData.substring(0, 300) + '...'));
      }
    }
  }

  async concludeConversation() {
    console.log(chalk.blue.bold('\n🎭 Conversation Concluded'));
    this.showSummary();
    
    const shouldExport = await this.askQuestion(chalk.cyan('Would you like to export this conversation? (y/n): '));
    if (shouldExport.toLowerCase() === 'y' || shouldExport.toLowerCase() === 'yes') {
      await this.exportConversation();
    }
    
    console.log(chalk.green('Thank you for moderating this philosophical debate! 🌟\n'));
    this.rl.close();
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}