import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager } from '../services/sessionManager.js';
import { IAIService } from '../services/base/AIServiceBase.js';
import { SalesforceAuthService } from '../services/salesforceAuth.js';
import { ChatRequest, ChatResponse, RateLimitInfo, SalesforceAuth } from '../types/index.js';
import { Config } from '../config/config.js';

// Extend Express Request to include Salesforce auth
declare global {
  namespace Express {
    interface Request {
      salesforceAuth?: SalesforceAuth;
    }
  }
}

export function createChatRouter(
  sessionManager: SessionManager,
  aiService: IAIService,
  config: Config,
  salesforceAuthService: SalesforceAuthService
): Router {
  const router = Router();

  // Rate limiting storage (in production, use Redis or similar)
  const rateLimitMap = new Map<string, RateLimitInfo>();

  // Cleanup rate limit entries every minute
  setInterval(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    for (const [userId, info] of rateLimitMap.entries()) {
      // Remove old requests
      info.requests = info.requests.filter(timestamp => timestamp > oneMinuteAgo);
      
      // Remove empty entries
      if (info.requests.length === 0 && now - info.lastCleanup > 300000) {
        rateLimitMap.delete(userId);
      } else {
        info.lastCleanup = now;
      }
    }
  }, 60000);

  // Middleware to extract and validate Salesforce authentication
  const salesforceAuthMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // Skip auth if not required
    if (!config.requireSalesforceAuth) {
      return next();
    }

    try {
      // Extract headers - now using OAuth access token
      const accessToken = req.headers['x-salesforce-access-token'] as string;
      const instanceUrl = req.headers['x-salesforce-instance-url'] as string;

      // DEBUG: Log access token (REMOVE IN PRODUCTION)
      console.log('🔍 [DEBUG] OAuth Access Token from header:', accessToken);
      console.log('🔍 [DEBUG] Instance URL from header:', instanceUrl);

      // Check if headers are present
      if (!accessToken || !instanceUrl) {
        console.log('🔍 [DEBUG] Response Status Code: 401 (Missing headers)');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing required Salesforce authentication headers',
          required: [
            'X-Salesforce-Access-Token (OAuth access token)',
            'X-Salesforce-Instance-URL (instance URL)',
          ],
        });
      }

      // Validate the token and get user info
      try {
        const salesforceAuth = await salesforceAuthService.validateToken(
          accessToken,
          instanceUrl
        );

        // Store the full token for MCP requests (not the masked one)
        const fullAuth: SalesforceAuth = {
          ...salesforceAuth,
          accessToken, // Keep the original token for MCP calls
        };

        // Attach to request
        req.salesforceAuth = fullAuth;

        // Check rate limiting
        const userId = fullAuth.userInfo.userId;
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        let rateLimitInfo = rateLimitMap.get(userId);
        if (!rateLimitInfo) {
          rateLimitInfo = {
            userId,
            requests: [],
            lastCleanup: now,
          };
          rateLimitMap.set(userId, rateLimitInfo);
        }

        // Remove requests older than 1 minute
        rateLimitInfo.requests = rateLimitInfo.requests.filter(
          timestamp => timestamp > oneMinuteAgo
        );

        // Check if limit exceeded
        if (rateLimitInfo.requests.length >= config.userRateLimitPerMinute) {
          console.log('🔍 [DEBUG] Response Status Code: 429 (Rate limit exceeded)');
          return res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Maximum ${config.userRateLimitPerMinute} requests per minute per user.`,
            retryAfter: 60,
          });
        }

        // Add current request
        rateLimitInfo.requests.push(now);
        rateLimitMap.set(userId, rateLimitInfo);

        next();
      } catch (error) {
        console.error('Salesforce token validation error:', error);
        console.log('🔍 [DEBUG] Response Status Code: 401 (Token validation failed)');
        
        return res.status(401).json({
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : 'Invalid Salesforce credentials',
        });
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      console.log('🔍 [DEBUG] Response Status Code: 500 (Auth middleware error)');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process authentication',
      });
    }
  };

  // Apply auth middleware to all routes
  router.use(salesforceAuthMiddleware);

  // POST /api/chat - Send a message and get AI response
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { 
        message, 
        sessionId: providedSessionId,
        includeRecordContext,
        record,
        objectApiName,
        recordId
      } = req.body as ChatRequest;

      if (!message || typeof message !== 'string') {
        console.log('🔍 [DEBUG] Response Status Code: 400 (Invalid message)');
        return res.status(400).json({
          error: 'Message is required and must be a string',
        });
      }

      // Validate record context if includeRecordContext is true
      let recordContext;
      if (includeRecordContext) {
        if (!record || !objectApiName || !recordId) {
          console.log('🔍 [DEBUG] Response Status Code: 400 (Missing record context)');
          return res.status(400).json({
            error: 'When includeRecordContext is true, record, objectApiName, and recordId are required',
          });
        }
        
        recordContext = {
          record,
          objectApiName,
          recordId
        };
        
        console.log(`📋 Including record context: ${objectApiName} (${recordId})`);
      }

      // Get Salesforce auth from middleware
      const salesforceAuth = req.salesforceAuth;

      // Get or create session
      const sessionId = providedSessionId || uuidv4();
      let session = sessionManager.getSession(sessionId);

      if (!session) {
        session = sessionManager.createSession(sessionId, salesforceAuth);
      } else if (salesforceAuth) {
        // Update session with current auth context
        sessionManager.updateSessionAuth(sessionId, salesforceAuth);
        session = sessionManager.getSession(sessionId)!;
      }

      // Update session with record context if provided
      if (recordContext) {
        session.recordContext = recordContext;
        sessionManager.updateSession(sessionId, session);
      }

      // Add user message to session
      session.messages.push({
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });

      // Get AI response with Salesforce auth context and record context
      console.log(`🔍 [DEBUG] Passing ${session.messages.length - 1} messages to AI service`);
      const aiResponse = await aiService.chat(
        session.messages.slice(0, -1), // Don't include the message we just added
        message,
        salesforceAuth,
        recordContext
      );

      // Add AI response to session
      session.messages.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      });

      // Update session
      sessionManager.updateSession(sessionId, session);

      // Send response
      const response: ChatResponse = {
        sessionId,
        message: aiResponse,
        timestamp: Date.now(),
      };

      // DEBUG: Log response status
      console.log('🔍 [DEBUG] Response Status Code: 200');
      console.log('🔍 [DEBUG] Response Body:', JSON.stringify(response, null, 2));

      res.json(response);
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('access')) {
          console.log('🔍 [DEBUG] Response Status Code: 403');
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions for this operation',
            details: error.message,
          });
        }
      }
      
      console.log('🔍 [DEBUG] Response Status Code: 500');
      res.status(500).json({
        error: 'An error occurred processing your request',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/chat/:sessionId - Get chat history
  router.get('/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
        });
      }

      res.json({
        sessionId: session.sessionId,
        messages: session.messages,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
      });
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({
        error: 'An error occurred retrieving chat history',
      });
    }
  });

  // DELETE /api/chat/:sessionId - Clear chat session
  router.delete('/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      sessionManager.deleteSession(sessionId);

      res.json({
        success: true,
        message: 'Session cleared',
      });
    } catch (error) {
      console.error('Error clearing session:', error);
      res.status(500).json({
        error: 'An error occurred clearing the session',
      });
    }
  });

  return router;
}
