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
        // Perplexity expects the functions under the `function` key and
        // the auto-invoke flag named `function_call` (not `tools`/`tool_choice`).
        function: tools,
        // ask Perplexity to automatically decide when to call functions
        function_call: 'auto',
        temperature: 0.7,
      };

      // Log a redacted preview of the payload (no API keys)
      try {
        const preview = {
          model: payload.model,
          messages: payload.messages.slice(-3), // last few messages
          functions: payload.function ? payload.function.map((t: any) => ({ name: t.function?.name || t.name || '<unknown>', description: t.function?.description || t.description || '' })) : [],
        };
        console.log('[Perplexity] Request payload preview:', JSON.stringify(preview));
      } catch (e) {
        // ignore logging errors
      }

      let response = await this.client.post('/chat/completions', payload);


      let iteration = 0;
      const maxIterations = 10;

      // Simple agentic loop: if Perplexity returns tool_calls, execute them
      // Perplexity may indicate tool calls via finish_reason or by returning
      // structured tool_calls in different fields. Be tolerant and look in
      // several places.
      while (iteration < maxIterations) {
        iteration++;
  const message = response.data?.choices?.[0]?.message || response.data?.message || response.data?.choices?.[0];

  // Try to find structured tool_calls first
  let toolCalls = message?.tool_calls || message?.toolCalls || [];

  // If none found, attempt to parse a JSON block that represents a tool call
  if ((!toolCalls || toolCalls.length === 0) && typeof message?.content === 'string') {
    // look for a JSON object that contains name and arguments
    const jsonMatch = message.content.match(/\{\s*"name"\s*:\s*"[^"]+"[\s\S]*\}/m);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // support single call or an array
        if (Array.isArray(parsed)) toolCalls = parsed;
        else toolCalls = [parsed];
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  if (!toolCalls || toolCalls.length === 0) break;

        console.log(`[Perplexity] Iteration ${iteration}: processing ${toolCalls.length} tool calls`);

        // Append assistant message to conversation
        conversation.push({ role: 'assistant', content: message.content || '' });

        for (const call of toolCalls) {
          const toolName = call.name || call.function?.name;
          let toolArgs = {};
          try {
            if (typeof call.arguments === 'string') {
              toolArgs = call.arguments ? JSON.parse(call.arguments) : {};
            } else if (call.arguments && typeof call.arguments === 'object') {
              toolArgs = call.arguments;
            } else if (call.function && call.function.arguments) {
              toolArgs = call.function.arguments;
            }
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
          function: tools,
          function_call: 'auto',
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
    // Also include top-level `name` and `description` which some API variants
    // expect to be present alongside the `function` object.
    return mcpTools.map((tool: any) => ({
      name: tool.name,
      description: tool.description || '',
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
