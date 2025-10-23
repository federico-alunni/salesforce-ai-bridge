import axios, { AxiosInstance } from 'axios';
import { Config } from '../config/config.js';
import { MCPClientService } from './mcpClient.js';
import { ChatMessage } from '../types/index.js';
import { BaseAIService } from './base/AIServiceBase.js';

/**
 * Minimal Perplexity integration.
 * This implementation uses Perplexity's HTTP API to send a conversation and
 * handle simple tool calling behavior by mapping MCP tools into a function-like
 * schema. The Perplexity API surface can vary; this implementation aims to be
 * consistent with the project's agentic loop used for OpenRouter.
 */
export class PerplexityService extends BaseAIService {
  private client: AxiosInstance;
  private model: string;

  constructor(config: Config, mcpClient: MCPClientService) {
    super(mcpClient);
    this.model = config.perplexityModel;

    this.client = axios.create({
      baseURL: config.perplexityApiBaseUrl || 'https://api.perplexity.ai',
      headers: {
        'Authorization': `Bearer ${config.perplexityApiKey}`,
        // Some Perplexity endpoints accept x-api-key as an alternative
        'x-api-key': config.perplexityApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
  }

  getProviderName(): string {
    return 'Perplexity';
  }

  getModelName(): string {
    return this.model;
  }

  async chat(messages: ChatMessage[], userMessage: string, salesforceAuth?: any, recordContext?: any): Promise<string> {
    try {
      const tools = await this.getToolsForPerplexity();

      let enhancedUserMessage = userMessage;
      if (recordContext) {
        enhancedUserMessage = this.formatRecordContext(recordContext) + userMessage;
        console.log(`📋 [Perplexity] Record context included for ${recordContext.objectApiName} (${recordContext.recordId})`);
      }

      const conversation = [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: enhancedUserMessage },
      ];

      console.log(`[Perplexity] Sending message (len=${enhancedUserMessage.length}) with ${tools.length} tools available`);

      // Use Perplexity's documented server endpoint and messages format
      const payload = {
        model: this.model,
        messages: conversation.map((m: any) => ({ role: m.role, content: m.content })),
        // include tools (Perplexity expects a function-like schema)
        tools,
        // ask Perplexity to automatically decide when to call tools
        tool_choice: 'auto',
        temperature: 0.7,
      };

      // Log a redacted preview of the payload (no API keys)
      try {
        const preview = {
          model: payload.model,
          messages: payload.messages.slice(-3), // last few messages
          tools: payload.tools ? payload.tools.map((t: any) => ({ name: t.function?.name || t.name || '<unknown>', description: t.function?.description || t.description || '' })) : [],
        };
        console.log('[Perplexity] Request payload preview:', JSON.stringify(preview));
      } catch (e) {
        // ignore logging errors
      }

      let response = await this.client.post('/chat/completions', payload);

      let iteration = 0;
      const maxIterations = 10;

      // Simple agentic loop: if Perplexity returns tool_calls, execute them
      while (response.data?.finish_reason === 'tool_calls' && iteration < maxIterations) {
        iteration++;
  const message = response.data.choices?.[0]?.message || response.data.message;
  const toolCalls = message?.tool_calls || [];

        if (!toolCalls || toolCalls.length === 0) break;

        console.log(`[Perplexity] Iteration ${iteration}: processing ${toolCalls.length} tool calls`);

        // Append assistant message to conversation
        conversation.push({ role: 'assistant', content: message.content || '' });

        for (const call of toolCalls) {
          const toolName = call.name;
          let toolArgs = {};
          try {
            toolArgs = call.arguments ? JSON.parse(call.arguments) : {};
          } catch (e) {
            toolArgs = {};
          }

          const toolResult = await this.executeTool(toolName, toolArgs, salesforceAuth);

          conversation.push({ role: 'tool', content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) } as any);
        }

        // Continue using the completions endpoint so Perplexity can continue tool-driven turns
        const followUpPayload = {
          model: this.model,
          messages: conversation.map((m: any) => ({ role: m.role, content: m.content })),
          tools,
          tool_choice: 'auto',
          temperature: 0.7,
        };

        response = await this.client.post('/chat/completions', followUpPayload);
      }

      if (iteration >= maxIterations) {
        return 'I apologize, but I reached the maximum number of steps while processing your request. Please try simplifying your request.';
      }

  // Perplexity returns assistant content at choices[0].message.content
  const finalText = response.data?.choices?.[0]?.message?.content || response.data?.choices?.[0]?.content || response.data?.message?.content || response.data?.text;
  return finalText || 'I processed your request but had no response to provide.';
    } catch (error: any) {
      console.error('[Perplexity] Error:', error.response?.data || error.message);

      const status = error.response?.status;
      if (status === 401) {
        throw new Error('Invalid Perplexity API key (401). Please check your PERPLEXITY_API_KEY environment variable.');
      }

      if (status === 403) {
        // 403 can mean the key is not authorized for the endpoint or plan restrictions
        const body = error.response?.data;
        let details = '';
        try { details = JSON.stringify(body); } catch(e) { details = String(body); }
        throw new Error(`Perplexity API access denied (403). Response: ${details}`);
      }

      if (status === 429) {
        throw new Error('Rate limit exceeded (429). Please try again in a moment.');
      }

      throw new Error(`Perplexity API error: ${error.message}`);
    }
  }

  private async getToolsForPerplexity(): Promise<any[]> {
    const mcpTools = await this.mcpClient.listTools();

    // Map tools into the function schema Perplexity expects:
    // { type: 'function', function: { name, description, parameters } }
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
