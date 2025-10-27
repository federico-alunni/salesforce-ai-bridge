import { Config } from '../config/config.js';
import { MCPClientService } from './mcpClient.js';
import { IAIService } from './base/AIServiceBase.js';
import { AnthropicService } from './anthropicService.js';
import { OpenRouterService } from './openRouterService.js';
import { PerplexityService } from './perplexityService.js';
import { OpenAIService } from './openAIService.js';

/**
 * Factory to create AI service instances based on configuration
 * Makes it easy to add new AI providers in the future
 */
export class AIServiceFactory {
  /**
   * Create an AI service instance based on the configured provider
   * @param config - Application configuration
   * @param mcpClient - MCP client service for tool execution
   * @returns Configured AI service instance
   */
  static createAIService(config: Config, mcpClient: MCPClientService): IAIService {
    console.log(`[AIServiceFactory] Creating AI service: ${config.aiProvider}`);
    
    switch (config.aiProvider) {
      case 'anthropic':
        return new AnthropicService(config, mcpClient);
      
      case 'openrouter':
        return new OpenRouterService(config, mcpClient);

      case 'openai':
        return new OpenAIService(config, mcpClient);

      case 'perplexity':
        return new PerplexityService(config, mcpClient);
      
      default:
        // This should never happen due to config validation,
        // but TypeScript needs this for exhaustiveness checking
        throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
    }
  }
}

/**
 * Future providers can be added here by:
 * 1. Creating a new service class that extends BaseAIService
 * 2. Adding the provider type to AIProvider in config.ts
 * 3. Adding a new case in the switch statement above
 * 
 * Example for adding Google Gemini:
 * 
 * case 'gemini':
 *   return new GeminiService(config, mcpClient);
 */
