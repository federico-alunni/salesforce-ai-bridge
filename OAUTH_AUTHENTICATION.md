# Salesforce OAuth Authentication Guide

This guide explains how the Salesforce AI Bridge implements per-user OAuth authentication and how to integrate it with your Salesforce Lightning Web Components.

## Overview

The AI Bridge now supports **per-user authentication** using Salesforce OAuth tokens. This means:

- ✅ Each request is authenticated as a specific Salesforce user
- ✅ All Salesforce operations execute with that user's permissions
- ✅ Audit trails show the actual user who performed actions
- ✅ Security is enforced at the user level, not service account level

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Salesforce Org                          │
│                                                                 │
│  ┌──────────────┐                                              │
│  │     LWC      │  1. Get Session ID                          │
│  │  Component   │────────────────────────┐                     │
│  └──────┬───────┘                        │                     │
│         │                                 ▼                     │
│         │                         ┌──────────────┐             │
│         │                         │ Apex Method  │             │
│         │                         │getSessionId()│             │
│         │                         └──────────────┘             │
│         │ 2. Send request with                                 │
│         │    X-Salesforce-Session header                       │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Bridge Server (Node.js)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3. Auth Middleware validates token:                      │  │
│  │    GET /services/oauth2/userinfo                         │  │
│  │    Authorization: Bearer <token>                         │  │
│  │                                                           │  │
│  │    Returns: userId, username, orgId                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 4. Check rate limit for user                             │  │
│  │    (10 requests/minute per user)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 5. Store user context in session                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 6. Call AI service with user context                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Salesforce Server                        │
│                                                                 │
│  7. Receives JSON-RPC request with meta field:                 │
│     {                                                           │
│       "jsonrpc": "2.0",                                         │
│       "method": "tools/call",                                   │
│       "params": { ... },                                        │
│       "meta": {                                                 │
│         "salesforceAuth": {                                     │
│           "accessToken": "token",                               │
│           "instanceUrl": "url",                                 │
│           "userId": "005...",                                   │
│           "username": "user@example.com"                        │
│         }                                                       │
│       }                                                         │
│     }                                                           │
│                                                                 │
│  8. Executes Salesforce operation as that user                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Enable OAuth authentication
REQUIRE_SALESFORCE_AUTH=true

# Token validation cache (5 minutes)
# Reduces API calls to Salesforce
SALESFORCE_TOKEN_VALIDATION_TTL=300000

