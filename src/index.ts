import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadConfig, Config } from './config/config.js';
import { MCPClientService } from './services/mcpClient.js';
import { IAIService } from './services/base/AIServiceBase.js';
import { AIServiceFactory } from './services/AIServiceFactory.js';
import { SessionManager } from './services/sessionManager.js';
import { SalesforceAuthService } from './services/salesforceAuth.js';
import { createChatRouter } from './routes/chat.js';

// Load environment variables
dotenv.config();

class BridgeServer {
  private app: Express;
  private config: Config;
  private mcpClient: MCPClientService;
  private aiService: IAIService;
  private sessionManager: SessionManager;
  private salesforceAuthService: SalesforceAuthService;

  constructor() {
    this.config = loadConfig();
    this.app = express();
    this.mcpClient = new MCPClientService(this.config);
    
    // Create AI service using factory pattern
    this.aiService = AIServiceFactory.createAIService(this.config, this.mcpClient);
    
    this.sessionManager = new SessionManager(this.config.sessionTimeoutMs);
    this.salesforceAuthService = new SalesforceAuthService(
      this.config.salesforceTokenValidationTTL
    );
  }

  private setupMiddleware(): void {
    // CORS configuration - allow Salesforce domains
    const allowedOrigins = [
      ...this.config.allowedOrigins,
      // Add Salesforce domains if not using wildcard
      ...(this.config.allowedOrigins.includes('*') ? [] : [
        'https://*.lightning.force.com',
        'https://*.cloudforce.com',
        'https://*.salesforce.com',
        'https://*.visualforce.com',
      ]),
    ];

    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, etc.)
          if (!origin) return callback(null, true);

          // Check if origin matches allowed patterns
          const isAllowed = allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed.includes('*')) {
              // Convert wildcard pattern to regex
              const pattern = allowed.replace(/\*/g, '.*');
              return new RegExp(`^${pattern}$`).test(origin);
            }
            return allowed === origin;
          });

          if (isAllowed) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        exposedHeaders: ['X-Session-ID'],
      })
    );

    // Body parser
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging - mask sensitive headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const sanitizedHeaders = { ...req.headers };
      if (sanitizedHeaders['x-salesforce-session']) {
        const token = sanitizedHeaders['x-salesforce-session'] as string;
        sanitizedHeaders['x-salesforce-session'] = this.salesforceAuthService.maskToken(token);
      }
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        mcpConnected: this.mcpClient.isConnected(),
        aiProvider: this.aiService.getProviderName(),
        aiModel: this.aiService.getModelName(),
        authRequired: this.config.requireSalesforceAuth,
        authMethod: this.config.requireSalesforceAuth ? 'salesforce-oauth' : 'none',
      });
    });

    // Chat routes
    this.app.use(
      '/api/chat',
      createChatRouter(
        this.sessionManager,
        this.aiService,
        this.config,
        this.salesforceAuthService
      )
    );

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  async start(): Promise<void> {
    try {
      console.log('Starting Salesforce AI Bridge Server...');
      console.log(`Environment: ${this.config.nodeEnv}`);

      // Connect to MCP server
      await this.mcpClient.connect();

      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();

      // Start Express server
      this.app.listen(this.config.port, () => {
        console.log(`\n✓ Server running on port ${this.config.port}`);
        console.log(`  Health check: http://localhost:${this.config.port}/health`);
        console.log(`  Chat API: http://localhost:${this.config.port}/api/chat`);
        console.log('\nReady to handle requests!\n');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nShutting down gracefully...');
        await this.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\nShutting down gracefully...');
        await this.shutdown();
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    try {
      this.sessionManager.destroy();
      this.salesforceAuthService.destroy();
      await this.mcpClient.disconnect();
      console.log('Shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

// Start the server
const server = new BridgeServer();
server.start();
