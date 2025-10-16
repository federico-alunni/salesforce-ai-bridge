# System Architecture Diagrams

## Complete System Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Salesforce Org                                  │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                Lightning Web Component (LWC)                     │    │
│  │                        Chat Interface                            │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │ HTTP POST /api/chat                        │
│                             │ {"message": "List all accounts"}           │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      AI Bridge Server (Node.js)                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    Express REST API                              │    │
│  │              POST /api/chat, GET /health, etc.                   │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐    │
│  │                  AIServiceFactory                                │    │
│  │   Creates service based on AI_PROVIDER env variable              │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │                                            │
│         ┌───────────────────┴───────────────────┐                        │
│         │                                       │                        │
│  ┌──────▼──────────┐                   ┌────────▼────────┐               │
│  │ OpenRouterService│                  │AnthropicService │               │
│  │ (Free Dev)       │                  │ (Paid Prod)     │               │
│  └──────┬───────────┘                  └────────┬────────┘               │
│         │                                       │                        │
│         │        Both extend BaseAIService      │                        │
│         │        (common tool execution)        │                        │
│         └───────────────────┬───────────────────┘                        │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐    │
│  │                  MCPClientService                                │    │
│  │      Manages connection to MCP Salesforce Server                 │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │ MCP Protocol                               │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    MCP Salesforce Server                                 │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Tool: salesforce_query_records                                  │    │
│  │  Tool: salesforce_aggregate_query                                │    │
│  │  Tool: salesforce_dml_records                                    │    │
│  │  Tool: salesforce_describe_object                                │    │
│  │  Tool: salesforce_search_objects                                 │    │
│  │  Tool: salesforce_search_all                                     │    │
│  │  Tool: salesforce_read_apex                                      │    │
│  │  Tool: salesforce_write_apex                                     │    │
│  │  Tool: salesforce_execute_anonymous                              │    │
│  │  Tool: salesforce_manage_debug_logs                              │    │
│  │  Tool: salesforce_manage_field                                   │    │
│  │  Tool: salesforce_manage_object                                  │    │
│  │  Tool: ... and more (16+ tools total)                            │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │ Salesforce API                             │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Salesforce Org                                 │
│     Standard & Custom Objects, Apex, Metadata, etc.                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Provider Selection Flow

```
Application Startup
        │
        ▼
Load .env file
        │
        ▼
Read AI_PROVIDER variable
        │
        ├──> AI_PROVIDER=openrouter
        │            │
        │            ▼
        │    Validate OPENROUTER_API_KEY exists
        │            │
        │            ▼
        │    AIServiceFactory.createAIService()
        │            │
        │            ▼
        │    new OpenRouterService(config, mcpClient)
        │            │
        │            └──> Uses axios for HTTP requests
        │                 Model: tngtech/deepseek-r1t2-chimera:free
        │                 Tool format: OpenAI-style
        │
        └──> AI_PROVIDER=anthropic
                     │
                     ▼
             Validate ANTHROPIC_API_KEY exists
                     │
                     ▼
             AIServiceFactory.createAIService()
                     │
                     ▼
             new AnthropicService(config, mcpClient)
                     │
                     └──> Uses @anthropic-ai/sdk
                          Model: claude-3-5-sonnet-20241022
                          Tool format: Anthropic-style
```

## Request Flow (Agentic Loop)

```
User sends message via LWC
        │
        ▼
POST /api/chat
        │
        ▼
AIService.chat(sessionId, message)
        │
        ▼
Get conversation history from SessionManager
        │
        ▼
Get available MCP tools
        │
        ▼
Convert tools to provider format
        │
        ▼
┌───────────────────────────────────────┐
│      Agentic Loop (max 10 iterations) │
│                                       │
│  1. Send message + tools to AI        │
│           │                           │
│           ▼                           │
│  2. AI responds with:                 │
│     a) Final answer → DONE ✓          │
│     b) Tool call request → Continue   │
│           │                           │
│           ▼                           │
│  3. Execute tool via MCP              │
│     (e.g., query Salesforce)          │
│           │                           │
│           ▼                           │
│  4. Add tool result to conversation   │
│           │                           │
│           ▼                           │
│  5. Send back to AI with result       │
│           │                           │
│           └──> Loop back to step 2    │
│                                       │
└───────────────────────────────────────┘
        │
        ▼ (when AI provides final answer)
Save to SessionManager
        │
        ▼
Return response to LWC
```

## Class Hierarchy

```
┌─────────────────────────────────────────┐
│           IAIService Interface          │
│  + chat(sessionId, message): Promise    │
│  + getProviderName(): string            │
│  + getModelName(): string               │
└───────────────────┬─────────────────────┘
                    │
                    │ implements
                    │
┌───────────────────▼─────────────────────┐
│      BaseAIService (Abstract Class)     │
│  # config: Config                       │
│  # mcpClient: MCPClientService          │
│  # sessionManager: SessionManager       │
│                                         │
│  # getMCPTools(): Promise<Tool[]>       │
│  # executeTool(name, args): Promise     │
│  # getSystemPrompt(): string            │
│                                         │
│  Abstract methods:                      │
│  + chat(sessionId, message): Promise    │
│  + getProviderName(): string            │
│  + getModelName(): string               │
└──────────────┬──────────────┬───────────┘
               │              │
    ┌──────────┴────┐    ┌────┴──────────┐
    │               │    │               │
┌───▼──────────┐  ┌─▼────────────┐  ┌───▼──────────┐
│ OpenRouter   │  │ Anthropic    │  │ Future       │
│ Service      │  │ Service      │  │ Providers    │
│              │  │              │  │ (Google,     │
│ + chat()     │  │ + chat()     │  │  OpenAI...)  │
│ + getName()  │  │ + getName()  │  │              │
│ + getModel() │  │ + getModel() │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow: User Question → Salesforce Query → Response

```
User: "Show me all accounts created this month"
        │
        ▼
