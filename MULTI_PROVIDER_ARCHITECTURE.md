# Multi-Provider Architecture

This document explains how the Salesforce AI Bridge supports multiple AI providers and how to extend it with new providers.

## Overview

The bridge uses a **Factory Pattern** with **Interface-Based Design** to support multiple AI providers while maintaining a consistent API. Currently supported:

- **OpenRouter**: Free and paid models via unified API
- **Anthropic Claude**: Production-grade AI with advanced reasoning

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AIServiceFactory                     │
│  Creates AI service instance based on configuration     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├── config.aiProvider === 'openrouter'
                 │   └─> new OpenRouterService(config, mcpClient)
                 │
                 └── config.aiProvider === 'anthropic'
                     └─> new AnthropicService(config, mcpClient)

                 ↓
┌─────────────────────────────────────────────────────────┐
│                    IAIService Interface                 │
│  - chat(sessionId, message): Promise<string>            │
│  - getProviderName(): string                            │
│  - getModelName(): string                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ implements
                 ↓
┌─────────────────────────────────────────────────────────┐
│              BaseAIService (Abstract Class)             │
│  Shared functionality:                                  │
│  - getMCPTools(): Get available Salesforce tools        │
│  - executeTool(): Execute MCP tool calls                │
│  - getSystemPrompt(): Common system instructions        │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ↓                 ↓
┌──────────────┐   ┌──────────────┐
│ Anthropic    │   │ OpenRouter   │
│ Service      │   │ Service      │
└──────────────┘   └──────────────┘
```

## Key Components

### 1. IAIService Interface (`src/types/index.ts`)

Defines the contract all AI services must implement:

```typescript
export interface IAIService {
  chat(sessionId: string, message: string): Promise<string>;
  getProviderName(): string;
  getModelName(): string;
}
```

### 2. BaseAIService Abstract Class (`src/services/base/AIServiceBase.ts`)

Provides shared functionality:

```typescript
export abstract class BaseAIService implements IAIService {
  protected config: Config;
  protected mcpClient: MCPClientService;

  // Shared methods
  protected async getMCPTools(): Promise<Tool[]>;
  protected async executeTool(
    toolName: string,
    args: unknown
  ): Promise<unknown>;
  protected getSystemPrompt(): string;

  // Must be implemented by subclasses
  abstract chat(sessionId: string, message: string): Promise<string>;
  abstract getProviderName(): string;
  abstract getModelName(): string;
}
```

**Benefits:**

- Eliminates code duplication
- Ensures consistent tool execution across providers
- Centralizes system prompt management
- Simplifies testing and maintenance

### 3. AIServiceFactory (`src/services/AIServiceFactory.ts`)

Creates the appropriate AI service based on configuration:

```typescript
export class AIServiceFactory {
  static createAIService(
    config: Config,
    mcpClient: MCPClientService
  ): IAIService {
    switch (config.aiProvider) {
      case "openrouter":
        return new OpenRouterService(config, mcpClient);
      case "anthropic":
        return new AnthropicService(config, mcpClient);
      default:
        throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
    }
  }
}
```

### 4. Configuration System (`src/config/config.ts`)

Supports provider-specific configuration:

```typescript
export type AIProvider = "openrouter" | "anthropic";

export interface Config {
  aiProvider: AIProvider;

  // OpenRouter config
  openRouterApiKey?: string;
  openRouterModel?: string;

  // Anthropic config
  anthropicApiKey?: string;
  anthropicModel?: string;

  // Validates required keys based on selected provider
}
```

## How It Works

### Startup Flow

1. **Load Configuration**: `config.ts` reads `AI_PROVIDER` from environment
2. **Validate API Keys**: Ensures the selected provider's API key is present
3. **Create Service**: Factory creates the appropriate AI service instance
4. **Initialize Server**: Express routes receive the `IAIService` interface
5. **Ready**: Server can handle requests using any configured provider

### Request Flow

1. **LWC sends message** → POST `/api/chat`
2. **Express route** receives request
3. **Calls** `aiService.chat(sessionId, message)`
4. **AI Service**:
   - Gets available MCP tools (`getMCPTools()`)
   - Sends message to AI provider with tool definitions
   - If AI wants to use tools, calls `executeTool()`
   - Continues agentic loop until done (max 10 iterations)
   - Returns final response
5. **Response sent** back to LWC

**Key Point**: The route doesn't know or care which provider is being used - it just calls the interface methods.

## Adding a New AI Provider

Want to add support for another AI provider? Here's how:

### Step 1: Update Type Definition

In `src/config/config.ts`:

```typescript
export type AIProvider = "openrouter" | "anthropic" | "your-provider";

