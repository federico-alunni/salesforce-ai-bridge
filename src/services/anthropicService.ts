import Anthropic from '@anthropic-ai/sdk';
import { Config } from '../config/config.js';
import { MCPClientService } from './mcpClient.js';
import { ChatMessage } from '../types/index.js';
import { BaseAIService } from './base/AIServiceBase.js';

export class AnthropicService extends BaseAIService {
  private client: Anthropic;
  private model: string;

  constructor(config: Config, mcpClient: MCPClientService) {
    super(mcpClient);
    this.model = config.anthropicModel;
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  getProviderName(): string {
    return 'Anthropic';
  }

  getModelName(): string {
    return this.model;
  }

  async chat(messages: ChatMessage[], userMessage: string): Promise<string> {
    try {
      // Get available tools from MCP server
      const tools = await this.getToolsForClaude();

      // Build conversation history (Anthropic only accepts user/assistant roles)
      const anthropicMessages = [
        ...messages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        {
          role: 'user' as const,
          content: userMessage,
        },
      ];

      console.log(`[Anthropic] Processing message with ${tools.length} available tools`);

      // Call Claude with tools
      let response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages: anthropicMessages,
        tools,
      });

      console.log('[Anthropic] Initial response:', {
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
      });

      let iteration = 0;
      const maxIterations = 10;

      // Agentic loop: Handle tool calls
      while (response.stop_reason === 'tool_use' && iteration < maxIterations) {
        iteration++;
        const toolUseBlock = response.content.find(
          (block) => block.type === 'tool_use'
        );

        if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
          break;
        }

        console.log(`[Anthropic] Iteration ${iteration}: Using tool ${toolUseBlock.name}`);

        // Execute the tool via MCP
        const toolResult = await this.executeTool(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, unknown>
        );

        // Add assistant message and tool result to conversation
        anthropicMessages.push({
          role: 'assistant',
          content: response.content,
        } as any);

        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(toolResult),
            },
          ],
        } as any);

        // Continue conversation with tool result
        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: this.getSystemPrompt(),
          messages: anthropicMessages,
          tools,
        });

        console.log(`[Anthropic] Iteration ${iteration} response:`, {
          stopReason: response.stop_reason,
          contentBlocks: response.content.length,
        });
      }

      if (iteration >= maxIterations) {
        return 'I apologize, but I reached the maximum number of steps while processing your request. Please try simplifying your request or breaking it into smaller parts.';
      }

      // Extract final text response
      const textContent = response.content.find(
        (block: any) => block.type === 'text'
      );

      if (textContent && textContent.type === 'text') {
        return textContent.text;
      }

      return 'I processed your request but had no text response to provide.';
    } catch (error: any) {
      console.error('[Anthropic] Error:', error.message);
      
      if (error.status === 401) {
        throw new Error('Invalid Anthropic API key. Please check your ANTHROPIC_API_KEY environment variable.');
      }
      
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  private async getToolsForClaude(): Promise<Anthropic.Tool[]> {
    const mcpTools = await this.getMCPTools();

    return mcpTools.map((tool: any) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema || {
        type: 'object',
        properties: {},
      },
    }));
  }
}
