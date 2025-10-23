export type AIProvider = 'anthropic' | 'openrouter' | 'perplexity';

export interface Config {
  port: number;
  nodeEnv: string;
  aiProvider: AIProvider;
  // Anthropic configuration
  anthropicApiKey: string;
  anthropicModel: string;
  // Perplexity configuration
  perplexityApiKey: string;
  perplexityModel: string;
  // OpenRouter configuration
  openRouterApiKey: string;
  openRouterModel: string;
  openRouterAppName: string;
  openRouterSiteUrl: string;
  // MCP configuration
  mcpServerUrl: string;
  allowedOrigins: string[];
  sessionTimeoutMs: number;
  // Salesforce Auth configuration
  requireSalesforceAuth: boolean;
  salesforceTokenValidationTTL: number;
  userRateLimitPerMinute: number;
}

export function loadConfig(): Config {
  const aiProvider = (process.env.AI_PROVIDER || 'openrouter') as AIProvider;
  
  // Validate AI provider selection
  if (!['anthropic', 'openrouter', 'perplexity'].includes(aiProvider)) {
    throw new Error('AI_PROVIDER must be one of "anthropic", "openrouter", or "perplexity"');
  }

  // Check required API key based on provider
  if (aiProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
  }
  
  if (aiProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter');
  }
  
  if (aiProvider === 'perplexity' && !process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is required when AI_PROVIDER=perplexity');
  }

  // Validate MCP server URL
  if (!process.env.MCP_SERVER_URL) {
    throw new Error('MCP_SERVER_URL is required');
  }

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    aiProvider,
    // Anthropic config
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  // Perplexity config
  perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
  perplexityModel: process.env.PERPLEXITY_MODEL || 'perplexity-1.0',
    // OpenRouter config
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'nousresearch/deepseek-r1t2-chimera:free',
    openRouterAppName: process.env.OPENROUTER_APP_NAME || 'Salesforce-AI-Bridge',
    openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || 'http://localhost:3001',
    // MCP config
    mcpServerUrl: process.env.MCP_SERVER_URL,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10),
    // Salesforce Auth config
    requireSalesforceAuth: process.env.REQUIRE_SALESFORCE_AUTH === 'true',
    salesforceTokenValidationTTL: parseInt(process.env.SALESFORCE_TOKEN_VALIDATION_TTL || '300000', 10),
    userRateLimitPerMinute: parseInt(process.env.USER_RATE_LIMIT_PER_MINUTE || '10', 10),
  };
}
