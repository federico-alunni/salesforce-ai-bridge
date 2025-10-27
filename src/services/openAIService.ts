import axios, { AxiosInstance } from 'axios';
import { Config } from '../config/config.js';
import { MCPClientService } from './mcpClient.js';
import { ChatMessage } from '../types/index.js';
import { BaseAIService } from './base/AIServiceBase.js';

export class OpenAIService extends BaseAIService {
  private client: AxiosInstance;
  private model: string;
  private config: Config;

  constructor(config: Config, mcpClient: MCPClientService) {
    super(mcpClient);
    this.config = config;
    this.model = config.openaiModel;

    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
    });
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getModelName(): string {
    return this.model;
  }

  /**
   * Chat implementation for OpenAI Responses API using gpt-5-mini style
   * Follows the agentic loop by handling function_call outputs and executing MCP tools
   */
  async chat(messages: ChatMessage[], userMessage: string, salesforceAuth?: any, recordContext?: any): Promise<string> {
    try {
      const tools = await this.getToolsForOpenAI();

      let enhancedUserMessage = userMessage;
      if (recordContext) {
        const contextPrefix = this.formatRecordContext(recordContext);
        enhancedUserMessage = contextPrefix + userMessage;
        console.log(`📋 [OpenAI] Record context included for ${recordContext.objectApiName} (${recordContext.recordId})`);
      }

      const conversationInputs = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: enhancedUserMessage },
      ];

      console.log(`📝 [OpenAI] Sending ${conversationInputs.length} input items`);

      const payload: any = {
        model: this.model,
        instructions: this.getSystemPrompt(),
        input: conversationInputs,
        tools,
        temperature: 1,
        max_output_tokens: 500,
      };

      // Send initial request to Responses API
      let response = await this.client.post('/responses', payload);

      let iteration = 0;
      const maxIterations = 10;

      // Agentic loop: look for function_call outputs in response.data.output
      while (iteration < maxIterations) {
        iteration++;

        const outputs = response.data.output || [];
        // find function_call entries that are not null
        const functionCalls = outputs.filter((o: any) => o.type === 'function_call');

        if (!functionCalls || functionCalls.length === 0) {
          break; // no tool calls requested
        }

        console.log(`Iteration ${iteration}: OpenAI requested ${functionCalls.length} tool calls`);

        // Append tool call placeholders to conversation inputs and execute tools
        for (const fc of functionCalls) {
          const toolName = fc.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(fc.arguments || '{}');
          } catch (e) {
            toolArgs = {};
          }

          console.log(`Executing tool ${toolName} with args:`, toolArgs);
          const toolResult = await this.executeTool(toolName, toolArgs, salesforceAuth);

          // Append tool result as a tool-role input so the model can continue
          conversationInputs.push({
            role: 'tool',
            name: toolName,
            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
            call_id: fc.call_id || fc.id || undefined,
          } as any);
        }

        // Continue the conversation by calling the Responses API with updated inputs
        response = await this.client.post('/responses', {
          model: this.model,
          instructions: this.getSystemPrompt(),
          input: conversationInputs,
          tools,
          temperature: 1,
          max_output_tokens: 500,
        });
      }

      if (iteration >= maxIterations) {
        return 'I apologize, but I reached the maximum number of steps while processing your request. Please try simplifying your request or breaking it into smaller parts.';
      }

      // Extract final textual output. Look for message/text-like outputs first.
      const finalOutputs = response.data.output || [];
      // Prefer items that look like assistant text
      const textOutput = finalOutputs.find((o: any) => o.type === 'message' || o.type === 'text' || o.type === 'final');
      if (textOutput) {
        if (textOutput.content) return textOutput.content;
        if (textOutput.text) return textOutput.text;
      }

      // Fallback: if there's a top-level 'text' or 'reasoning' summary
      if (response.data.text && typeof response.data.text === 'string') {
        return response.data.text;
      }

      // As last resort, try serialized output
      try {
        return JSON.stringify(finalOutputs.slice(-1)[0]) || 'I processed your request but had no response to provide.';
      } catch (e) {
        return 'I processed your request but had no response to provide.';
      }
    } catch (error: any) {
      console.error('Error in OpenAI chat:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.');
      }

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }

      throw new Error(`OpenAI Responses API error: ${error.message}`);
    }
  }

  private async getToolsForOpenAI(): Promise<any[]> {
    const mcpTools = await this.mcpClient.listTools();

    // Map to expected format and include a 'type' === 'function' param per tool
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
