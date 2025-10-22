import axios, { AxiosInstance } from 'axios';
import { Config } from '../config/config.js';
import { MCPClientService } from './mcpClient.js';
import { ChatMessage } from '../types/index.js';
import { BaseAIService } from './base/AIServiceBase.js';

export class OpenRouterService extends BaseAIService {
  private client: AxiosInstance;
  private model: string;
  private config: Config;

  constructor(config: Config, mcpClient: MCPClientService) {
    super(mcpClient);
    this.config = config;
    this.model = config.openRouterModel;
    
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${config.openRouterApiKey}`,
        'HTTP-Referer': config.openRouterSiteUrl,
        'X-Title': config.openRouterAppName,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout
    });
  }

  getProviderName(): string {
    return 'OpenRouter';
  }

  getModelName(): string {
    return this.model;
  }

  async chat(messages: ChatMessage[], userMessage: string, salesforceAuth?: any, recordContext?: any): Promise<string> {
    try {
      // Get available tools from MCP server
      const tools = await this.getToolsForOpenRouter();

      // Prepend record context to user message if provided
      let enhancedUserMessage = userMessage;
      if (recordContext) {
        const contextPrefix = this.formatRecordContext(recordContext);
        enhancedUserMessage = contextPrefix + userMessage;
      }

      // Build conversation history
      const conversationMessages = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: enhancedUserMessage,
        },
      ];

      console.log(`📝 Including ${conversationMessages.length} messages in conversation (${messages.length} from history + 1 current)`);
      console.log(`Processing message with ${tools.length} available tools`);

      // Call OpenRouter with tools
      let response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          ...conversationMessages,
        ],
        tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 4096,
      });

      console.log('OpenRouter initial response:', {
        model: response.data.model,
        finishReason: response.data.choices[0]?.finish_reason,
      });

      let iteration = 0;
      const maxIterations = 10;

      // Agentic loop: Handle tool calls
      while (
        response.data.choices[0]?.finish_reason === 'tool_calls' &&
        iteration < maxIterations
      ) {
        iteration++;
        const message = response.data.choices[0].message;
        const toolCalls = message.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          break;
        }

        console.log(`Iteration ${iteration}: Processing ${toolCalls.length} tool calls`);

        // Add assistant message to conversation
        conversationMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: toolCalls,
        } as ChatMessage);

        // Execute each tool call and collect results
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs;
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            toolArgs = {};
          }

          console.log(`Executing tool: ${toolName}`, toolArgs);

          // Execute the tool via MCP with Salesforce auth context
          const toolResult = await this.executeTool(toolName, toolArgs, salesforceAuth);

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool',
            content: typeof toolResult === 'string' 
              ? toolResult 
              : JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
            name: toolName,
          } as ChatMessage);
        }

        // Continue conversation with tool results
        response = await this.client.post('/chat/completions', {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            ...conversationMessages,
          ],
          tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 4096,
        });

        console.log(`Iteration ${iteration} response:`, {
          finishReason: response.data.choices[0]?.finish_reason,
        });
      }

      if (iteration >= maxIterations) {
        return 'I apologize, but I reached the maximum number of steps while processing your request. Please try simplifying your request or breaking it into smaller parts.';
      }

      // Extract final text response
      const finalMessage = response.data.choices[0]?.message;
      return finalMessage?.content || 'I processed your request but had no response to provide.';
    } catch (error: any) {
      console.error('Error in OpenRouter chat:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY environment variable.');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }

  private async getToolsForOpenRouter(): Promise<any[]> {
    const mcpTools = await this.mcpClient.listTools();

    return mcpTools.map((tool: any) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    }));
  }

}
