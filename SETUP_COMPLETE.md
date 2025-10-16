# 🎉 OpenRouter Integration Complete!

Your Salesforce AI Bridge now uses **OpenRouter** with the **free DeepSeek R1T2 Chimera** model!

## ✅ What Was Updated

### 1. **Dependencies**

- ✅ Removed `@anthropic-ai/sdk`
- ✅ Added `axios` for OpenRouter HTTP API

### 2. **Configuration** (`src/config/config.ts`)

- ✅ Changed from Anthropic to OpenRouter settings
- ✅ Added `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, etc.

### 3. **AI Service** (`src/services/openRouterService.ts`)

- ✅ New service for OpenRouter API integration
- ✅ Full function calling / tool use support
- ✅ Agentic loop for multi-step operations
- ✅ Error handling and retries

### 4. **Main Server** (`src/index.ts`)

- ✅ Updated to use `OpenRouterService` instead of `AnthropicService`

### 5. **Routes** (`src/routes/chat.ts`)

- ✅ Updated to work with OpenRouter service

### 6. **Environment** (`.env.example`)

- ✅ Updated with OpenRouter configuration
- ✅ Free model as default: `nousresearch/deepseek-r1t2-chimera:free`

### 7. **Documentation**

- ✅ Updated `QUICKSTART.md` with OpenRouter instructions
- ✅ Created `OPENROUTER_SETUP.md` for getting API keys
- ✅ All references changed from Anthropic to OpenRouter

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get OpenRouter API Key (FREE!)

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up (free, no credit card)
3. Go to [Keys](https://openrouter.ai/keys)
4. Create a new key
5. Copy it (starts with `sk-or-v1-...`)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=nousresearch/deepseek-r1t2-chimera:free
SALESFORCE_CONNECTION_TYPE=Salesforce_CLI
ALLOWED_ORIGINS=https://your-domain.lightning.force.com
```

### 4. Authenticate Salesforce

```bash
sf org login web
sf org display
```

### 5. Start the Server

```bash
npm run dev
```

### 6. Test It!

```bash
# Health check
curl http://localhost:3001/health

# Send a chat message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me all Salesforce standard objects"}'
```

## 💡 Why OpenRouter?

### ✅ **FREE for Development**

- No credit card required
- Free models available (DeepSeek, Llama, Mistral)
- $1-5 free credits for new users

### ✅ **Easy to Use**

- Simple REST API
- Function calling support
- Good documentation

### ✅ **Flexible**

- Access to 100+ models
- Easy to switch models via `.env`
- One API for multiple providers

### ✅ **Production Ready**

- Pay-as-you-go pricing
- Can upgrade to Claude, GPT-4, etc.
- Good reliability

## 📊 Available Free Models

```env
# DeepSeek R1T2 Chimera (Recommended - Default)
OPENROUTER_MODEL=nousresearch/deepseek-r1t2-chimera:free

# Google Gemini Flash
OPENROUTER_MODEL=google/gemini-flash-1.5

# Meta Llama 3.1 8B
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Mistral 7B
OPENROUTER_MODEL=mistralai/mistral-7b-instruct:free
```

## 🎯 Key Features

### ✅ **Agentic Loop**

The AI can make multiple tool calls in sequence:

1. User asks: "Count opportunities and show top 5 accounts"
2. AI calls `salesforce_aggregate_query` tool
3. AI calls `salesforce_query_records` tool
4. AI formulates complete response

### ✅ **All Salesforce Tools**

Access to 16+ MCP Salesforce tools:

- Query records
- Aggregate queries
- Create/update/delete records
- Manage objects and fields
- Apex code operations
- Debug logs
- And more!

### ✅ **Session Management**

- Maintains conversation history
- Auto-cleanup of expired sessions
- 30-minute default timeout

### ✅ **Production Ready**

- Error handling
- CORS support
- Rate limiting ready
- Logging and monitoring

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "mcpConnected": true
}
```

### Chat Test

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What fields are on the Account object?"
  }'
```

## 📁 Project Structure

```
salesforce-ai-bridge/
├── src/
│   ├── config/
│   │   └── config.ts                 # OpenRouter config
│   ├── routes/
│   │   └── chat.ts                   # Chat API endpoints
│   ├── services/
│   │   ├── openRouterService.ts      # 🆕 OpenRouter AI service
│   │   ├── mcpClient.ts              # MCP connection
│   │   └── sessionManager.ts         # Session management
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   └── index.ts                      # Main server
├── .env.example                      # Environment template
├── package.json                      # Dependencies
├── QUICKSTART.md                     # 5-minute setup
├── OPENROUTER_SETUP.md              # 🆕 API key guide
└── README.md                         # Full documentation
```

## 🔧 Configuration Options

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# OpenRouter (Required)
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=nousresearch/deepseek-r1t2-chimera:free
OPENROUTER_APP_NAME=Salesforce-AI-Bridge
OPENROUTER_SITE_URL=http://localhost:3001

# Salesforce
SALESFORCE_CONNECTION_TYPE=Salesforce_CLI

# CORS
ALLOWED_ORIGINS=https://your-domain.lightning.force.com

# Sessions
SESSION_TIMEOUT_MS=1800000
```

## 🐛 Troubleshooting

### "Cannot find module 'axios'"

```bash
npm install
```

### "OPENROUTER_API_KEY is required"

1. Get free key from [openrouter.ai](https://openrouter.ai)
2. Add to `.env` file

### "Failed to connect to MCP server"

1. Check: `sf org display`
2. Verify Salesforce authentication
3. Test MCP: `npx @tsmztech/mcp-server-salesforce`

### "Rate limit exceeded"

- Wait a moment and try again
- Free models have generous limits
- Consider adding credits if needed

## 🎨 Next Steps

### 1. ✅ Server is Ready!

Your bridge is now configured with OpenRouter.

### 2. 🎨 Create LWC Component

Build a Lightning Web Component to interact with the bridge.

### 3. 🚀 Deploy

Deploy to a production environment when ready.

### 4. 💰 Upgrade (Optional)

When ready for production, upgrade to paid models:

```env
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_MODEL=openai/gpt-4-turbo
```

## 📚 Documentation

- **QUICKSTART.md** - Get running in 5 minutes
- **OPENROUTER_SETUP.md** - Get your API key
- **TESTING.md** - Test examples
- **README.md** - Full documentation

## 💬 Example Interactions

Once your LWC is built, users can ask:

```
"Show me all high priority cases"
"Create a new account named Acme Corp"
"Count opportunities by stage"
"What fields are on the Contact object?"
"Search for 'cloud' across accounts"
"Show me the AccountController Apex class"
```

## 🎉 You're All Set!

Your Salesforce AI Bridge is now powered by **OpenRouter** with a **free AI model**.

Start the server and begin testing:

```bash
npm run dev
```

---

**Happy Building! 🚀**
