# 🚀 Quick Start Guide

Get your Salesforce AI Bridge running in 5 minutes with your choice of AI provider!

## Prerequisites Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] AI Provider API key (choose one):
  - [ ] **OpenRouter** (FREE for dev) - [openrouter.ai](https://openrouter.ai)
  - [ ] **Anthropic** (paid, production quality) - [console.anthropic.com](https://console.anthropic.com)
- [ ] Salesforce org authenticated (via CLI or have credentials ready)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your text editor
notepad .env  # Windows
# or
nano .env     # Mac/Linux
```

**Choose Your AI Provider:**

#### Option A: OpenRouter (Recommended for Development - FREE ✨)

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=tngtech/deepseek-r1t2-chimera:free
SALESFORCE_CONNECTION_TYPE=Salesforce_CLI
ALLOWED_ORIGINS=https://your-domain.lightning.force.com
```

**Get Free OpenRouter Key:**

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign in with GitHub/Google
3. Go to Keys → Create new key
4. Copy to `.env`

#### Option B: Anthropic Claude (Recommended for Production 🚀)

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
SALESFORCE_CONNECTION_TYPE=Salesforce_CLI
ALLOWED_ORIGINS=https://your-domain.lightning.force.com
```

**Get Anthropic Key:**

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (requires payment method)
3. Go to API Keys → Create key
4. Copy to `.env`

### 3. Configure Your MCP Server URL

Make sure your MCP Salesforce Server is deployed and accessible. Update `.env` with your server URL:

```env
MCP_SERVER_URL=https://mcp-server-salesforce-c5ma.onrender.com/mcp
```

**Note:** Your MCP server should be running and properly authenticated with Salesforce.

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev
```

You should see:

```
Starting Salesforce AI Bridge Server...
Environment: development
AI Provider: openrouter (or anthropic)
Connecting to MCP Salesforce Server...
✓ Connected to MCP Salesforce Server

✓ Server running on port 3001
  Health check: http://localhost:3001/health
  Chat API: http://localhost:3001/api/chat

Ready to handle requests!
```

### 5. Test It!

Open a new terminal and try:

```bash
# Test health endpoint (shows which AI provider is active)
curl http://localhost:3001/health

# Send a test message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me all standard Salesforce objects"}'
```

Expected health response:

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "mcpConnected": true,
  "aiProvider": "openrouter",
  "aiModel": "tngtech/deepseek-r1t2-chimera:free"
}
```

## ✅ Success Indicators

You'll know it's working when:

1. ✓ Server starts without errors
2. ✓ Health check shows `"mcpConnected": true`
3. ✓ Health check shows your configured `"aiProvider"` and `"aiModel"`
4. ✓ Chat endpoint returns AI responses
5. ✓ Console logs show tool calls being executed

## 🐛 Troubleshooting

### "Cannot find module 'axios'"

```bash
npm install
```

### "Failed to connect to MCP server"

1. Check Salesforce authentication: `sf org display`
2. Verify `SALESFORCE_CONNECTION_TYPE` in `.env`
3. Try: `npx @tsmztech/mcp-server-salesforce` to test MCP server directly

### "OPENROUTER_API_KEY is required" or "ANTHROPIC_API_KEY is required"

1. Check your `AI_PROVIDER` setting in `.env`
2. Make sure the corresponding API key is set:
   - For `openrouter`: Set `OPENROUTER_API_KEY=sk-or-v1-...`
   - For `anthropic`: Set `ANTHROPIC_API_KEY=sk-ant-...`
3. Get your API key:
   - OpenRouter (free): [openrouter.ai](https://openrouter.ai)
   - Anthropic (paid): [console.anthropic.com](https://console.anthropic.com)

### "CORS error" from LWC

Add your Salesforce domain to `.env`:

```env
ALLOWED_ORIGINS=https://your-domain.lightning.force.com
```

### TypeScript errors during development

These are expected during development. The code will work fine at runtime after `npm install`.

## 🔄 Switching AI Providers

You can switch between providers anytime:

1. Edit `.env` and change `AI_PROVIDER`:

   ```env
   # For development (free)
   AI_PROVIDER=openrouter

   # For production (paid, higher quality)
   AI_PROVIDER=anthropic
   ```

2. Make sure the corresponding API key is set

3. Restart the server: `npm run dev`

## 📊 Provider Comparison

| Feature      | OpenRouter   | Anthropic   |
| ------------ | ------------ | ----------- |
| **Cost**     | FREE tier    | Paid ($)    |
| **Setup**    | GitHub login | Credit card |
| **Best For** | Development  | Production  |
| **Quality**  | Good         | Excellent   |
| **Speed**    | Fast         | Very fast   |

**💡 Recommended:** Start with OpenRouter for development, switch to Anthropic for production.

## 🎯 Next Steps

1. **Test the API** - Use the examples in `TESTING.md`
2. **Create an LWC** - Build a chat component in Salesforce
3. **Customize** - Modify the system prompt in `src/services/base/AIServiceBase.ts`
4. **Deploy** - Prepare for production deployment

## 📚 Additional Resources

- Full documentation: `README.md`
- Testing examples: `TESTING.md`
- MCP Salesforce Server: [GitHub](https://github.com/tsmztech/mcp-server-salesforce)
- OpenRouter API Docs: [openrouter.ai/docs](https://openrouter.ai/docs)

## 💡 Quick Test Examples

Once running, try these chat messages:

```bash
# Simple query
"Show me all accounts"

# Object information
"What fields are on the Contact object?"

# Aggregate query
"Count opportunities by stage"

# Create operation
"Create a test account named Demo Corp"

# Search
"Search for 'cloud' across accounts"

# Apex
"Show me all Apex classes with Controller in the name"
```

## 🛟 Need Help?

- Check console logs for detailed error messages
- Review the `.env` configuration
- Verify Salesforce authentication
- Ensure your chosen provider's API key is valid:
  - OpenRouter (free): [openrouter.ai](https://openrouter.ai)
  - Anthropic (paid): [console.anthropic.com](https://console.anthropic.com)
- Check `/health` endpoint to see active provider and model

---

**Ready to integrate with LWC?** Check out the example LWC code in `TESTING.md`!
