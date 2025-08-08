# AI Philosopher Chat 🎭

A moderated chat interface where multiple AI chatbots engage in respectful philosophical debates, working toward consensus under human guidance.

## Features

- **🌐 Web Interface**: Modern, responsive web UI with real-time updates
- **🤖 Multi-AI Debate**: Support for Claude, ChatGPT, and Gemini
- **👨‍💼 Human Moderation**: Direct participation and conversation steering
- **🧠 Memory Management**: Comprehensive conversation tracking and history
- **📊 Consensus Tracking**: Real-time consensus visualization and graphs
- **🏷️ Theme Analysis**: Automatic extraction and tracking of key discussion themes
- **💡 Insight Detection**: AI-powered identification of conclusions, agreements, and key points
- **📱 Responsive Design**: Works on desktop and mobile devices
- **📄 Pagination**: Handle conversations with hundreds of messages
- **📥 Export Functionality**: Save conversations and analytics data
- **🔧 Extensible Design**: Easy to add new AI providers
- **⚡ Real-time Updates**: WebSocket-based live conversation updates

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure API Keys**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Add your API keys to the `.env` file or set environment variables:
   ```bash
   export ANTHROPIC_API_KEY="your_anthropic_key"
   export OPENAI_API_KEY="your_openai_key" 
   export GOOGLE_API_KEY="your_google_key"
   ```

3. **Run the Application**
   
   **Web Interface (Recommended):**
   ```bash
   npm run web
   ```
   Then open http://localhost:3000 in your browser
   
   **Command Line Interface:**
   ```bash
   npm start
   ```

## Usage

### Web Interface

1. **Start the Server**: Run `npm run web` and open http://localhost:3000
2. **Choose a Topic**: Enter a philosophical question or select from examples
3. **Begin the Debate**: Click "Begin Debate" to start the conversation
4. **Moderate the Discussion**: 
   - Type messages to add your perspective
   - Click "Next Round" to let AIs continue without your input
   - Click "Check Consensus" to analyze agreement levels
   - Click "Export" to download the conversation and analytics

### Real-time Analytics

- **📈 Consensus Graph**: Live tracking of agreement levels over time
- **🏷️ Theme Tracker**: Automatically detected discussion themes with frequency
- **💡 Insight Feed**: Real-time extraction of key points, conclusions, and agreements
- **📊 Visual Charts**: Consensus gauge and historical trends

### Command Line Interface

1. Launch: `npm start`
2. Enter a philosophical topic when prompted
3. Use moderation commands: `next`, `summary`, `consensus`, `export`, `quit`

### Example Topics

- "What is the nature of consciousness?"
- "Is free will an illusion?"
- "What constitutes a meaningful life?"
- "Should AI have rights?"
- "What is the relationship between technology and humanity?"

## Architecture

### Core Components

- **`BaseAIProvider`**: Abstract interface for AI integration
- **`ConversationMemory`**: Manages conversation history and analysis
- **`ChatInterface`**: Handles user interaction and conversation flow

### AI Providers

- **Claude Provider**: Anthropic's Claude integration
- **ChatGPT Provider**: OpenAI's GPT integration  
- **Gemini Provider**: Google's Gemini integration

### Adding New AI Providers

1. Create a new provider class extending `BaseAIProvider`
2. Implement the `sendMessage()` method
3. Add initialization logic in `src/index.js`

Example:
```javascript
import { BaseAIProvider } from './base-provider.js';

export class NewAIProvider extends BaseAIProvider {
  constructor(apiKey) {
    super('NewAI', apiKey);
    // Initialize your AI client here
  }

  async sendMessage(message, context = {}) {
    // Implement API call logic
    const response = await this.client.generateResponse(message);
    this.addToHistory('assistant', response);
    return response;
  }
}
```

## API Requirements

### Required API Keys

- **Anthropic**: Get your key at [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: Get your key at [platform.openai.com](https://platform.openai.com)
- **Google**: Get your key at [ai.google.dev](https://ai.google.dev)

At least one API key is required to run the application.

## Memory Features

The conversation memory system provides:

- **Message Tracking**: All conversations with timestamps
- **Search Functionality**: Find conversations by topic or content
- **Duration Analysis**: Track conversation length and engagement
- **Export Options**: JSON and plain text formats
- **Summary Generation**: Key statistics and insights

## Contributing

To extend functionality:

1. Follow the existing provider pattern for new AI integrations
2. Maintain the conversation memory interface
3. Add appropriate error handling
4. Update documentation for new features

## License

MIT License - feel free to modify and distribute.