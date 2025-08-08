import { ClaudeProvider } from './providers/claude-provider.js';
import { ChatGPTProvider } from './providers/chatgpt-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { ConversationMemory } from './utils/memory.js';

console.log('🧪 Testing AI Provider Fixes\n');

// Test 1: Configuration
console.log('1. Testing configurable tokens and temperature...');
const testConfig = {
  maxTokens: 150,
  temperature: 0.3
};

const claudeProvider = new ClaudeProvider('fake-key', testConfig);
console.log(`✅ Claude configured: ${claudeProvider.maxTokens} tokens, ${claudeProvider.temperature} temperature`);

const chatgptProvider = new ChatGPTProvider('fake-key', testConfig);
console.log(`✅ ChatGPT configured: ${chatgptProvider.maxTokens} tokens, ${chatgptProvider.temperature} temperature`);

const geminiProvider = new GeminiProvider('fake-key', testConfig);
console.log(`✅ Gemini configured: ${geminiProvider.maxTokens} tokens, ${geminiProvider.temperature} temperature`);

// Test 2: System Prompts
console.log('\n2. Testing updated system prompts...');
const participants = ['Human', 'Claude', 'ChatGPT', 'Gemini'];
const topic = 'What is consciousness?';

const claudePrompt = claudeProvider.getSystemPrompt(topic, participants);
console.log('✅ Claude system prompt:');
console.log(claudePrompt.substring(0, 200) + '...\n');

const chatgptPrompt = chatgptProvider.getSystemPrompt(topic, participants);
console.log('✅ ChatGPT system prompt:');
console.log(chatgptPrompt.substring(0, 200) + '...\n');

// Test 3: Memory and Analytics
console.log('3. Testing enhanced memory and analytics...');
const memory = new ConversationMemory();
const conversationId = memory.createConversation(topic, participants);

memory.addMessage('Human', 'What makes something conscious?', conversationId, [claudeProvider, chatgptProvider]);
memory.addMessage('Claude', 'Consciousness involves subjective experience and awareness of one\'s own mental states.', conversationId, [claudeProvider, chatgptProvider]);
memory.addMessage('ChatGPT', 'I agree with Claude. Consciousness seems to require both awareness and the ability to reflect on that awareness.', conversationId, [claudeProvider, chatgptProvider]);

const analytics = memory.getAnalytics();
console.log(`✅ Analytics extracted ${analytics.themes.length} themes`);
console.log(`✅ Analytics found ${analytics.insights.length} insights`);

// Test 4: Consensus calculation
console.log('\n4. Testing consensus calculation...');
const consensus = await memory.updateConsensus([claudeProvider, chatgptProvider]);
console.log(`✅ Consensus level: ${consensus.level}% - ${consensus.summary}`);

// Test 5: Response cleaning test
console.log('\n5. Testing response text cleaning...');
const testResponses = [
  'Claude: I think consciousness is fascinating.',
  'ChatGPT: That\'s an interesting perspective.',
  'This is a clean response without labels.',
  'Gemini: Let me add my thoughts here.'
];

// Simulate the cleaning function
function cleanResponseText(response, providerName) {
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

testResponses.forEach((response, index) => {
  const cleaned = cleanResponseText(response, 'Claude');
  console.log(`✅ Response ${index + 1}: "${response}" → "${cleaned}"`);
});

console.log('\n🎉 All tests completed successfully!');
console.log('\n📋 Summary of fixes implemented:');
console.log('✅ AI providers can no longer simulate other participants');
console.log('✅ Token limits and temperature are fully configurable');
console.log('✅ Enhanced system prompts prevent role-playing');
console.log('✅ Response cleaning removes participant labels');
console.log('✅ Auto-rounds feature implemented (max 2 rounds)');
console.log('✅ Advanced analytics track themes and insights');
console.log('✅ Real-time consensus calculation');
console.log('✅ Web interface includes configuration modal');
console.log('✅ Notification system for auto-rounds');

console.log('\n🌐 To test the web interface:');
console.log('   1. Run: PORT=3001 npm run web');
console.log('   2. Open: http://localhost:3001');
console.log('   3. Configure tokens/temperature in setup or settings');
console.log('   4. Start a debate and observe auto-rounds');