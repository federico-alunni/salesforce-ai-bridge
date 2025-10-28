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
          // Keep user message unchanged; record context will be placed into
          // the `instructions` (system prompt) so the model sees it as context
          // rather than part of the user's message.
          let enhancedUserMessage = userMessage;
          let recordContextText = '';
          if (recordContext) {
            recordContextText = this.formatRecordContext(recordContext);
            console.log(`📋 [OpenAI] Record context prepared for ${recordContext.objectApiName} (${recordContext.recordId})`);
        { role: 'user', content: enhancedUserMessage },
      ];

      console.log(`📝 [OpenAI] Sending ${conversationInputs.length} input items`);
      console.log('📤 [OpenAI] Message being sent to Responses API:', {
        userMessage: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
        enhancedMessage: enhancedUserMessage.substring(0, 200) + (enhancedUserMessage.length > 200 ? '...' : ''),
        hasRecordContext: !!recordContext,
        messageLength: enhancedUserMessage.length,
      });

        // Build instructions. If Salesforce auth/context is provided, append a
        // small USER CONTEXT section (do NOT include access tokens).
        let instructions = this.getSystemPrompt();
        if (salesforceAuth) {
          try {
            const userInfo = salesforceAuth.userInfo || {};
            const instanceUrl = salesforceAuth.instanceUrl || '';
            const userId = userInfo.userId || userInfo.user || '';
            const userEmail = userInfo.email || '';
            const userName = userInfo.displayName || userInfo.username || '';

            instructions += `\n\n=== USER CONTEXT  ===\n` +
              `Salesforce Instance URL: ${instanceUrl}\n` +
              `Salesforce User Id: ${userId}\n` +
              `Salesforce User Email: ${userEmail}\n` +
              `Salesforce User Name: ${userName}\n` +
              `=== END USER CONTEXT ===\n`;
          } catch (e) {
            // ignore errors when reading auth info
          }
        }

        const payload: any = {
          model: this.model,
          instructions,
          input: conversationInputs,
          // If we have Salesforce record context, include it in the instructions
          if (recordContextText) {
            instructions += `\n\n=== RECORD CONTEXT ===\n${recordContextText}=== END RECORD CONTEXT ===\n`;
          }
          tools: tools,
          temperature: 1,
          max_output_tokens: 8096,
        };

      // Log a redacted preview of the payload (avoid logging secrets) but log everything else.
      console.log(`[OpenAI] Initial request payload preview:`, JSON.stringify(payload));

      // Send initial request to Responses API
      let response = await this.client.post('/responses', payload);

      console.log(`[OpenAI] Initial response:`, {
        model: response.data.model,
        status: response.data.status,
        outputs: response.data.output,
        parallel_tool_calls: response.data.parallel_tool_calls,
      });

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

        console.log(`[OpenAI] Iteration ${iteration}: OpenAI requested ${functionCalls.length} tool calls`);

        // Append tool call placeholders to conversation inputs and execute tools
        for (const fc of functionCalls) {
          const toolName = fc.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(fc.arguments || '{}');
          } catch (e) {
            toolArgs = {};
          }

          console.log(`[AI Bridge] Executing tool ${toolName} with args:`, toolArgs);
          const toolResult = await this.executeTool(toolName, toolArgs, salesforceAuth);

          // Append tool result as an assistant message. The Responses API input
          // does not support a 'tool' role; instead include the tool output as
          // an assistant-style message with a clear prefix so the model can
          // correlate results with the original function call.
          const callId = fc.call_id || fc.id || '';
          const toolContent = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
          // Use the Responses API documented shape for tool outputs
          // See: { type: 'function_call_output', call_id: '<id>', output: '<string>' }
          conversationInputs.push({
            type: 'function_call_output',
            call_id: callId,
            output: toolContent,
          } as any);
        }

        // Continue the conversation by calling the Responses API with updated inputs
        try {
            // For continuation, also include the same USER CONTEXT when available
            let continueInstructions = this.getSystemPrompt();
            if (salesforceAuth) {
              try {
                const userInfo = salesforceAuth.userInfo || {};
                const instanceUrl = salesforceAuth.instanceUrl || '';
                const userId = userInfo.userId || userInfo.user || '';
                const userEmail = userInfo.email || '';
                const userName = userInfo.displayName || userInfo.username || '';

                continueInstructions += `\n\n=== USER CONTEXT (Salesforce headers) ===\n` +
                  `X-Salesforce-Instance-URL: ${instanceUrl}\n` +
                  `X-Salesforce-User-Id: ${userId}\n` +
                  `X-Salesforce-User-Email: ${userEmail}\n` +
                  `X-Salesforce-User-Name: ${userName}\n` +
                  `=== END USER CONTEXT ===\n`;
              } catch (e) {
                // ignore
              }
            }

            const continuePayload = {
              model: this.model,
              instructions: continueInstructions,
              input: conversationInputs,
              tools,
              temperature: 1,
              max_output_tokens: 8096,
            };

          // Log a small preview of the continue payload
          try {
            const preview = {
              model: continuePayload.model,
              input: continuePayload.input.slice(-3),
            };
            console.log(`[OpenAI] Iteration ${iteration} Continue payload preview:`, JSON.stringify(preview));
          } catch (e) {
            // ignore logging errors
          }

          response = await this.client.post('/responses', continuePayload);

          console.log(`[OpenAI] Iteration ${iteration} response:`, {
            status: response.data.status,
            outputs: response.data.output,
            parallel_tool_calls: response.data.parallel_tool_calls,
          });
        } catch (err) {
          console.error(`[OpenAI] Error while continuing conversation at iteration ${iteration}:`, err);
          throw err;
        }
      }

      if (iteration >= maxIterations) {
        return 'I apologize, but I reached the maximum number of steps while processing your request. Please try simplifying your request or breaking it into smaller parts.';
      }

      // Extract final textual output. The Responses API can place text in several
      // different shapes (message objects with nested content arrays, top-level
      // `text`, or reasoning/summary fields). Try multiple strategies and fall
      // back to a helpful aggregation of tool results if nothing else is found.
      const finalOutputs = response.data.output || [];

      // Helper to extract text from an output item
      const extractFromOutputItem = (item: any): string | null => {
        if (!item) return null;

        // Common simple shapes
        if (typeof item === 'string') return item;
        if (item.text && typeof item.text === 'string') return item.text;
        if (item.content && typeof item.content === 'string') return item.content;

        // If content is an array, look for text-like parts
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (!part) continue;
            if (typeof part === 'string') return part;
            if (part.text && typeof part.text === 'string') return part.text;
            if (part.content && typeof part.content === 'string') return part.content;
            // Some parts may be nested objects (e.g., {type: 'text', text: '...'})
            if (part.type === 'text' && part.text) return part.text;
          }
        }

        // Some responses include a 'summary' array (reasoning) with text elements
        if (Array.isArray(item.summary)) {
          const texts: string[] = [];
          for (const s of item.summary) {
            if (s && typeof s === 'string') texts.push(s);
            else if (s && s.text) texts.push(s.text);
          }
          if (texts.length) return texts.join('\n');
        }

        return null;
      };

      // Try to find a direct message/text/final item with content
      for (const outItem of finalOutputs) {
        const txt = extractFromOutputItem(outItem);
        if (txt) {
          console.log('[OpenAI] Extracted final text from output item:', txt.substring(0, 300));
          return txt;
        }
      }

      // If there's a top-level text field, use it
      if (response.data.text && typeof response.data.text === 'string') {
        console.log('[OpenAI] Extracted top-level text from response.data.text');
        return response.data.text;
      }

      // If no text found, but there are tool results appended to conversationInputs,
      // summarize the most recent tool outputs (these were added as role: 'tool')
      try {
        const recentToolResults = conversationInputs
          .filter((i: any) => i.type === 'function_call_output')
          .slice(-3)
          .map((t: any) => (typeof t.output === 'string' ? t.output : JSON.stringify(t.output)));

        if (recentToolResults.length > 0) {
          const aggregated = `Tool results:\n${recentToolResults.join('\n---\n')}`;
          console.log(`[OpenAI] No direct text in response; returning aggregated tool results`);
          return aggregated;
        }
      } catch (e) {
        // ignore
      }

      // As last resort, return a serialized form of the outputs for debugging
      console.warn('[OpenAI] No textual output found in response; returning serialized outputs for debugging');
      try {
        return JSON.stringify(finalOutputs) || 'I processed your request but had no response to provide.';
      } catch (e) {
        return 'I processed your request but had no response to provide.';
      }
    } catch (error: any) {
      console.error('[OpenAI] Error in OpenAI chat:', error.response?.data || error.message);

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
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: [],
      },
    }));
  }
}
