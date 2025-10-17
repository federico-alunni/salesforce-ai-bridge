export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp?: number;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface SalesforceUserInfo {
  userId: string;
  username: string;
  organizationId: string;
  email?: string;
  displayName?: string;
}

export interface SalesforceAuth {
  accessToken: string;
  instanceUrl: string;
  userInfo: SalesforceUserInfo;
  validatedAt: number;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  salesforceAuth?: SalesforceAuth;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  timestamp: number;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  isError: boolean;
}

export interface RateLimitInfo {
  userId: string;
  requests: number[];
  lastCleanup: number;
}
