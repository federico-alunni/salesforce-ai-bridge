# OAuth Authentication - Quick Reference

## Environment Variables

```env
REQUIRE_SALESFORCE_AUTH=true
SALESFORCE_TOKEN_VALIDATION_TTL=300000  # 5 minutes
USER_RATE_LIMIT_PER_MINUTE=10
```

## HTTP Headers (Required)

```
X-Salesforce-Session: <Salesforce Access Token>
X-Salesforce-Instance-URL: <Instance URL>
```

## Example Request

```bash
curl -X POST https://your-bridge.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Salesforce-Session: 00D..." \
  -H "X-Salesforce-Instance-URL: https://yourinstance.salesforce.com" \
  -d '{"message": "Show me all accounts"}'
```

## LWC Integration

### 1. Create Apex Controller

```apex
public with sharing class SessionController {
    @AuraEnabled(cacheable=false)
    public static String getSessionId() {
        return UserInfo.getSessionId();
    }

    @AuraEnabled(cacheable=true)
    public static String getInstanceUrl() {
        return URL.getOrgDomainUrl().toExternalForm();
    }
}
```

### 2. Use in LWC

```javascript
import getSessionId from '@salesforce/apex/SessionController.getSessionId';
import getInstanceUrl from '@salesforce/apex/SessionController.getInstanceUrl';

async sendMessage(message) {
    const [token, instanceUrl] = await Promise.all([
        getSessionId(),
        getInstanceUrl()
    ]);

    const response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Salesforce-Session': token,
            'X-Salesforce-Instance-URL': instanceUrl
        },
        body: JSON.stringify({ message })
    });

    return await response.json();
}
```

## HTTP Status Codes

| Code | Meaning      | Action                                  |
| ---- | ------------ | --------------------------------------- |
| 200  | Success      | Process response                        |
| 401  | Unauthorized | Invalid/expired token - refresh session |
| 403  | Forbidden    | User lacks permissions                  |
| 429  | Rate Limited | Wait and retry (max 10/min)             |
| 500  | Server Error | Log and notify user                     |

## MCP Request Format

The bridge automatically adds auth to MCP requests:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {...},
  "meta": {
    "salesforceAuth": {
      "accessToken": "00D...",
      "instanceUrl": "https://instance.salesforce.com",
      "userId": "005...",
      "username": "user@example.com"
    }
  }
}
```

## Health Check

```bash
curl https://your-bridge.onrender.com/health
```

Response:

```json
{
  "status": "ok",
  "authRequired": true,
  "authMethod": "salesforce-oauth",
  ...
}
```

## Common Issues

### "Missing required Salesforce authentication headers"

✅ Check header names are exact: `X-Salesforce-Session`, `X-Salesforce-Instance-URL`

### "Invalid or expired Salesforce access token"

✅ Enable Session ID access in Setup → Session Settings  
✅ Or use Connected App OAuth

### "Rate limit exceeded"

✅ Wait 60 seconds or increase `USER_RATE_LIMIT_PER_MINUTE`

### Session expired

✅ Implement token refresh in LWC  
✅ Handle 401 responses gracefully

## Security Checklist

- ✅ Set `REQUIRE_SALESFORCE_AUTH=true` in production
- ✅ Use HTTPS (automatic on Render/Heroku)
- ✅ Configure specific CORS origins
- ✅ Never log full access tokens
- ✅ Monitor rate limit violations
- ✅ Test with different user permission levels

## Testing Without Auth (Dev Only)

```env
REQUIRE_SALESFORCE_AUTH=false
```

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

⚠️ **Never deploy to production with auth disabled!**

## Cache Behavior

| Scenario      | API Call to Salesforce | Cache Hit |
| ------------- | ---------------------- | --------- |
| First request | ✅ Yes                 | ❌ No     |
| Within 5 min  | ❌ No                  | ✅ Yes    |
| After 5 min   | ✅ Yes                 | ❌ No     |

## Rate Limiting

- **Limit**: 10 requests per minute per user (configurable)
- **Scope**: Per userId, not per session
- **Reset**: Rolling 60-second window
- **Response**: 429 with `retryAfter: 60`

## Documentation

- Full guide: [OAUTH_AUTHENTICATION.md](./OAUTH_AUTHENTICATION.md)
- Implementation: [OAUTH_IMPLEMENTATION_COMPLETE.md](./OAUTH_IMPLEMENTATION_COMPLETE.md)
- Main README: [README.md](./README.md)

---

**Quick Start**: 3 Steps to Enable Auth

1. Set `REQUIRE_SALESFORCE_AUTH=true`
2. Create Apex controller for session ID
3. Add headers to LWC requests
