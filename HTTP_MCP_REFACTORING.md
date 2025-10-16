# 🔄 Refactoring Complete: HTTP-Based MCP Connection

## Overview

The Salesforce AI Bridge has been refactored to connect to a **hosted MCP Salesforce Server** via HTTP/JSON-RPC instead of spawning a local subprocess.

## What Changed

### ✅ Configuration (`src/config/config.ts`)

**Before:**

```typescript
// MCP configuration
mcpServerCommand: string;
mcpServerArgs: string[];
// Salesforce configuration
salesforceConfig: { ... }
```

**After:**

```typescript
// MCP configuration
mcpServerUrl: string; // e.g., https://your-server.onrender.com/mcp
```

**Why:** Simplified configuration - just need the URL of your hosted MCP server.

### ✅ MCP Client (`src/services/mcpClient.ts`)

**Before:**

- Used `StdioClientTransport` from MCP SDK
- Spawned local MCP server process via `child_process.spawn()`
- Communicated via stdin/stdout pipes
- Managed server lifecycle (start/stop)

**After:**

- Uses `axios` for HTTP requests
- Connects to remote MCP server via JSON-RPC over HTTP
- No process management needed
- Simple REST-like communication

**Key Changes:**

```typescript
// Before: Local subprocess
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
this.transport = new StdioClientTransport({ command, args, env });

// After: HTTP client
import axios from 'axios';
this.httpClient = axios.create({
  baseURL: this.config.mcpServerUrl,
  ...
});
```

### ✅ Environment Configuration (`.env.example`)

**Before:**

```env
MCP_SERVER_COMMAND=npx
MCP_SERVER_ARGS=-y,@tsmztech/mcp-server-salesforce
SALESFORCE_CONNECTION_TYPE=Salesforce_CLI
SALESFORCE_USERNAME=...
SALESFORCE_PASSWORD=...
```

**After:**

```env
MCP_SERVER_URL=https://mcp-server-salesforce-c5ma.onrender.com/mcp
```

**Why:** The MCP server handles Salesforce authentication itself. Bridge just needs to know where to find it.

### ✅ Documentation Updates

- **README.md**: Updated prerequisites and setup instructions
- **QUICKSTART.md**: Removed local Salesforce CLI setup steps
- **New section**: MCP Server Setup explaining hosted requirement

## Architecture Changes

### Before: Local Subprocess Model

```
┌─────────────────────────────────────────┐
│        Your Machine                     │
│                                         │
│  ┌──────────────┐                       │
│  │ AI Bridge    │                       │
│  └──────┬───────┘                       │
│         │ stdio pipes                   │
│  ┌──────▼───────┐                       │
│  │ MCP Server   │ (spawned subprocess)  │
│  │ (Local)      │                       │
│  └──────┬───────┘                       │
│         │ HTTPS                         │
└─────────┼─────────────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │  Salesforce  │
   └──────────────┘
```

### After: HTTP Client Model

```
┌─────────────────────────────────────────┐
│        Your Machine                     │
│                                         │
│  ┌──────────────┐                       │
│  │ AI Bridge    │                       │
│  └──────┬───────┘                       │
│         │                               │
└─────────┼───────────────────────────────┘
          │ HTTP/JSON-RPC
          ▼
┌─────────────────────────────────────────┐
│      Cloud (Render/Heroku/AWS)          │
│                                         │
│  ┌──────────────┐                       │
│  │ MCP Server   │ (hosted)              │
│  │ (Online)     │                       │
│  └──────┬───────┘                       │
│         │ HTTPS                         │
└─────────┼─────────────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │  Salesforce  │
   └──────────────┘
```

## Benefits

### ✅ Simpler Deployment

- No need to manage MCP server process
- No child process handling
- Easier to containerize

### ✅ Better for Production

- MCP server can be scaled independently
- Centralized MCP server for multiple bridges
- Easier monitoring and logging

### ✅ Cloud-Friendly

- Works with serverless deployments
- No local process dependencies
- Standard HTTP communication

### ✅ Reduced Complexity

- Fewer environment variables
- No Salesforce CLI dependency on bridge
- Clear separation of concerns

## JSON-RPC Protocol

The bridge now communicates with MCP server using JSON-RPC 2.0:

### List Tools

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "salesforce_query_records",
        "description": "...",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}
```

### Call Tool

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "salesforce_query_records",
    "arguments": {
      "objectName": "Account",
      "fields": ["Id", "Name"]
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"Id\":\"001...\",\"Name\":\"Acme Corp\"}]"
      }
    ]
  }
}
```

## Migration Guide

### If You Were Using Local MCP Server

**Step 1:** Deploy your MCP server to a cloud platform

```bash
# Example: Deploy to Render
# Create a new Web Service on Render
# Connect your MCP server repository
# Set Salesforce environment variables
# Get the deployment URL
```

**Step 2:** Update your `.env`

```env
# Remove these:
# MCP_SERVER_COMMAND=npx
# MCP_SERVER_ARGS=-y,@tsmztech/mcp-server-salesforce
# SALESFORCE_CONNECTION_TYPE=Salesforce_CLI

# Add this:
MCP_SERVER_URL=https://your-mcp-server.onrender.com/mcp
```

**Step 3:** Restart bridge

```bash
npm run dev
```

### If You're Starting Fresh

**Step 1:** Get your hosted MCP server URL

**Step 2:** Configure `.env`

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MCP_SERVER_URL=https://your-mcp-server.onrender.com/mcp
```

**Step 3:** Start bridge

```bash
npm install
npm run dev
```

## Testing

### Check Connection

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

### Test Chat

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "List all standard Salesforce objects"}'
```

## Troubleshooting

### "Failed to connect to MCP server"

**Possible causes:**

1. MCP server URL is incorrect
2. MCP server is not running
3. MCP server is not accessible (firewall/CORS)
4. MCP server URL is missing `/mcp` endpoint

**Solutions:**

- Verify MCP server is running: Visit the URL in browser
- Check MCP server logs for errors
- Ensure MCP server exposes correct endpoint
- Test MCP server directly with curl

### "Cannot find module 'axios'"

**Solution:**

```bash
npm install
```

### "Invalid response from MCP server"

**Possible causes:**

- MCP server not implementing JSON-RPC correctly
- Wrong endpoint URL
- Server returning HTML instead of JSON

**Solutions:**

- Check MCP server response format
- Verify endpoint path (should be `/mcp` or similar)
- Look at server implementation

## Files Modified

1. ✅ `src/config/config.ts` - Simplified MCP configuration
2. ✅ `src/services/mcpClient.ts` - HTTP client instead of stdio
3. ✅ `.env.example` - Updated environment variables
4. ✅ `README.md` - Updated documentation
5. ✅ `QUICKSTART.md` - Updated setup guide

## Dependencies

**No new dependencies added!** We already had `axios` for OpenRouter integration.

## Rollback

If you need to roll back to local MCP server:

1. Restore previous `src/services/mcpClient.ts` from git
2. Restore previous `src/config/config.ts` from git
3. Restore previous `.env.example` from git
4. Update your `.env` with local configuration
5. Restart: `npm run dev`

## Summary

✅ **Simpler**: No subprocess management  
✅ **Cloud-Ready**: Standard HTTP communication  
✅ **Scalable**: MCP server independent from bridge  
✅ **Production-Ready**: Better for deployment  
✅ **Flexible**: Works with any hosted MCP server

The bridge is now configured to work with your hosted MCP server at:

```
https://mcp-server-salesforce-c5ma.onrender.com/mcp
```

---

**Ready to test!** Start the bridge with `npm run dev` and it will connect to your hosted MCP server automatically.