# Rate limiting (10 requests per minute per user)
USER_RATE_LIMIT_PER_MINUTE=10
```

### CORS Configuration

The bridge automatically allows Salesforce domains:

- `*.lightning.force.com`
- `*.cloudforce.com`
- `*.salesforce.com`
- `*.visualforce.com`

You can also specify custom domains:

```env
ALLOWED_ORIGINS=https://mycompany.lightning.force.com,https://mycompany--dev.sandbox.lightning.force.com
```

## LWC Integration

### Step 1: Create Apex Controller

Create an Apex class to provide session information:

```apex
// force-app/main/default/classes/SessionController.cls
public with sharing class SessionController {

    /**
     * Get the current user's session ID
     * Note: Session ID access must be enabled in Session Settings
     */
    @AuraEnabled(cacheable=false)
    public static String getSessionId() {
        return UserInfo.getSessionId();
    }

    /**
     * Get the Salesforce instance URL
     */
    @AuraEnabled(cacheable=true)
    public static String getInstanceUrl() {
        return URL.getOrgDomainUrl().toExternalForm();
    }

    /**
     * Get current user info for display
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getUserInfo() {
        return new Map<String, String>{
            'userId' => UserInfo.getUserId(),
            'username' => UserInfo.getUserName(),
            'email' => UserInfo.getUserEmail(),
            'name' => UserInfo.getName()
        };
    }
}
```

### Step 2: Enable Session ID Access

1. Go to **Setup** → **Session Settings**
2. Under **Session Security**, uncheck **"Prevent users from accessing Salesforce from non-Salesforce applications that request a session ID"**
3. Alternatively, use a **Connected App** with OAuth 2.0

### Step 3: Create LWC Component

```javascript
// force-app/main/default/lwc/salesforceAiChat/salesforceAiChat.js
import { LightningElement, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getSessionId from "@salesforce/apex/SessionController.getSessionId";
import getInstanceUrl from "@salesforce/apex/SessionController.getInstanceUrl";

export default class SalesforceAiChat extends LightningElement {
  @track messages = [];
  @track inputValue = "";
  @track isLoading = false;
  @track sessionId = null;

  // Your AI Bridge URL
  bridgeUrl = "https://your-bridge.onrender.com/api/chat";

  connectedCallback() {
    this.addMessage(
      "assistant",
      "Hello! I'm your Salesforce AI assistant. How can I help you today?"
    );
  }

  handleInputChange(event) {
    this.inputValue = event.target.value;
  }

  handleKeyPress(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  async handleSend() {
    if (!this.inputValue.trim()) return;

    const userMessage = this.inputValue.trim();
    this.inputValue = "";
    this.isLoading = true;

    // Add user message to chat
    this.addMessage("user", userMessage);

    try {
      // Get Salesforce session info
      const [accessToken, instanceUrl] = await Promise.all([
        getSessionId(),
        getInstanceUrl(),
      ]);

      // Call AI Bridge
      const response = await fetch(this.bridgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Salesforce-Session": accessToken,
          "X-Salesforce-Instance-URL": instanceUrl,
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: this.sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Request failed");
      }

      const data = await response.json();

      // Store session ID for context
      this.sessionId = data.sessionId;

      // Add AI response to chat
      this.addMessage("assistant", data.message);
    } catch (error) {
      console.error("Chat error:", error);
      this.showToast("Error", error.message, "error");
      this.addMessage(
        "assistant",
        "I apologize, but I encountered an error. Please try again."
      );
    } finally {
      this.isLoading = false;
    }
  }

  addMessage(role, content) {
    this.messages = [
      ...this.messages,
      {
        id: Date.now(),
        role,
        content,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];

    // Scroll to bottom
    setTimeout(() => {
      const container = this.template.querySelector(".chat-messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant,
      })
    );
  }
}
```

```html
<!-- force-app/main/default/lwc/salesforceAiChat/salesforceAiChat.html -->
<template>
  <lightning-card title="Salesforce AI Assistant" icon-name="utility:einstein">
    <div class="slds-p-around_medium">
      <!-- Chat Messages -->
      <div class="chat-messages">
        <template for:each="{messages}" for:item="message">
          <div key="{message.id}" class="{message.role}">
            <div class="message-content">
              <lightning-formatted-text
                value="{message.content}"
              ></lightning-formatted-text>
            </div>
            <div class="message-time">{message.timestamp}</div>
          </div>
        </template>
      </div>

      <!-- Input Area -->
      <div class="chat-input">
        <lightning-textarea
          value="{inputValue}"
          placeholder="Ask me anything about your Salesforce data..."
          onchange="{handleInputChange}"
          onkeypress="{handleKeyPress}"
          disabled="{isLoading}"
        ></lightning-textarea>
        <lightning-button
          label="Send"
          variant="brand"
          onclick="{handleSend}"
          disabled="{isLoading}"
          class="slds-m-top_small"
        ></lightning-button>
      </div>

      <template if:true="{isLoading}">
        <lightning-spinner alternative-text="Processing..."></lightning-spinner>
      </template>
    </div>
  </lightning-card>
</template>
```

```css
/* force-app/main/default/lwc/salesforceAiChat/salesforceAiChat.css */
.chat-messages {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #dddbda;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #fafaf9;
}

.user,
.assistant {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
}

.user {
  background-color: #0176d3;
  color: white;
  margin-left: 20%;
}

.assistant {
  background-color: white;
  border: 1px solid #dddbda;
  margin-right: 20%;
}

.message-content {
  margin-bottom: 0.25rem;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
}

.chat-input {
  margin-top: 1rem;
}
```

## Error Handling

### 401 Unauthorized

**Cause**: Missing or invalid Salesforce access token

**Response**:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired Salesforce access token"
}
```

**Solution**:

- Check that Session ID access is enabled
- Refresh the user's session
- Verify the access token is being sent correctly

### 403 Forbidden

**Cause**: User lacks permissions for the requested operation

**Response**:

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions for this operation"
}
```

**Solution**:

- Check user's profile and permission sets
- Verify object and field-level security
- Ensure user has required Salesforce licenses

### 429 Rate Limited

**Cause**: User exceeded rate limit (default: 10 requests/minute)

**Response**:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 10 requests per minute per user.",
  "retryAfter": 60
}
```

**Solution**:

- Wait before sending another request
- Increase `USER_RATE_LIMIT_PER_MINUTE` if needed
- Implement client-side rate limiting

## Token Validation Caching

To reduce API calls to Salesforce, validated tokens are cached for 5 minutes (configurable):

```env
SALESFORCE_TOKEN_VALIDATION_TTL=300000  # 5 minutes in milliseconds
```

