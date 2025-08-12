import { ClaudeProvider } from './providers/claude-provider.js';
import { ChatGPTProvider } from './providers/chatgpt-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { DeepSeekProvider } from './providers/deepseek-provider.js';
import { ChatInterface } from './chat-interface.js';
import chalk from 'chalk';

const CONFIG = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
};

async function main() {
  console.log(chalk.blue.bold('🚀 Initializing AI Philosopher Chat...\n'));

  const providers = [];

  if (CONFIG.ANTHROPIC_API_KEY) {
    try {
      providers.push(new ClaudeProvider(CONFIG.ANTHROPIC_API_KEY));
      console.log(chalk.green('✅ Claude provider initialized'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to initialize Claude provider:', error.message));
    }
  } else {
    console.log(chalk.yellow('⚠️  Claude provider skipped (no API key found)'));
    console.log(chalk.gray('   Set ANTHROPIC_API_KEY environment variable to enable'));
  }

  if (CONFIG.OPENAI_API_KEY) {
    try {
      providers.push(new ChatGPTProvider(CONFIG.OPENAI_API_KEY));
      console.log(chalk.green('✅ ChatGPT provider initialized'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to initialize ChatGPT provider:', error.message));
    }
  } else {
    console.log(chalk.yellow('⚠️  ChatGPT provider skipped (no API key found)'));
    console.log(chalk.gray('   Set OPENAI_API_KEY environment variable to enable'));
  }

  if (CONFIG.GOOGLE_API_KEY) {
    try {
      providers.push(new GeminiProvider(CONFIG.GOOGLE_API_KEY));
      console.log(chalk.green('✅ Gemini provider initialized'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to initialize Gemini provider:', error.message));
    }
  } else {
    console.log(chalk.yellow('⚠️  Gemini provider skipped (no API key found)'));
    console.log(chalk.gray('   Set GOOGLE_API_KEY environment variable to enable'));
  }

  if (CONFIG.DEEPSEEK_API_KEY) {
    try {
      providers.push(new DeepSeekProvider(CONFIG.DEEPSEEK_API_KEY));
      console.log(chalk.green('✅ DeepSeek provider initialized'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to initialize DeepSeek provider:', error.message));
    }
  } else {
    console.log(chalk.yellow('⚠️  DeepSeek provider skipped (no API key found)'));
    console.log(chalk.gray('   Set DEEPSEEK_API_KEY environment variable to enable'));
  }

  if (providers.length === 0) {
    console.log(chalk.red.bold('\n❌ No AI providers available!'));
    console.log(chalk.yellow('Please set at least one of the following environment variables:'));
    console.log(chalk.gray('  - ANTHROPIC_API_KEY (for Claude)'));
    console.log(chalk.gray('  - OPENAI_API_KEY (for ChatGPT)'));
    console.log(chalk.gray('  - GOOGLE_API_KEY (for Gemini)'));
    console.log(chalk.gray('  - DEEPSEEK_API_KEY (for DeepSeek)'));
    console.log(chalk.gray('\nExample: ANTHROPIC_API_KEY=your_key npm start\n'));
    process.exit(1);
  }

  if (providers.length < 2) {
    console.log(chalk.yellow.bold('\n⚠️  Only one AI provider available!'));
    console.log(chalk.gray('The debate will be more interesting with multiple AIs.'));
    console.log(chalk.gray('Consider adding more API keys for a richer discussion.\n'));
  }

  console.log(chalk.green.bold(`\n🎭 Ready! ${providers.length} AI philosopher(s) available for debate.\n`));

  const chatInterface = new ChatInterface(providers);
  await chatInterface.start();
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Goodbye! Thanks for using AI Philosopher Chat.'));
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('\n💥 Unexpected error:'), error.message);
  console.log(chalk.gray('The application will now exit.'));
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red.bold('❌ Application error:'), error.message);
  process.exit(1);
});