/**
 * GitHub API Client
 * Provides methods for interacting with GitHub API for collaborative marketplace features
 */

import type {
  DEFAULT_GITHUB_API_CONFIG,
  Gist,
  GistFile,
  GitHubAPIConfig,
  GitHubUser,
  TemplateIndex,
} from '../types';
import { githubAuth } from './githubAuth';

/**
 * GitHub Issue structure
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  comments: number;
  reactions: {
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

/**
 * GitHub Issue Comment
 */
export interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  reactions: GitHubIssue['reactions'];
}

/**
 * GitHub API error
 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * GitHub API Client
 */
export class GitHubClient {
  private config: GitHubAPIConfig;
  private rateLimitRemaining = 5000;
  private rateLimitReset = 0;

  constructor(config?: Partial<GitHubAPIConfig>) {
    this.config = {
      clientId: config?.clientId || '',
      templateRepo: config?.templateRepo || 'midscene/templates',
      indexIssueNumber: config?.indexIssueNumber || 1,
      apiBaseUrl: config?.apiBaseUrl || 'https://api.github.com',
    };
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    const token = githubAuth.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    // Check rate limit
    if (this.rateLimitRemaining <= 0 && Date.now() < this.rateLimitReset) {
      throw new GitHubAPIError('Rate limit exceeded', 429, {
        resetAt: this.rateLimitReset,
      });
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.config.apiBaseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    // Update rate limit info
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    if (remaining) this.rateLimitRemaining = Number.parseInt(remaining, 10);
    if (reset) this.rateLimitReset = Number.parseInt(reset, 10) * 1000;

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new GitHubAPIError(
        error.message || `Request failed with status ${response.status}`,
        response.status,
        error,
      );
    }

    // Handle empty response
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // =====================
  // User Operations
  // =====================

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }

  // =====================
  // Gist Operations
  // =====================

