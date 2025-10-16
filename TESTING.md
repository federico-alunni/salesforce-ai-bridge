# Test Examples for Salesforce AI Bridge

## Using curl

### 1. Health Check

```bash
curl http://localhost:3001/health
```

### 2. Send a Chat Message (New Session)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me all Account objects"
  }'
```

### 3. Continue Existing Session

```bash
# Use the sessionId from the previous response
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Now describe the Account object",
    "sessionId": "your-session-id-here"
  }'
```

### 4. Get Chat History

```bash
curl http://localhost:3001/api/chat/your-session-id-here
```

### 5. Clear Session

```bash
curl -X DELETE http://localhost:3001/api/chat/your-session-id-here
```

## Example Chat Queries

Try these questions once the server is running:

```bash
# Query records
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me the top 5 accounts by annual revenue"}'

# Describe object
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What fields are available on the Contact object?"}'

# Aggregate query
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count opportunities by stage"}'

# Create record
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a new account named Test Corp with industry Technology"}'

# Search
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Search for cloud across accounts and contacts"}'
```

## JavaScript/Node.js Test Script

Create a file `test-client.js`:

```javascript
const BASE_URL = "http://localhost:3001";

async function testChat() {
  try {
    // Test 1: Health check
    console.log("Testing health endpoint...");
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const health = await healthResponse.json();
    console.log("Health:", health);
    console.log("");

    // Test 2: Send first message
    console.log("Sending first message...");
    const chatResponse1 = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "List all standard objects related to sales",
      }),
    });
    const chat1 = await chatResponse1.json();
    console.log("Session ID:", chat1.sessionId);
    console.log("Response:", chat1.message.substring(0, 200) + "...");
    console.log("");

    // Test 3: Continue conversation
    console.log("Continuing conversation...");
    const chatResponse2 = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Now show me the fields on the Account object",
        sessionId: chat1.sessionId,
      }),
    });
    const chat2 = await chatResponse2.json();
    console.log("Response:", chat2.message.substring(0, 200) + "...");
    console.log("");

    // Test 4: Get chat history
    console.log("Getting chat history...");
    const historyResponse = await fetch(
      `${BASE_URL}/api/chat/${chat1.sessionId}`
    );
    const history = await historyResponse.json();
    console.log("Messages in session:", history.messages.length);
    console.log("");

    // Test 5: Clear session
    console.log("Clearing session...");
    const clearResponse = await fetch(
      `${BASE_URL}/api/chat/${chat1.sessionId}`,
      {
        method: "DELETE",
      }
    );
    const clearResult = await clearResponse.json();
    console.log("Clear result:", clearResult);

    console.log("\n✓ All tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testChat();
```

Run it with:

```bash
node test-client.js
```

## PowerShell Examples

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get

# Send message
$body = @{
    message = "Show me all accounts"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/chat" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## Testing from LWC (Salesforce)

```javascript
// In your LWC component
import { LightningElement, track } from "lwc";

export default class SalesforceAiChat extends LightningElement {
  @track messages = [];
  sessionId = null;
  bridgeUrl = "http://localhost:3001/api/chat"; // Update for production

  async sendMessage(userMessage) {
    try {
      const response = await fetch(this.bridgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: this.sessionId,
        }),
      });

      const data = await response.json();

      // Store session ID for conversation continuity
      this.sessionId = data.sessionId;

      // Add messages to display
      this.messages.push({
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      });

      this.messages.push({
        role: "assistant",
        content: data.message,
        timestamp: data.timestamp,
      });

      return data;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }
}
```

## Expected Response Format

### Successful Chat Response

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "I found 15 accounts in your Salesforce org. Here are the top 5: ...",
  "timestamp": 1697234567890
}
```

### Error Response

```json
{
  "error": "An error occurred processing your request",
  "details": "Failed to connect to MCP server"
}
```

## Tips for Testing

1. **Start with simple queries**: "Show me all accounts" or "Describe the Account object"

2. **Test the agentic loop**: Ask multi-step questions like "Find all high-value opportunities and tell me who owns them"

3. **Test session continuity**: Send multiple messages with the same sessionId

4. **Test error handling**: Try invalid queries or disconnect the MCP server

5. **Monitor logs**: Watch the console output to see tool calls in real-time

## Common Issues

- **502/503 errors**: MCP server not running or not connected
- **CORS errors**: Add your domain to ALLOWED_ORIGINS
- **Timeout errors**: Increase timeout or check Salesforce API limits
- **401 errors**: Check Anthropic API key validity
