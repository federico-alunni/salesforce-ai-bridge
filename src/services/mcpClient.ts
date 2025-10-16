import axios, { AxiosInstance } from 'axios';
import { Config } from '../config/config.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface MCPToolResponse {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  isError?: boolean;
}

export class MCPClientService {
  private httpClient: AxiosInstance;
  private connected: boolean = false;
  private toolsCache: MCPTool[] | null = null;

  private sessionId: string;

  constructor(private config: Config) {
    // Generate a unique session ID for this client
    this.sessionId = `bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.httpClient = axios.create({
      baseURL: this.config.mcpServerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        // MCP SSE servers require both content types
        'Accept': 'application/json, text/event-stream',
      },
    });
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to MCP Salesforce Server at ${this.config.mcpServerUrl}...`);
      console.log('Note: Assuming MCP server implements the expected tool interface');
      
      // For now, mark as connected and fetch tools lazily
      // The actual MCP server might use SSE or a different protocol
      this.connected = true;
      
      // Try to fetch tools to validate connection
      try {
        await this.fetchTools();
        console.log(`✓ Connected to MCP Salesforce Server (${this.toolsCache?.length || 0} tools available)`);
      } catch (toolError) {
        console.warn('Could not fetch tools list, but marking as connected');
        console.warn('Tools will be fetched on first use');
        // Still mark as connected - tools might be available via different endpoint
      }
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  private parseSSEResponse(data: string): any {
    // Parse SSE format: "event: message\ndata: {...}\n\n"
    if (typeof data === 'string' && data.includes('data:')) {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.substring(5).trim();
          try {
            return JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse SSE data:', jsonStr);
          }
        }
      }
    }
    return data;
  }

  private async fetchTools(): Promise<void> {
    try {
      // First, initialize the session
      console.log(`Initializing MCP session: ${this.sessionId}`);
      const initResponse = await this.httpClient.post(`?sessionId=${this.sessionId}`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'salesforce-ai-bridge',
            version: '1.0.0',
          },
        },
      });

      // Parse SSE response if needed
      const initData = this.parseSSEResponse(initResponse.data);
      console.log('Session initialized');

      // Now list the tools
      console.log('Fetching tools list...');
      const toolsResponse = await this.httpClient.post(`?sessionId=${this.sessionId}`, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      // Parse SSE response
      const toolsData = this.parseSSEResponse(toolsResponse.data);
      
      if (toolsData && toolsData.result && toolsData.result.tools) {
        this.toolsCache = toolsData.result.tools;
        console.log(`✓ Successfully fetched ${this.toolsCache?.length || 0} tools`);
      } else {
        throw new Error('Invalid tools response format');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('MCP Server Error:', error.response?.data);
      }
      throw error;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error('MCP client not connected');
    }

    try {
      // Return cached tools if available
      if (this.toolsCache && this.toolsCache.length > 0) {
        return this.toolsCache as MCPTool[];
      }

      // Fetch tools from server
      const response = await this.httpClient.post('/', {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {},
      });

      if (response.data && response.data.result && response.data.result.tools) {
        this.toolsCache = response.data.result.tools;
        return this.toolsCache as MCPTool[];
      }

      throw new Error('Invalid response from MCP server');
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResponse> {
    if (!this.connected) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`Calling MCP tool: ${name}`, JSON.stringify(args, null, 2));
      
      const response = await this.httpClient.post(`?sessionId=${this.sessionId}`, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      });

      // Parse SSE response
      const data = this.parseSSEResponse(response.data);

      if (data && data.result) {
        return data.result;
      }

      if (data && data.error) {
        throw new Error(`MCP tool error: ${data.error.message}`);
      }

      throw new Error('Invalid response from MCP server');
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.connected = false;
      this.toolsCache = null;
      console.log('Disconnected from MCP Salesforce Server');
    } catch (error) {
      console.error('Error disconnecting from MCP server:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
