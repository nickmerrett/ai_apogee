import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConversationStorage {
  constructor() {
    this.storageDir = path.join(__dirname, '../../data/conversations');
    this.ensureStorageExists();
  }

  ensureStorageExists() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log(`📁 Created conversation storage directory: ${this.storageDir}`);
    }
  }

  getConversationPath(conversationId) {
    return path.join(this.storageDir, `${conversationId}.json`);
  }

  async saveConversation(conversation) {
    try {
      const filePath = this.getConversationPath(conversation.id);
      const conversationData = {
        ...conversation,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      await fs.promises.writeFile(filePath, JSON.stringify(conversationData, null, 2));
      console.log(`💾 Saved conversation: ${conversation.id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save conversation ${conversation.id}:`, error);
      return false;
    }
  }

  async loadConversation(conversationId) {
    try {
      const filePath = this.getConversationPath(conversationId);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      const conversation = JSON.parse(data);
      
      console.log(`📖 Loaded conversation: ${conversationId}`);
      return conversation;
    } catch (error) {
      console.error(`❌ Failed to load conversation ${conversationId}:`, error);
      return null;
    }
  }

  async getAllConversations() {
    try {
      const files = await fs.promises.readdir(this.storageDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const conversations = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.storageDir, file);
          const data = await fs.promises.readFile(filePath, 'utf8');
          const conversation = JSON.parse(data);
          
          // Only include summary data for listing
          conversations.push({
            id: conversation.id,
            topic: conversation.topic,
            participants: conversation.participants,
            messageCount: conversation.history?.length || 0,
            createdAt: conversation.createdAt,
            savedAt: conversation.savedAt,
            status: conversation.status,
            lastMessage: conversation.history?.length > 0 
              ? conversation.history[conversation.history.length - 1] 
              : null
          });
        } catch (error) {
          console.error(`❌ Failed to read conversation file ${file}:`, error);
        }
      }

      // Sort by creation date, newest first
      conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return conversations;
    } catch (error) {
      console.error('❌ Failed to get all conversations:', error);
      return [];
    }
  }

  async searchConversations(query) {
    try {
      const allConversations = await this.getAllConversations();
      const lowercaseQuery = query.toLowerCase();
      
      const matchingConversations = [];
      
      for (const conversationSummary of allConversations) {
        // Check topic match
        if (conversationSummary.topic.toLowerCase().includes(lowercaseQuery)) {
          matchingConversations.push({
            ...conversationSummary,
            matchType: 'topic'
          });
          continue;
        }
        
        // Check content match (need to load full conversation)
        const fullConversation = await this.loadConversation(conversationSummary.id);
        if (fullConversation) {
          const contentMatch = fullConversation.history.some(msg => 
            msg.content.toLowerCase().includes(lowercaseQuery)
          );
          
          if (contentMatch) {
            matchingConversations.push({
              ...conversationSummary,
              matchType: 'content'
            });
          }
        }
      }
      
      return matchingConversations;
    } catch (error) {
      console.error('❌ Failed to search conversations:', error);
      return [];
    }
  }

  async deleteConversation(conversationId) {
    try {
      const filePath = this.getConversationPath(conversationId);
      
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`🗑️ Deleted conversation: ${conversationId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to delete conversation ${conversationId}:`, error);
      return false;
    }
  }

  async getStorageStats() {
    try {
      const conversations = await this.getAllConversations();
      const totalSize = await this.getDirectorySize(this.storageDir);
      
      return {
        totalConversations: conversations.length,
        totalMessages: conversations.reduce((sum, conv) => sum + conv.messageCount, 0),
        storageSize: totalSize,
        oldestConversation: conversations.length > 0 ? conversations[conversations.length - 1].createdAt : null,
        newestConversation: conversations.length > 0 ? conversations[0].createdAt : null
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return null;
    }
  }

  async getDirectorySize(dirPath) {
    try {
      const files = await fs.promises.readdir(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        totalSize += stats.size;
      }
      
      return totalSize;
    } catch (error) {
      console.error('❌ Failed to calculate directory size:', error);
      return 0;
    }
  }
}