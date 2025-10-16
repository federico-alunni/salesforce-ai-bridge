# Salesforce AI Bridge

A Node.js bridge server that connects Salesforce Lightning Web Components (LWC) with the MCP Salesforce Server via Anthropic's Claude AI.

## Architecture

```
┌─────────────────┐
│   LWC (Chat)    │
│   Component     │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│  AI Bridge      │
│  (This Server)  │
│  Express.js     │
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────┐
│  MCP Salesforce │
│     Server      │
└────────┬────────┘
         │ Salesforce API
         ▼
┌─────────────────┐
│  Salesforce Org │
└─────────────────┘
```

## Features

- 🤖 **AI-Powered Chat**: Natural language interface to Salesforce via Claude
- 🔌 **MCP Integration**: Connects to MCP Salesforce Server for tool execution

## Features

- **Multi-Provider AI Support**: Choose between OpenRouter (free dev models) or Anthropic Claude (production quality)
- **Factory Pattern**: Runtime provider selection via environment configuration
- **Session Management**: Maintains conversation context across multiple requests
- **MCP Protocol Support**: Direct integration with MCP Salesforce Server
- **RESTful API**: Easy integration with Salesforce LWC
- **TypeScript**: Full type safety and modern development experience
- **Tool Calling**: AI can execute Salesforce operations through MCP tools
- **Agentic Loop**: Multi-step reasoning with automatic tool execution
- **Extensible**: Interface-based design makes adding new AI providers straightforward
- 🔐 **CORS Support**: Configurable CORS for Salesforce domains
- 🛠️ **Full Salesforce Toolset**: Access to all 16+ MCP Salesforce tools
- ⚡ **Real-time Processing**: Agentic loop for multi-step operations

## Prerequisites

- Node.js 18+ (with ESM support)
- npm or yarn
- AI Provider API key:
  - **OpenRouter** (free tier available) - Recommended for development
  - **Anthropic** (paid) - Recommended for production
- **MCP Salesforce Server** deployed and accessible via HTTP/HTTPS
  - Must be running at a public URL (e.g., Render, Heroku, AWS)

## Installation

1. **Clone or navigate to the project directory**

```bash
cd salesforce-ai-bridge
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# AI Provider Selection
AI_PROVIDER=openrouter  # or 'anthropic'

# OpenRouter Configuration (for AI_PROVIDER=openrouter)
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=tngtech/deepseek-r1t2-chimera:free

# Anthropic Configuration (for AI_PROVIDER=anthropic)
# ANTHROPIC_API_KEY=sk-ant-xxxxx
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# MCP Salesforce Server Configuration
# Your hosted MCP server URL
MCP_SERVER_URL=https://your-mcp-server.onrender.com/mcp

# CORS Configuration (your Salesforce domain)
ALLOWED_ORIGINS=https://your-domain.lightning.force.com

# Session timeout (30 minutes = 1800000 ms)
SESSION_TIMEOUT_MS=1800000
```

## MCP Server Setup

**Important:** This bridge requires a **hosted MCP Salesforce Server**. The MCP server should be:

1. Deployed to a cloud platform (Render, Heroku, AWS, etc.)
2. Accessible via HTTP/HTTPS
3. Authenticated with your Salesforce org
4. Exposing an MCP JSON-RPC endpoint

Set your MCP server URL in `.env`:

```env
MCP_SERVER_URL=https://your-mcp-server.onrender.com/mcp
```

## Getting Your AI Provider API Key

### OpenRouter (Free for Development)

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign in with GitHub/Google
3. Navigate to Keys section
4. Create a new API key
5. Copy it to your `.env` file

### Anthropic (Paid, Production Quality)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy it to your `.env` file

- `SALESFORCE_TOKEN` (Security token from Salesforce)
- `SALESFORCE_INSTANCE_URL`

## Usage

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Testing the Server