**How it works**:

1. First request validates token via `/services/oauth2/userinfo`
2. User info is cached with a timestamp
3. Subsequent requests within 5 minutes use cached data
4. After 5 minutes, token is revalidated

**Benefits**:

- Reduces latency on subsequent requests
- Minimizes API calls to Salesforce
- Improves overall performance

**Security**:

- Cache is in-memory only (cleared on server restart)
- Each token is validated at least once
- Expired tokens are detected and rejected

## Best Practices

### 1. Handle Token Expiration

```javascript
async makeRequest(message) {
    try {
        const response = await fetch(this.bridgeUrl, { /* ... */ });
        if (response.status === 401) {
            // Token expired - refresh session
            await this.refreshSession();
            // Retry request
            return await this.makeRequest(message);
        }
        return await response.json();
    } catch (error) {
        this.handleError(error);
    }
}
```

### 2. Implement Client-Side Rate Limiting

```javascript
class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 60000) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(
      (time) => now - time < this.timeWindow
    );
    return this.requests.length < this.maxRequests;
  }

  recordRequest() {
    this.requests.push(Date.now());
  }
}
```

### 3. Store Session Context

```javascript
// Store session ID to maintain conversation context
if (data.sessionId) {
  sessionStorage.setItem("aiChatSessionId", data.sessionId);
}

// Retrieve for next request
const sessionId = sessionStorage.getItem("aiChatSessionId");
```

### 4. Secure Token Handling

```javascript
// ❌ Never log the actual token
console.log('Token:', accessToken);

// ✅ Log masked version only
console.log('Token:', this.maskToken(accessToken));

maskToken(token) {
    if (!token || token.length < 8) return '****';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}
```

## Testing

### Test with Postman/cURL

```bash
# Get your session ID from Salesforce Dev Console
# Run: System.debug(UserInfo.getSessionId());

curl -X POST https://your-bridge.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Salesforce-Session: YOUR_SESSION_ID" \
  -H "X-Salesforce-Instance-URL: https://yourinstance.salesforce.com" \
  -d '{
    "message": "Show me my open opportunities"
  }'
```

### Test Without Auth (Development Only)

```env
REQUIRE_SALESFORCE_AUTH=false
```

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "List all account fields"
  }'
```

## Monitoring

### Log User Activity

The bridge automatically logs:

- ✅ User ID and username for each request
- ✅ Rate limit violations
- ✅ Authentication failures
- ✅ Token validation cache hits/misses

Example logs:

```
✓ Token validated for user: user@example.com (005XXXXXXXXXX)
Including Salesforce auth for user: user@example.com (005XXXXXXXXXX)
Using cached token validation
```

### Token Masking

All logs mask access tokens automatically:

```
Token: 00D1...XXXX (masked)
```

## Troubleshooting

### "Missing required Salesforce authentication headers"

**Check**:

1. Headers are being sent correctly
2. Header names are exact: `X-Salesforce-Session`, `X-Salesforce-Instance-URL`
3. CORS is configured correctly

### "Invalid or expired Salesforce access token"

**Check**:

1. Session Settings allow Session ID access
2. User session hasn't expired
3. Token is valid and active

### "Session ID access not enabled"

**Solution**:

1. Go to Setup → Session Settings
2. Uncheck "Prevent users from accessing Salesforce from non-Salesforce applications"
3. Or use Connected App OAuth

### Rate limits too restrictive

**Solution**:
Increase the limit in `.env`:

```env
USER_RATE_LIMIT_PER_MINUTE=20
```

## Security Checklist

- ✅ Enable `REQUIRE_SALESFORCE_AUTH=true` in production
- ✅ Use HTTPS for all communications
- ✅ Configure specific CORS origins (not `*`)
- ✅ Monitor rate limit violations
- ✅ Review session timeout settings
- ✅ Ensure MCP server also validates user context
- ✅ Test with different user permission levels
- ✅ Implement proper error handling in LWC
- ✅ Never log sensitive tokens
- ✅ Use token validation caching to reduce overhead

## Next Steps

1. ✅ Enable OAuth authentication in `.env`
2. ✅ Create Apex controller for session access
3. ✅ Build LWC component with auth headers
4. ✅ Test authentication flow end-to-end
5. ✅ Deploy to production with HTTPS
6. ✅ Monitor usage and adjust rate limits

---

For more information, see:

- [Main README](./README.md)
- [Quick Start Guide](./QUICKSTART.md)
- [Testing Guide](./TESTING.md)