export interface Config {
  aiProvider: AIProvider;
  // ... existing config

  // Add your provider's config
  yourProviderApiKey?: string;
  yourProviderModel?: string;
}
```

### Step 2: Update Configuration Validation

In `src/config/config.ts`, add validation:

```typescript
export function loadConfig(): Config {
  // ... existing code

  // Validate API key for your provider
  if (config.aiProvider === "your-provider") {
    if (!config.yourProviderApiKey) {
      throw new Error(
        "YOUR_PROVIDER_API_KEY is required when using your-provider"
      );
    }
  }

  return config;
}
```

### Step 3: Create Service Implementation

Create `src/services/yourProviderService.ts`:

```typescript
import { BaseAIService, IAIService } from "./base/AIServiceBase";
import { Config } from "../config/config";
import { MCPClientService } from "./mcpClient";

export class YourProviderService extends BaseAIService implements IAIService {
  private apiKey: string;
  private model: string;

  constructor(config: Config, mcpClient: MCPClientService) {
    super(config, mcpClient);

    if (!config.yourProviderApiKey) {
      throw new Error("YOUR_PROVIDER_API_KEY is required");
    }

    this.apiKey = config.yourProviderApiKey;
    this.model = config.yourProviderModel || "default-model";
  }

  async chat(sessionId: string, message: string): Promise<string> {
    // 1. Get conversation history from session manager
    const history = this.sessionManager.getHistory(sessionId);

    // 2. Get available MCP tools
    const mcpTools = await this.getMCPTools();

    // 3. Convert to your provider's format
    const providerTools = this.convertToolsToYourFormat(mcpTools);

    // 4. Build messages array
    const messages = [...history, { role: "user", content: message }];

    // 5. Implement agentic loop
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      // Call your provider's API
      const response = await this.callYourProviderAPI(messages, providerTools);

      // Check if AI wants to use tools
      if (response.needsToolCall) {
        // Execute the tool
        const result = await this.executeTool(
          response.toolName,
          response.toolArgs
        );

        // Add tool result to conversation
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
        });

        iterations++;
        continue;
      }

      // No more tool calls - return final response
      this.sessionManager.addMessage(sessionId, "user", message);
      this.sessionManager.addMessage(sessionId, "assistant", response.content);

      return response.content;
    }

    throw new Error("Max iterations reached");
  }

  getProviderName(): string {
    return "your-provider";
  }

  getModelName(): string {
    return this.model;
  }

  // Helper method to convert MCP tools to your provider's format
  private convertToolsToYourFormat(mcpTools: Tool[]): YourProviderTool[] {
    // Convert from MCP format to your provider's tool format
    // This varies by provider (OpenAI format, Anthropic format, etc.)
  }

  private async callYourProviderAPI(messages, tools): Promise<YourResponse> {
    // Implementation specific to your provider's API
  }
}
```

### Step 4: Update Factory

In `src/services/AIServiceFactory.ts`:

```typescript
import { YourProviderService } from "./yourProviderService";

export class AIServiceFactory {
  static createAIService(
    config: Config,
    mcpClient: MCPClientService
  ): IAIService {
    switch (config.aiProvider) {
      case "openrouter":
        return new OpenRouterService(config, mcpClient);
      case "anthropic":
        return new AnthropicService(config, mcpClient);
      case "your-provider":
        return new YourProviderService(config, mcpClient);
      default:
        throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
    }
  }
}
```

### Step 5: Update Environment Example

In `.env.example`:

```env
# AI Provider Selection
AI_PROVIDER=openrouter  # Options: openrouter, anthropic, your-provider

