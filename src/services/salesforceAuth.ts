import axios, { AxiosError } from 'axios';
import { SalesforceUserInfo, SalesforceAuth } from '../types/index.js';

interface TokenCacheEntry {
  userInfo: SalesforceUserInfo;
  validatedAt: number;
}

interface SalesforceUserInfoResponse {
  user_id: string;
  organization_id: string;
  preferred_username?: string;
  email?: string;
  name?: string;
}

export class SalesforceAuthService {
  private tokenCache: Map<string, TokenCacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private tokenValidationTTL: number = 300000) {
    // Clean up expired cache entries every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpiredTokens(), 60000);
  }

  /**
   * Validate a Salesforce access token and return user information
   * Uses caching to avoid excessive API calls to Salesforce
   */
  async validateToken(
    accessToken: string,
    instanceUrl: string
  ): Promise<SalesforceAuth> {
    // Check cache first
    const cacheKey = this.getCacheKey(accessToken, instanceUrl);
    const cached = this.tokenCache.get(cacheKey);

    if (cached && this.isCacheValid(cached.validatedAt)) {
      console.log('Using cached token validation');
      return {
        accessToken: this.maskToken(accessToken),
        instanceUrl,
        userInfo: cached.userInfo,
        validatedAt: cached.validatedAt,
      };
    }

    // Validate token by calling Salesforce userinfo endpoint
    try {
      console.log(`Validating Salesforce token for instance: ${instanceUrl}`);
      
      const response = await axios.get<SalesforceUserInfoResponse>(
        `${instanceUrl}/services/oauth2/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        }
      );

      const userInfo: SalesforceUserInfo = {
        userId: response.data.user_id,
        username: response.data.preferred_username || response.data.email || 'unknown',
        organizationId: response.data.organization_id,
        email: response.data.email,
        displayName: response.data.name,
      };

      // Cache the result
      const validatedAt = Date.now();
      this.tokenCache.set(cacheKey, {
        userInfo,
        validatedAt,
      });

      console.log(`✓ Token validated for user: ${userInfo.username} (${userInfo.userId})`);

      return {
        accessToken: this.maskToken(accessToken),
        instanceUrl,
        userInfo,
        validatedAt,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 401) {
          throw new Error('Invalid or expired Salesforce access token');
        }
        
        if (axiosError.response?.status === 403) {
          throw new Error('Insufficient permissions for Salesforce access token');
        }

        console.error('Salesforce token validation error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        throw new Error(
          `Failed to validate Salesforce token: ${axiosError.message}`
        );
      }

      console.error('Unexpected error validating token:', error);
      throw new Error('Failed to validate Salesforce token');
    }
  }

  /**
   * Invalidate a specific token in the cache
   */
  invalidateToken(accessToken: string, instanceUrl: string): void {
    const cacheKey = this.getCacheKey(accessToken, instanceUrl);
    this.tokenCache.delete(cacheKey);
  }

  /**
   * Clear all cached tokens
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Mask the access token for logging (show only first/last 4 chars)
   */
  maskToken(token: string): string {
    if (!token || token.length < 8) {
      return '****';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Get the full token from a potentially masked token
   * This is a helper for getting the original token back
   */
  getOriginalToken(maskedToken: string, fullToken: string): string {
    // If the token is already masked, we can't recover it
    // In practice, we should keep the original token separately
    return fullToken;
  }

  /**
   * Check if a cached entry is still valid
   */
  private isCacheValid(validatedAt: number): boolean {
    return Date.now() - validatedAt < this.tokenValidationTTL;
  }

  /**
   * Generate cache key from token and instance URL
   */
  private getCacheKey(accessToken: string, instanceUrl: string): string {
    // Use a hash or combination of token + instanceUrl
    // For simplicity, we'll use the last portion of the token + instanceUrl
    const tokenKey = accessToken.substring(Math.max(0, accessToken.length - 20));
    return `${tokenKey}:${instanceUrl}`;
  }

  /**
   * Clean up expired tokens from cache
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.tokenCache.entries()) {
      if (now - entry.validatedAt > this.tokenValidationTTL) {
        this.tokenCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired token cache entries`);
    }
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.tokenCache.clear();
  }
}
