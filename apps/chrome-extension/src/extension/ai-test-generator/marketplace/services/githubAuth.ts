/**
 * GitHub Authentication Service
 * Handles OAuth authentication with GitHub for collaborative marketplace features
 */

import type { AuthState, GitHubUser, OAuthConfig } from '../types';

const AUTH_STORAGE_KEY = 'marketplace:auth';
const DEFAULT_SCOPES = ['gist', 'read:user', 'public_repo'];

/**
 * GitHub OAuth authentication service
 */
export class GitHubAuthService {
  private config: OAuthConfig;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    expiresAt: null,
  };
  private listeners: Set<(state: AuthState) => void> = new Set();

  constructor(config?: Partial<OAuthConfig>) {
    this.config = {
      clientId: config?.clientId || '',
      redirectUri: config?.redirectUri || this.getDefaultRedirectUri(),
      scopes: config?.scopes || DEFAULT_SCOPES,
    };

    // Restore auth state from storage
    this.restoreAuthState();
  }

  /**
   * Get default redirect URI for Chrome extension
   */
  private getDefaultRedirectUri(): string {
    // Chrome extension OAuth redirect
    if (typeof chrome !== 'undefined' && chrome.identity) {
      return chrome.identity.getRedirectURL('oauth2');
    }
    // Fallback for web
    return `${window.location.origin}/oauth/callback`;
  }

  /**
   * Restore authentication state from storage
   */
  private async restoreAuthState(): Promise<void> {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as AuthState;
        // Check if token is expired
        if (state.expiresAt && state.expiresAt > Date.now()) {
          this.authState = state;
          this.notifyListeners();
        } else {
          // Token expired, clear state
          this.clearAuthState();
        }
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
      this.clearAuthState();
    }
  }

  /**
   * Save authentication state to storage
   */
  private saveAuthState(): void {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.authState));
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  }

  /**
   * Clear authentication state
   */
  private clearAuthState(): void {
    this.authState = {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      expiresAt: null,
    };
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.notifyListeners();
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.authState);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.authState);
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && !!this.authState.accessToken;
  }

  /**
   * Get current user
   */
  getCurrentUser(): GitHubUser | null {
    return this.authState.user;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.authState.accessToken;
  }

  /**
   * Build OAuth authorization URL
   */
  private buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      allow_signup: 'true',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Login with GitHub OAuth
   * For Chrome extension, uses chrome.identity.launchWebAuthFlow
   * For web, opens a popup window
   */
  async login(): Promise<AuthState> {
    if (!this.config.clientId) {
      throw new Error('GitHub OAuth client ID is not configured');
    }

    const state = this.generateState();
    sessionStorage.setItem('oauth_state', state);

    const authUrl = this.buildAuthUrl(state);

    // Chrome extension flow
    if (typeof chrome !== 'undefined' && chrome.identity?.launchWebAuthFlow) {
      return this.loginWithChromeIdentity(authUrl);
    }

    // Web popup flow
    return this.loginWithPopup(authUrl);
  }

  /**
   * Login using Chrome identity API
   */
  private async loginWithChromeIdentity(authUrl: string): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        async (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!redirectUrl) {
            reject(new Error('No redirect URL received'));
            return;
          }

          try {
            const result = await this.handleOAuthCallback(redirectUrl);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Login using popup window
   */
  private async loginWithPopup(authUrl: string): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'github-oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
      );

      if (!popup) {
        reject(new Error('Failed to open popup window'));
        return;
      }

      // Listen for messages from popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth_callback') {
          window.removeEventListener('message', handleMessage);
          popup.close();

          try {
            const result = await this.handleOAuthCallback(event.data.url);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed without completing auth
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Authentication cancelled'));
        }
      }, 500);
    });
  }

  /**
   * Handle OAuth callback URL
   */
  private async handleOAuthCallback(callbackUrl: string): Promise<AuthState> {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Verify state
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid OAuth state');
    }
    sessionStorage.removeItem('oauth_state');

    // Exchange code for token
    // Note: In production, this should be done through a backend service
    // to protect the client secret
    const tokenData = await this.exchangeCodeForToken(code);

    // Get user info
    const user = await this.fetchUserInfo(tokenData.access_token);

    // Update auth state
    this.authState = {
      isAuthenticated: true,
      user,
      accessToken: tokenData.access_token,
      expiresAt: tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : Date.now() + 8 * 60 * 60 * 1000, // Default 8 hours
    };

    this.saveAuthState();
    this.notifyListeners();

    return this.authState;
  }

  /**
   * Exchange authorization code for access token
   * Note: In production, this should be done server-side
   */
  private async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    token_type: string;
    scope: string;
    expires_in?: number;
  }> {
    // For demo/development: Use a token exchange proxy or mock
    // In production: Call your backend service that handles token exchange
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          code,
          // Note: client_secret should never be in client-side code in production
          // This is a placeholder for development/demo purposes
        }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data;
  }

  /**
   * Fetch user information from GitHub API
   */
  private async fetchUserInfo(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  /**
   * Logout and clear authentication state
   */
  async logout(): Promise<void> {
    // Revoke token if possible
    if (this.authState.accessToken) {
      try {
        // GitHub doesn't support token revocation via API
        // In production, you might want to revoke via your backend
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }
    }

    this.clearAuthState();
  }

  /**
   * Refresh authentication (re-validate token)
   */
  async refresh(): Promise<AuthState> {
    if (!this.authState.accessToken) {
      return this.authState;
    }

    try {
      const user = await this.fetchUserInfo(this.authState.accessToken);
      this.authState.user = user;
      this.saveAuthState();
      this.notifyListeners();
    } catch (error) {
      // Token is invalid, clear state
      this.clearAuthState();
    }

    return this.authState;
  }

  /**
   * Set access token directly (for testing or manual token input)
   */
  async setAccessToken(token: string): Promise<AuthState> {
    try {
      const user = await this.fetchUserInfo(token);

      this.authState = {
        isAuthenticated: true,
        user,
        accessToken: token,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      };

      this.saveAuthState();
      this.notifyListeners();

      return this.authState;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Configure OAuth settings
   */
  configure(config: Partial<OAuthConfig>): void {
    if (config.clientId) this.config.clientId = config.clientId;
    if (config.redirectUri) this.config.redirectUri = config.redirectUri;
    if (config.scopes) this.config.scopes = config.scopes;
  }
}

// Export singleton instance
export const githubAuth = new GitHubAuthService();
