import { ChatSession } from '../types/index.js';

export class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private timeoutMs: number) {
    // Clean up expired sessions every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 60000);
  }

  createSession(sessionId: string): ChatSession {
    const session: ChatSession = {
      sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): ChatSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    return session;
  }

  updateSession(sessionId: string, session: ChatSession): void {
    session.lastActivityAt = Date.now();
    this.sessions.set(sessionId, session);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > this.timeoutMs) {
        console.log(`Cleaning up expired session: ${sessionId}`);
        this.sessions.delete(sessionId);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}
