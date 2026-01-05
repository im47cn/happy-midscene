/**
 * Mention Handler Service
 *
 * Manages @mentions in comments and notifications.
 */

import type { IMentionHandler } from './interfaces';
import { memberManager } from './memberManager';

/**
 * Mention pattern for parsing @mentions
 * Matches @username where username is alphanumeric with underscores
 */
const MENTION_PATTERN = /@([a-zA-Z0-9_]+)/g;

/**
 * User cache for quick mention lookups
 */
interface UserCache {
  byUsername: Map<string, string>; // username -> userId
  byId: Map<string, string>; // userId -> username
  lastUpdated: number;
}

/**
 * Mention Handler Implementation
 */
export class MentionHandler implements IMentionHandler {
  private cache: UserCache;
  private cacheTTL = 300000; // 5 minutes

  constructor() {
    this.cache = {
      byUsername: new Map(),
      byId: new Map(),
      lastUpdated: 0,
    };
  }

  /**
   * Parse mentions from text
   */
  parseMentions(text: string): string[] {
    const matches = text.matchAll(MENTION_PATTERN);
    const usernames = new Set<string>();

    for (const match of matches) {
      usernames.add(match[1]);
    }

    return Array.from(usernames);
  }

  /**
   * Replace mentions with display text
   */
  replaceMentions(text: string): string {
    return text.replace(MENTION_PATTERN, (match) => {
      return match; // In production, could link to user profile
    });
  }

  /**
   * Validate a mention
   */
  async validateMention(userId: string, workspaceId: string): Promise<boolean> {
    const isMember = await memberManager.isMember(workspaceId, userId);
    return isMember;
  }

  /**
   * Search for mentionable users
   */
  async searchMentionable(workspaceId: string, query: string): Promise<string[]> {
    const members = await memberManager.searchMembers(workspaceId, query);
    return members.map((m) => m.userId);
  }

  /**
   * Get user ID from username
   */
  async getUserIdFromUsername(username: string): Promise<string | null> {
    // In production, this would query a user service
    // For now, generate a deterministic ID from username
    return `user_${username.toLowerCase()}`;
  }

  /**
   * Get username from user ID
   */
  async getUsernameFromId(userId: string): Promise<string> {
    // In production, this would query a user service
    // For now, extract from ID or generate
    if (userId.startsWith('user_')) {
      return userId.slice(5);
    }
    return `User_${userId.substr(0, 8)}`;
  }

  /**
   * Highlight mentions in text (for UI rendering)
   */
  highlightMentions(text: string): Array<{
    type: 'text' | 'mention';
    content: string;
    userId?: string;
  }> {
    const result: Array<{
      type: 'text' | 'mention';
      content: string;
      userId?: string;
    }> = [];

    let lastIndex = 0;
    const matches = text.matchAll(MENTION_PATTERN);

    for (const match of matches) {
      // Add text before mention
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        });
      }

      // Add mention
      result.push({
        type: 'mention',
        content: match[0],
        userId: undefined, // Will be filled by caller
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return result;
  }

  /**
   * Extract mention suggestions as user types
   */
  extractMentionContext(text: string, cursorPosition: number): {
    query: string;
    startIndex: number;
  } | null {
    const beforeCursor = text.slice(0, cursorPosition);

    // Find the last @ before cursor
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex === -1) {
      return null;
    }

    // Check if there's a space between @ and cursor
    const sinceAt = beforeCursor.slice(atIndex + 1);
    if (sinceAt.includes(' ')) {
      return null;
    }

    return {
      query: sinceAt,
      startIndex: atIndex,
    };
  }

  /**
   * Build mention URL
   */
  buildMentionUrl(userId: string): string {
    return `/users/${userId}`;
  }

  /**
   * Validate all mentions in text
   */
  async validateAllMentions(
    text: string,
    workspaceId: string
  ): Promise<{
    valid: string[];
    invalid: string[];
  }> {
    const usernames = this.parseMentions(text);
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const username of usernames) {
      const userId = await this.getUserIdFromUsername(username);
      if (userId && await this.validateMention(userId, workspaceId)) {
        valid.push(username);
      } else {
        invalid.push(username);
      }
    }

    return { valid, invalid };
  }

  /**
   * Convert usernames to user IDs
   */
  async convertToUserIds(usernames: string[]): Promise<string[]> {
    const userIds: string[] = [];

    for (const username of usernames) {
      const userId = await this.getUserIdFromUsername(username);
      if (userId) {
        userIds.push(userId);
      }
    }

    return userIds;
  }

  /**
   * Convert user IDs to usernames
   */
  async convertToUsernames(userIds: string[]): Promise< string[]> {
    const usernames: string[] = [];

    for (const userId of userIds) {
      const username = await this.getUsernameFromId(userId);
      usernames.push(username);
    }

    return usernames;
  }

  /**
   * Strip mentions from text
   */
  stripMentions(text: string): string {
    return text.replace(MENTION_PATTERN, '');
  }

  /**
   * Get mention count in text
   */
  countMentions(text: string): number {
    const matches = text.match(MENTION_PATTERN);
    return matches ? matches.length : 0;
  }

  /**
   * Check if text contains mentions
   */
  hasMentions(text: string): boolean {
    return MENTION_PATTERN.test(text);
  }

  /**
   * Get all unique mentioned users from comments
   */
  async getMentionedUsersFromComments(
    comments: Array<{ content: string; mentions: string[] }>
  ): Promise<Set<string>> {
    const mentionedUsers = new Set<string>();

    for (const comment of comments) {
      for (const userId of comment.mentions) {
        mentionedUsers.add(userId);
      }
    }

    return mentionedUsers;
  }

  /**
   * Update cache (for testing)
   */
  updateCache(username: string, userId: string): void {
    this.cache.byUsername.set(username, userId);
    this.cache.byId.set(userId, username);
    this.cache.lastUpdated = Date.now();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.byUsername.clear();
    this.cache.byId.clear();
    this.cache.lastUpdated = 0;
  }
}

// Export singleton instance
export const mentionHandler = new MentionHandler();
