import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager } from '../services/sessionManager.js';
import { IAIService } from '../services/base/AIServiceBase.js';
import { ChatRequest, ChatResponse } from '../types/index.js';

export function createChatRouter(
  sessionManager: SessionManager,
  aiService: IAIService
): Router {
  const router = Router();

  // POST /api/chat - Send a message and get AI response
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { message, sessionId: providedSessionId } = req.body as ChatRequest;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Message is required and must be a string',
        });
      }

      // Get or create session
      const sessionId = providedSessionId || uuidv4();
      let session = sessionManager.getSession(sessionId);

      if (!session) {
        session = sessionManager.createSession(sessionId);
      }

      // Add user message to session
      session.messages.push({
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });

      // Get AI response
      const aiResponse = await aiService.chat(
        session.messages.slice(0, -1), // Don't include the message we just added
        message
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

      res.json(response);
    } catch (error) {
      console.error('Error in chat endpoint:', error);
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
