import { ChatMessage, SalesforceAuth, RecordContext } from '../../types';
import { MCPClientService } from '../mcpClient';

/**
 * Base interface for all AI service providers
 * Implement this interface to add support for new AI providers
 */
export interface IAIService {
  /**
   * Send a chat message and get AI response with tool execution
   * @param messages - Conversation history
   * @param userMessage - Current user message
   * @param salesforceAuth - Optional Salesforce authentication context
   * @param recordContext - Optional Salesforce record context
   * @returns AI response text
   */
  chat(
    messages: ChatMessage[], 
    userMessage: string, 
    salesforceAuth?: SalesforceAuth,
    recordContext?: RecordContext
  ): Promise<string>;

  /**
   * Get the name of the AI provider
   */
  getProviderName(): string;

  /**
   * Get the current model being used
   */
  getModelName(): string;
}

/**
 * Abstract base class for AI services
 * Provides common functionality for all AI providers
 */
export abstract class BaseAIService implements IAIService {
  protected mcpClient: MCPClientService;

  constructor(mcpClient: MCPClientService) {
    this.mcpClient = mcpClient;
  }

  abstract chat(
    messages: ChatMessage[], 
    userMessage: string, 
    salesforceAuth?: SalesforceAuth,
    recordContext?: RecordContext
  ): Promise<string>;
  abstract getProviderName(): string;
  abstract getModelName(): string;

  /**
   * Get tools from MCP server in a common format
   * Child classes can override this to customize tool format
   */
  protected async getMCPTools(): Promise<any[]> {
    return await this.mcpClient.listTools();
  }

  /**
   * Execute a tool via MCP client
   */
  protected async executeTool(
    name: string,
    args: Record<string, unknown>,
    salesforceAuth?: SalesforceAuth
  ): Promise<any> {
    try {
      const result = await this.mcpClient.callTool(name, args, salesforceAuth);
      
      // Extract the content from MCP response
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent) {
          return textContent.text;
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get system prompt for Salesforce assistant
   * Can be overridden by child classes for provider-specific prompts
   */
  protected getSystemPrompt(): string {
    return `You are an AI assistant integrated with Salesforce through the Model Context Protocol (MCP). You have access to various Salesforce tools that allow you to interact with Salesforce data and metadata.

Important:
- You are explicitly authorized to call available MCP tools to access the user's Salesforce org when necessary to fulfill the user's request.
- It's very likely that the user will ask about Salesforce data or operations. So if you are uncertain of which system the user is referring to, you should not ask, just consider it to be Salesforce.

When using tools:
- Only call the minimum set of tools and request the minimum fields required to complete the task.
- If an action will modify data (create/update/delete), ask the user for explicit confirmation before proceeding.
- Include the raw tool result only if directly specified from the user.
- Do not attempt to access or return any credentials or secrets.

Your capabilities include:
- Searching for Salesforce objects and describing their schemas
- Querying records with support for relationships (SOQL)
- Performing aggregate queries (COUNT, SUM, AVG, MIN, MAX with GROUP BY)
- Creating, updating, and deleting records (DML operations)
- Managing custom objects and fields
- Configuring field-level security
- Searching across multiple objects (SOSL)
- Reading and writing Apex classes and triggers
- Executing anonymous Apex code
- Managing debug logs

When a user asks about Salesforce data or operations:
1. Carefully analyze what the user is asking for
2. Determine which tool(s) are needed to fulfill the request
3. Call the appropriate tools with correct parameters
4. Interpret the results from the tools
5. Present the information in a clear, user-friendly format
6. If you need more information to complete a request, ask the user

Guidelines:
- You are likely to be interacting with a Business User or Salesforce Admin so avoid exposing technical details if not specified.
- Always be helpful, accurate, and concise
- Format your responses for readability in a chat interface
- Use proper Salesforce terminology
- If an operation fails, explain why and suggest alternatives
- For queries, present data in a structured format (lists, tables, etc.)
- When creating or modifying records, confirm the action taken

Remember: You're helping users interact with their Salesforce org, so be precise and careful with data operations.`;
  }

  /**
   * Format Salesforce record context into LLM-friendly text
   * @param recordContext - The record context to format
   * @returns Formatted string to prepend to the user message
   */
  protected formatRecordContext(recordContext: RecordContext): string {
    const { record, objectApiName, recordId } = recordContext;
    
    let contextText = `\n\n=== SALESFORCE RECORD CONTEXT ===\n`;
    contextText += `Object Type: ${objectApiName}\n`;
    contextText += `Record ID: ${recordId}\n`;
    contextText += `\nRecord Fields:\n`;
    
    // Format the record fields in a readable way
    for (const [fieldName, fieldValue] of Object.entries(record)) {
      // Skip null/undefined values
      if (fieldValue === null || fieldValue === undefined) {
        continue;
      }
      
      // Handle different field types
      if (typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
        // Related record or complex object
        contextText += `  ${fieldName}: ${JSON.stringify(fieldValue)}\n`;
      } else {
        contextText += `  ${fieldName}: ${fieldValue}\n`;
      }
    }
    
    contextText += `=== END RECORD CONTEXT ===\n\n`;
    contextText += `The user's question relates to the above ${objectApiName} record. `;
    contextText += `Use this context when answering their question.\n\n`;
    
    return contextText;
  }
}
