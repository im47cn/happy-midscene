/**
 * GitLab API Client for Chrome Extension
 * Handles authentication, project management, and file commits
 */

export interface GitLabConfig {
  baseUrl: string;
  privateToken: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string;
  web_url: string;
}

export interface GitLabBranch {
  name: string;
  default: boolean;
  web_url: string;
}

export interface GitLabCommitResult {
  id: string;
  web_url: string;
  message: string;
}

const STORAGE_KEY = 'midscene-gitlab-config';

/**
 * Encrypt token for storage (basic obfuscation)
 * Note: For production, consider using chrome.storage.session or more robust encryption
 */
function encryptToken(token: string): string {
  return btoa(token);
}

function decryptToken(encrypted: string): string {
  try {
    return atob(encrypted);
  } catch {
    return encrypted;
  }
}

export class GitLabClient {
  private config: GitLabConfig | null = null;

  /**
   * Load configuration from chrome.storage.local
   */
  async loadConfig(): Promise<GitLabConfig | null> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (result[STORAGE_KEY]) {
            const stored = result[STORAGE_KEY];
            this.config = {
              baseUrl: stored.baseUrl,
              privateToken: decryptToken(stored.privateToken),
            };
            resolve(this.config);
          } else {
            resolve(null);
          }
        });
      } else {
        // Fallback to localStorage for development
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.config = {
            baseUrl: parsed.baseUrl,
            privateToken: decryptToken(parsed.privateToken),
          };
          resolve(this.config);
        } else {
          resolve(null);
        }
      }
    });
  }

  /**
   * Save configuration to chrome.storage.local
   */
  async saveConfig(config: GitLabConfig): Promise<void> {
    const toStore = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      privateToken: encryptToken(config.privateToken),
    };

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: toStore }, () => {
          this.config = config;
          resolve();
        });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
        this.config = config;
        resolve();
      }
    });
  }

  /**
   * Clear stored configuration
   */
  async clearConfig(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.remove([STORAGE_KEY], () => {
          this.config = null;
          resolve();
        });
      } else {
        localStorage.removeItem(STORAGE_KEY);
        this.config = null;
        resolve();
      }
    });
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    if (!this.config) {
      return { success: false, message: 'No configuration found' };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v4/user`, {
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
        },
      });

      if (response.ok) {
        const user = await response.json();
        return {
          success: true,
          message: `Connected as ${user.username}`,
          user: user.username,
        };
      }

      if (response.status === 401) {
        return { success: false, message: 'Invalid token or unauthorized' };
      }

      return { success: false, message: `API error: ${response.status}` };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Search projects accessible to the user
   */
  async searchProjects(query?: string): Promise<GitLabProject[]> {
    if (!this.config) {
      throw new Error('GitLab not configured');
    }

    const params = new URLSearchParams({
      membership: 'true',
      simple: 'true',
      per_page: '50',
      order_by: 'last_activity_at',
    });

    if (query) {
      params.set('search', query);
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects?${params}`,
      {
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get branches for a project
   */
  async getBranches(projectId: number): Promise<GitLabBranch[]> {
    if (!this.config) {
      throw new Error('GitLab not configured');
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}/repository/branches?per_page=100`,
      {
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch branches: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a new branch from a reference
   */
  async createBranch(
    projectId: number,
    branchName: string,
    ref: string
  ): Promise<GitLabBranch> {
    if (!this.config) {
      throw new Error('GitLab not configured');
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}/repository/branches`,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: branchName,
          ref: ref,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to create branch: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Commit a file to the repository
   */
  async commitFile(
    projectId: number,
    filePath: string,
    content: string,
    branch: string,
    commitMessage: string
  ): Promise<GitLabCommitResult> {
    if (!this.config) {
      throw new Error('GitLab not configured');
    }

    // Check if file exists first
    const encodedPath = encodeURIComponent(filePath);
    const checkResponse = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}/repository/files/${encodedPath}?ref=${branch}`,
      {
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
        },
      }
    );

    const fileExists = checkResponse.ok;
    const method = fileExists ? 'PUT' : 'POST';

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}/repository/files/${encodedPath}`,
      {
        method,
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch,
          content: btoa(unescape(encodeURIComponent(content))), // Base64 encode with UTF-8 support
          commit_message: commitMessage,
          encoding: 'base64',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to commit file: ${response.status}`);
    }

    const result = await response.json();

    // Construct web URL for the file
    const project = await this.getProject(projectId);
    const webUrl = `${project.web_url}/-/blob/${branch}/${filePath}`;

    return {
      id: result.commit_id || result.file_path,
      web_url: webUrl,
      message: commitMessage,
    };
  }

  /**
   * Get project details
   */
  async getProject(projectId: number): Promise<GitLabProject> {
    if (!this.config) {
      throw new Error('GitLab not configured');
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v4/projects/${projectId}`,
      {
        headers: {
          'PRIVATE-TOKEN': this.config.privateToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Get current config (without token)
   */
  getConfigInfo(): { baseUrl: string } | null {
    if (!this.config) return null;
    return { baseUrl: this.config.baseUrl };
  }
}

// Singleton instance
export const gitlabClient = new GitLabClient();