Once running, you can test the health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "mcpConnected": true,
  "aiProvider": "openrouter",
  "aiModel": "tngtech/deepseek-r1t2-chimera:free"
}
```

## API Endpoints

### POST `/api/chat`

Send a message and get an AI response.

**Request:**

```json
{
  "message": "Show me all accounts created this month",
  "sessionId": "optional-session-id"
}
```

**Response:**

```json
{
  "sessionId": "uuid-v4",
  "message": "Here are the accounts created this month: ...",
  "timestamp": 1234567890
}
```

### GET `/api/chat/:sessionId`

Get chat history for a session.

**Response:**

```json
{
  "sessionId": "uuid-v4",
  "messages": [
    {
      "role": "user",
      "content": "Show me all accounts",
      "timestamp": 1234567890
    },
    {
      "role": "assistant",
      "content": "Here are the accounts...",
      "timestamp": 1234567891
    }
  ],
  "createdAt": 1234567880,
  "lastActivityAt": 1234567891
}
```

### DELETE `/api/chat/:sessionId`

Clear a chat session.

**Response:**

```json
{
  "success": true,
  "message": "Session cleared"
}
```

### GET `/health`

Health check endpoint.

## Example Chat Interactions

Once connected from your LWC, users can ask:

- "Show me all high-priority cases"
- "Create a new account named Acme Corp"
- "What fields are available on the Opportunity object?"
- "Count opportunities by stage"
- "Search for 'cloud' across Accounts and Contacts"
- "Show me the AccountController Apex class"
- "Execute some Apex code to update records"

## Integrating with LWC

Your LWC should make HTTP requests to this bridge server:

```javascript
// Example LWC code
async function sendMessage(message, sessionId) {
  const response = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, sessionId }),
  });

  return await response.json();
}
```

## Project Structure

```
salesforce-ai-bridge/
├── src/
│   ├── config/
│   │   └── config.ts          # Configuration management
│   ├── routes/
│   │   └── chat.ts            # Chat API routes
│   ├── services/
│   │   ├── anthropicService.ts # Claude AI integration
│   │   ├── mcpClient.ts       # MCP server connection
│   │   └── sessionManager.ts  # Session management
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   └── index.ts               # Main server entry point
├── .env.example               # Example environment configuration
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Available Salesforce Tools

The bridge provides access to all MCP Salesforce Server tools:

1. `salesforce_search_objects` - Find objects by pattern
2. `salesforce_describe_object` - Get schema details
3. `salesforce_query_records` - SOQL queries
4. `salesforce_aggregate_query` - Aggregate queries
5. `salesforce_dml_records` - Create/Update/Delete records
6. `salesforce_manage_object` - Manage custom objects
7. `salesforce_manage_field` - Manage fields
8. `salesforce_manage_field_permissions` - Field-level security
9. `salesforce_search_all` - SOSL search
10. `salesforce_read_apex` - Read Apex classes
11. `salesforce_write_apex` - Create/Update Apex
12. `salesforce_read_apex_trigger` - Read triggers
13. `salesforce_write_apex_trigger` - Create/Update triggers
14. `salesforce_execute_anonymous` - Execute Apex
15. `salesforce_manage_debug_logs` - Debug log management

## Troubleshooting

### MCP Server Connection Failed

- Ensure MCP Salesforce Server is accessible
- Check your Salesforce authentication
- Verify `MCP_SERVER_COMMAND` and `MCP_SERVER_ARGS` in `.env`

### CORS Errors from LWC

- Add your Salesforce domain to `ALLOWED_ORIGINS`
- Format: `https://your-domain.lightning.force.com`
- Multiple domains: `domain1.com,domain2.com`

### Anthropic API Errors

- Verify your API key is valid
- Check your Anthropic account has credits
- Review rate limits in Anthropic console

### Session Not Found

- Sessions expire after `SESSION_TIMEOUT_MS` (default 30 minutes)
- Client should handle 404 and create a new session

## Security Considerations

- **Never commit `.env` file** - Contains sensitive credentials
- **Use HTTPS in production** - Add SSL/TLS termination
- **Validate CORS origins** - Restrict to your Salesforce domain
- **Rate limiting** - Consider adding rate limiting for production
- **Authentication** - Add authentication between LWC and bridge if needed

## Development

### Watch Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Clean Build Artifacts

```bash
npm run clean
```

## License

MIT

## Documentation

- 📘 [Quick Start Guide](./QUICKSTART.md) - Get running in 5 minutes
- 🏗️ [Multi-Provider Architecture](./MULTI_PROVIDER_ARCHITECTURE.md) - How to add new AI providers
- 📊 [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md) - Visual system architecture
- ✅ [Multi-Provider Complete](./MULTI_PROVIDER_COMPLETE.md) - What we built summary
- 🧪 [Testing Guide](./TESTING.md) - API examples and testing
- 🔧 [OpenRouter Setup](./OPENROUTER_SETUP.md) - OpenRouter configuration details

## Support

For issues related to:

- **This bridge**: Open an issue in this repository
- **MCP Salesforce Server**: See [mcp-server-salesforce](https://github.com/tsmztech/mcp-server-salesforce)
- **Anthropic API**: See [Anthropic Documentation](https://docs.anthropic.com/)
- **OpenRouter API**: See [OpenRouter Documentation](https://openrouter.ai/docs)

## Next Steps

1. ✅ Set up the bridge server (you're here!)
2. 🔨 Create an LWC component for the chat interface
3. 🚀 Deploy to a production environment
4. 📊 Consider switching to Anthropic for production quality
5. 🎨 Customize the AI system prompt for your use case

---

Built with ❤️ using MCP, Claude, and Salesforce
