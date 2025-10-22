# Record Context Feature

## Overview

The AI Bridge now supports including Salesforce record context in chat requests. This allows the LLM to have full visibility of a specific Salesforce record when answering user questions.

## Implementation

### Request Format

When the Salesforce LWC sends a chat request, it can now include the following optional parameters:

```json
{
  "message": "What is the billing address for this account?",
  "sessionId": "optional-session-id",
  "includeRecordContext": true,
  "record": {
    "Id": "001g5000001VzkzAAC",
    "Name": "Acme Corporation",
    "Industry": "Technology",
    "BillingStreet": "123 Main St",
    "BillingCity": "San Francisco",
    "BillingState": "CA",
    "BillingPostalCode": "94105"
  },
  "objectApiName": "Account",
  "recordId": "001g5000001VzkzAAC"
}
```

### Validation

- If `includeRecordContext` is `true`, all three fields (`record`, `objectApiName`, `recordId`) are **required**
- If validation fails, the API returns a 400 error with a descriptive message

### How It Works

1. **Request Processing** (`routes/chat.ts`):

   - Extracts record context from the request body
   - Validates that all required fields are present when `includeRecordContext` is true
   - Stores the record context in the chat session

2. **Context Formatting** (`services/base/AIServiceBase.ts`):

   - The `formatRecordContext()` method creates an LLM-friendly text representation
   - Formats the record data with clear section markers
   - Includes instructions for the LLM to use the context

3. **LLM Integration** (`services/openRouterService.ts` & `services/anthropicService.ts`):
   - Prepends the formatted record context to the user's message
   - The context is included in the conversation sent to the LLM

### Example Context Format

When a record is included, it's formatted as:

```
=== SALESFORCE RECORD CONTEXT ===
Object Type: Account
Record ID: 001g5000001VzkzAAC

Record Fields:
  Id: 001g5000001VzkzAAC
  Name: Acme Corporation
  Industry: Technology
  BillingStreet: 123 Main St
  BillingCity: San Francisco
  BillingState: CA
  BillingPostalCode: 94105
=== END RECORD CONTEXT ===

The user's question relates to the above Account record. Use this context when answering their question.

[User's actual message]
```

## Benefits

1. **Contextual Awareness**: The LLM has immediate access to all record data without needing to query
2. **Reduced Tool Calls**: For simple questions about the current record, no Salesforce queries are needed
3. **Better Responses**: The LLM can provide more accurate and relevant answers
4. **Session Persistence**: Record context is stored in the session for continuity

## TypeScript Types

### RecordContext

```typescript
export interface RecordContext {
  record: any;
  objectApiName: string;
  recordId: string;
}
```

### ChatRequest (Updated)

```typescript
export interface ChatRequest {
  message: string;
  sessionId?: string;
  includeRecordContext?: boolean;
  record?: any;
  objectApiName?: string;
  recordId?: string;
}
```

### ChatSession (Updated)

```typescript
export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  salesforceAuth?: SalesforceAuth;
  recordContext?: RecordContext; // NEW
}
```

## Usage Example

### From Salesforce LWC

```javascript
// In your Lightning Web Component
async handleSendMessage() {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Salesforce-Access-Token': this.sessionId,
            'X-Salesforce-Instance-URL': this.instanceUrl
        },
        body: JSON.stringify({
            message: this.userInput,
            sessionId: this.chatSessionId,
            includeRecordContext: true,
            record: this.recordData,
            objectApiName: this.objectApiName,
            recordId: this.recordId
        })
    });

    const data = await response.json();
    // Handle response...
}
```

## Notes

- Record context is optional - existing functionality without context continues to work
- The record object can contain any serializable fields
- Related records (lookup fields) are included as nested objects
- Null/undefined fields are automatically filtered out from the context display
- Record context persists in the session until explicitly cleared or a new context is provided