LWC Component
        │
        ▼ HTTP POST /api/chat
Bridge Server (Express)
        │
        ▼ AIService.chat()
OpenRouterService OR AnthropicService
        │
        ▼ Call AI Provider API
        │
        ├─> System Prompt: "You are a Salesforce assistant..."
        ├─> User Message: "Show me all accounts created this month"
        └─> Available Tools: [salesforce_query_records, ...]
        │
        ▼
AI Provider Response:
{
  "tool_call": {
    "name": "salesforce_query_records",
    "arguments": {
      "objectName": "Account",
      "fields": ["Id", "Name", "CreatedDate"],
      "whereClause": "CreatedDate = THIS_MONTH"
    }
  }
}
        │
        ▼
executeTool("salesforce_query_records", {...})
        │
        ▼
MCPClientService.callTool()
        │
        ▼ MCP Protocol
MCP Salesforce Server
        │
        ▼ Salesforce API
Salesforce Org
        │
        ▼ Returns Account records
        │
        ▼ Back up the chain
Tool Result: [
  {"Id": "001xx...", "Name": "Acme Corp", "CreatedDate": "2024-01-15"},
  {"Id": "001yy...", "Name": "Globex", "CreatedDate": "2024-01-20"}
]
        │
        ▼
Back to AI with tool result
        │
        ▼
AI Formats Response:
"I found 2 accounts created this month:
1. Acme Corp (Created: Jan 15, 2024)
2. Globex (Created: Jan 20, 2024)"
        │
        ▼
Save to SessionManager
        │
        ▼
Return to LWC Component
        │
        ▼
Display to User
```

## Session Management

```
┌────────────────────────────────────┐
│       SessionManager               │
│                                    │
│  sessions: Map<sessionId, Session> │
│                                    │
│  Session {                         │
│    id: string                      │
│    messages: ChatMessage[]         │
│    lastActivity: Date              │
│  }                                 │
│                                    │
│  ChatMessage {                     │
│    role: 'user' | 'assistant'      │
│    content: string                 │
│    timestamp: number               │
│  }                                 │
│                                    │
│  Auto-cleanup: 30 min timeout      │
└────────────────────────────────────┘

Timeline:
─────────────────────────────────────────────>
  │           │           │           │
  T0          T1          T2          T30+
  │           │           │           │
  Create   Add user   Add assist.   Expire
  session  message    message       & cleanup
```

## Configuration Flow

```
.env file
├── AI_PROVIDER=openrouter
├── OPENROUTER_API_KEY=sk-or-v1-...
├── OPENROUTER_MODEL=tngtech/deepseek-r1t2-chimera:free
├── ANTHROPIC_API_KEY=sk-ant-...  (optional if not using)
└── ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

        ↓

src/config/config.ts
├── Parse environment variables
├── Validate based on selected provider
├── Return Config object
└── Throw error if required keys missing

        ↓

src/index.ts
├── Load config
├── Create MCPClientService
├── Create AIService via Factory
│   ├── Factory reads config.aiProvider
│   └── Returns appropriate service instance
└── Start Express server

        ↓

Health endpoint response:
{
  "status": "ok",
  "mcpConnected": true,
  "aiProvider": "openrouter",
  "aiModel": "tngtech/deepseek-r1t2-chimera:free"
}
```

## File Structure

```
salesforce-ai-bridge/
├── src/
│   ├── config/
│   │   └── config.ts                    (Multi-provider config)
│   ├── services/
│   │   ├── base/
│   │   │   └── AIServiceBase.ts        (Interface + Abstract class)
│   │   ├── anthropicService.ts         (Claude implementation)
│   │   ├── openRouterService.ts        (OpenRouter implementation)
│   │   ├── AIServiceFactory.ts         (Factory pattern)
│   │   ├── mcpClient.ts                (MCP connection)
│   │   └── sessionManager.ts           (Session handling)
│   ├── routes/
│   │   └── chat.ts                     (REST endpoints)
│   ├── types/
│   │   └── index.ts                    (TypeScript types)
│   └── index.ts                        (Express server)
├── .env.example                        (Template with both providers)
├── package.json                        (Dependencies for both)
├── tsconfig.json                       (TypeScript config)
├── README.md                           (Main documentation)
├── QUICKSTART.md                       (Setup guide)
├── MULTI_PROVIDER_ARCHITECTURE.md      (This guide)
└── MULTI_PROVIDER_COMPLETE.md          (Summary)
```

## Extending with New Providers

```
Want to add a new provider? Follow this flow:

1. Create Service Class
   src/services/newProviderService.ts
   ├── extends BaseAIService
   ├── implements IAIService
   └── Provider-specific API calls

2. Update Types
   src/config/config.ts
   └── Add 'new-provider' to AIProvider type

3. Update Factory
   src/services/AIServiceFactory.ts
   └── Add case for 'new-provider'

4. Update Config
   src/config/config.ts
   ├── Add newProviderApiKey? field
   ├── Add newProviderModel? field
   └── Add validation logic

5. Update Environment
   .env.example
   ├── Add NEW_PROVIDER_API_KEY
   └── Add NEW_PROVIDER_MODEL

6. Add Documentation
   NEW_PROVIDER_SETUP.md
   └── Setup instructions

7. Test
   ├── Set AI_PROVIDER=new-provider
   ├── Restart server
   └── Test /health and /api/chat endpoints

Done! ✓
```