# Your Provider Configuration
YOUR_PROVIDER_API_KEY=your-key-here
YOUR_PROVIDER_MODEL=your-default-model
```

### Step 6: Add Documentation

Create `YOUR_PROVIDER_SETUP.md` with:

- How to get an API key
- Available models
- Pricing information
- Example configuration
- Testing instructions

## Design Principles

### 1. Interface Segregation

Each provider implements only what's needed via `IAIService`. No provider-specific methods leak into the interface.

### 2. Open/Closed Principle

The system is **open for extension** (add new providers) but **closed for modification** (existing code doesn't change).

### 3. Dependency Inversion

High-level modules (routes) depend on abstractions (`IAIService`), not concrete implementations.

### 4. Single Responsibility

- **Factory**: Creates services
- **BaseAIService**: Shared functionality
- **Concrete Services**: Provider-specific API calls
- **Config**: Environment management

## Provider Comparison

| Provider          | Tool Format     | Auth             | Streaming | Cost                |
| ----------------- | --------------- | ---------------- | --------- | ------------------- |
| **OpenRouter**    | OpenAI-style    | Bearer token     | Yes       | Free tier available |
| **Anthropic**     | Anthropic-style | x-api-key header | Yes       | Paid                |
| **Your Provider** | TBD             | TBD              | TBD       | TBD                 |

## Testing Multi-Provider Setup

### Test Provider Switching

1. Start with OpenRouter:

   ```env
   AI_PROVIDER=openrouter
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

2. Test the chat endpoint:

   ```bash
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "List all Accounts"}'
   ```

3. Check health endpoint shows correct provider:

   ```bash
   curl http://localhost:3001/health
   # Should show: "aiProvider": "openrouter"
   ```

4. Switch to Anthropic:

   ```env
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```

5. Restart server and test again:

   ```bash
   curl http://localhost:3001/health
   # Should show: "aiProvider": "anthropic"
   ```

6. Same chat query should work with different provider:
   ```bash
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "List all Accounts"}'
   ```

## Benefits of This Architecture

✅ **Easy to extend**: Add new providers without modifying existing code  
✅ **Type-safe**: TypeScript ensures all providers implement required methods  
✅ **Testable**: Mock `IAIService` interface for unit tests  
✅ **Maintainable**: Shared logic in one place (BaseAIService)  
✅ **Flexible**: Switch providers via environment variable  
✅ **Consistent**: All providers follow same patterns and return same format

## Common Patterns Across Providers

All provider implementations follow these patterns:

### 1. Tool Conversion

```typescript
// MCP tools → Provider-specific format
const providerTools = this.convertToProviderFormat(mcpTools);
```

### 2. Agentic Loop

```typescript
while (iterations < maxIterations) {
  const response = await this.callProvider(messages);
  if (response.wantsToUseTool) {
    const result = await this.executeTool(toolName, args);
    messages.push(toolResult);
    continue;
  }
  return response.content;
}
```

### 3. Session Management

```typescript
// Add to history
this.sessionManager.addMessage(sessionId, "user", message);
this.sessionManager.addMessage(sessionId, "assistant", response);
```

## Troubleshooting

### "Unsupported AI provider" Error

- Check `AI_PROVIDER` in `.env` matches a supported provider
- Verify the provider type is added to the `AIProvider` type union

### Provider-Specific API Errors

- Verify API key is correct and valid
- Check API key has proper permissions
- Ensure model name is valid for that provider
- Review provider's API documentation for rate limits

### Tool Execution Failures

- Check MCP server connection (health endpoint)
- Verify Salesforce authentication
- Review tool name and argument format
- Check console logs for detailed error messages

## Future Enhancements

Potential improvements to the architecture:

1. **Streaming Support**: Add streaming interface for real-time responses
2. **Provider Fallback**: Automatically switch providers if one fails
3. **Cost Tracking**: Monitor API usage and costs per provider
4. **Performance Metrics**: Track response times and quality per provider
5. **A/B Testing**: Route requests to different providers for comparison
6. **Custom Tool Definitions**: Provider-specific tool optimizations

## Resources

- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Factory Pattern](https://refactoring.guru/design-patterns/factory-method)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)

---

**Questions?** Open an issue or check the main README.md for contact information.
