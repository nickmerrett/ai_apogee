import { ConversationMemory } from './utils/memory.js';
import chalk from 'chalk';

console.log(chalk.blue.bold('🎭 AI Philosopher Chat - Demo Mode\n'));

const memory = new ConversationMemory();
const conversationId = memory.createConversation(
  "What is the nature of consciousness?",
  ["Human", "Claude", "ChatGPT", "Gemini"]
);

console.log(chalk.green('✨ Demo conversation created'));

memory.addMessage("Human", "Let's explore the nature of consciousness. What makes something conscious?");
memory.addMessage("Claude", "I think consciousness involves subjective experience - the felt sense of 'what it's like' to be something. It's that inner theater of awareness that seems to accompany our thoughts and perceptions.");
memory.addMessage("ChatGPT", "Building on that, consciousness appears to require integration of information. It's not just having experiences, but binding them into a unified, coherent perspective of reality.");
memory.addMessage("Gemini", "I'd add that consciousness might also involve self-reflection - the ability to be aware of one's own awareness. This meta-cognitive aspect seems crucial to what we call conscious experience.");
memory.addMessage("Human", "Interesting perspectives. Do you think consciousness exists on a spectrum, or is it binary?");

console.log(chalk.yellow('\n📋 Conversation Summary:'));
const summary = memory.summarizeConversation();
console.log(`Topic: ${summary.topic}`);
console.log(`Participants: ${summary.participants.join(', ')}`);
console.log(`Messages: ${summary.messageCount}`);
console.log(`Duration: ${summary.duration}`);

console.log(chalk.magenta('\n💬 Full Conversation:'));
const history = memory.getConversationHistory();
history.forEach(msg => {
  const color = msg.speaker === 'Human' ? chalk.blue : chalk.green;
  console.log(color.bold(`${msg.speaker}: `) + msg.content + '\n');
});

console.log(chalk.cyan('🔍 Search Demo:'));
const searchResults = memory.searchConversations('awareness');
console.log(`Found ${searchResults.length} conversations containing "awareness"`);

console.log(chalk.yellow('\n📁 Export Demo (Text Format):'));
const exportText = memory.exportConversation(null, 'text');
console.log(chalk.dim(exportText.substring(0, 300) + '...'));

console.log(chalk.green.bold('\n✅ Demo complete! All systems working correctly.'));
console.log(chalk.gray('Set API keys and run "npm start" to begin real conversations.\n'));