  /**
   * Create a new Gist
   */
  async createGist(
    files: Record<string, { content: string }>,
    description: string,
    isPublic = true,
  ): Promise<Gist> {
    return this.request<Gist>('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description,
        public: isPublic,
        files,
      }),
    });
  }

  /**
   * Update an existing Gist
   */
  async updateGist(
    gistId: string,
    files: Record<string, { content: string } | null>,
    description?: string,
  ): Promise<Gist> {
    const body: Record<string, unknown> = { files };
    if (description !== undefined) {
      body.description = description;
    }

    return this.request<Gist>(`/gists/${gistId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get a Gist by ID
   */
  async getGist(gistId: string): Promise<Gist> {
    return this.request<Gist>(`/gists/${gistId}`);
  }

  /**
   * Delete a Gist
   */
  async deleteGist(gistId: string): Promise<void> {
    await this.request<void>(`/gists/${gistId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List Gists for the authenticated user
   */
  async listMyGists(page = 1, perPage = 30): Promise<Gist[]> {
    return this.request<Gist[]>(`/gists?page=${page}&per_page=${perPage}`);
  }

  /**
   * Star a Gist
   */
  async starGist(gistId: string): Promise<void> {
    await this.request<void>(`/gists/${gistId}/star`, {
      method: 'PUT',
    });
  }

  /**
   * Unstar a Gist
   */
  async unstarGist(gistId: string): Promise<void> {
    await this.request<void>(`/gists/${gistId}/star`, {
      method: 'DELETE',
    });
  }

  /**
   * Check if a Gist is starred
   */
  async isGistStarred(gistId: string): Promise<boolean> {
    try {
      await this.request<void>(`/gists/${gistId}/star`);
      return true;
    } catch (error) {
      if (error instanceof GitHubAPIError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  // =====================
  // Issue Operations
  // =====================

  /**
   * Get an issue from the template repository
   */
  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    const [owner, repo] = this.config.templateRepo.split('/');
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
    );
  }

  /**
   * Get the template index issue
   */
  async getIndexIssue(): Promise<GitHubIssue> {
    return this.getIssue(this.config.indexIssueNumber);
  }

  /**
   * Parse template index from issue body
   */
  async getTemplateIndex(): Promise<TemplateIndex> {
    const issue = await this.getIndexIssue();

    try {
      // Index is stored as JSON in the issue body
      const jsonMatch = issue.body.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try parsing the entire body as JSON
      return JSON.parse(issue.body);
    } catch (error) {
      console.error('Failed to parse template index:', error);
      return {
        version: '1.0.0',
        updatedAt: Date.now(),
        templates: [],
        categories: [],
      };
    }
  }

  /**
   * Create a comment on an issue
   */
  async createComment(
    issueNumber: number,
    body: string,
  ): Promise<GitHubComment> {
    const [owner, repo] = this.config.templateRepo.split('/');
    return this.request<GitHubComment>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    );
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: number, body: string): Promise<GitHubComment> {
    const [owner, repo] = this.config.templateRepo.split('/');
    return this.request<GitHubComment>(
      `/repos/${owner}/${repo}/issues/comments/${commentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      },
    );
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: number): Promise<void> {
    const [owner, repo] = this.config.templateRepo.split('/');
    await this.request<void>(
      `/repos/${owner}/${repo}/issues/comments/${commentId}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * List comments on an issue
   */
  async listComments(
    issueNumber: number,
    page = 1,
    perPage = 30,
  ): Promise<GitHubComment[]> {
    const [owner, repo] = this.config.templateRepo.split('/');
    return this.request<GitHubComment[]>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?page=${page}&per_page=${perPage}`,
    );
  }

  // =====================
  // Reaction Operations
  // =====================

  /**
   * Add a reaction to an issue
   */
  async addIssueReaction(
    issueNumber: number,
    reaction:
      | '+1'
      | '-1'
      | 'laugh'
      | 'confused'
      | 'heart'
      | 'hooray'
      | 'rocket'
      | 'eyes',
  ): Promise<void> {
    const [owner, repo] = this.config.templateRepo.split('/');
    await this.request<void>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.squirrel-girl-preview+json',
        },
        body: JSON.stringify({ content: reaction }),
      },
    );
  }

  /**
   * Add a reaction to a comment
   */
  async addCommentReaction(
    commentId: number,
    reaction:
      | '+1'
      | '-1'
      | 'laugh'
      | 'confused'
      | 'heart'
      | 'hooray'
      | 'rocket'
      | 'eyes',
  ): Promise<void> {
    const [owner, repo] = this.config.templateRepo.split('/');
    await this.request<void>(
      `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.squirrel-girl-preview+json',
        },
        body: JSON.stringify({ content: reaction }),
      },
    );
  }

  // =====================
  // Discussion Operations (for template submissions)
  // =====================

  /**
   * Create a discussion for template submission
   * Note: Requires GraphQL API
   */
  async createTemplateSubmission(
    title: string,
    body: string,
    categorySlug = 'template-submissions',
  ): Promise<{ id: string; url: string }> {
    // GitHub Discussions require GraphQL API
    const query = `
      mutation CreateDiscussion($input: CreateDiscussionInput!) {
        createDiscussion(input: $input) {
          discussion {
            id
            url
          }
        }
      }
    `;

    const [owner, repo] = this.config.templateRepo.split('/');

    // First, get the category ID
    const categoriesQuery = `
      query GetDiscussionCategories($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          discussionCategories(first: 10) {
            nodes {
              id
              slug
            }
          }
        }
      }
    `;

    const categoriesResult = await this.graphqlRequest<{
      repository: {
        id: string;
        discussionCategories: {
          nodes: Array<{ id: string; slug: string }>;
        };
      };
    }>(categoriesQuery, { owner, repo });

    const category =
      categoriesResult.repository.discussionCategories.nodes.find(
        (c) => c.slug === categorySlug,
      );

    if (!category) {
      throw new GitHubAPIError(
        `Discussion category "${categorySlug}" not found`,
        404,
      );
    }

    const result = await this.graphqlRequest<{
      createDiscussion: {
        discussion: { id: string; url: string };
      };
    }>(query, {
      input: {
        repositoryId: categoriesResult.repository.id,
        categoryId: category.id,
        title,
        body,
      },
    });

    return result.createDiscussion.discussion;
  }

  /**
   * Make a GraphQL request
   */
  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new GitHubAPIError(
        error.message ||
          `GraphQL request failed with status ${response.status}`,
        response.status,
        error,
      );
    }

    const result = await response.json();

    if (result.errors) {
      throw new GitHubAPIError(
        result.errors[0]?.message || 'GraphQL error',
        400,
        result.errors,
      );
    }

    return result.data;
  }

  // =====================
  // Utility Methods
  // =====================

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetAt: number } {
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitReset,
    };
  }

  /**
   * Configure the client
   */
  configure(config: Partial<GitHubAPIConfig>): void {
    if (config.clientId !== undefined) this.config.clientId = config.clientId;
    if (config.templateRepo !== undefined)
      this.config.templateRepo = config.templateRepo;
    if (config.indexIssueNumber !== undefined)
      this.config.indexIssueNumber = config.indexIssueNumber;
    if (config.apiBaseUrl !== undefined)
      this.config.apiBaseUrl = config.apiBaseUrl;
  }
}

// Export singleton instance
export const githubClient = new GitHubClient();
