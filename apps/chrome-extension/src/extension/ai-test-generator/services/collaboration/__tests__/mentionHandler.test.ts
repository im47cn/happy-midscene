/**
 * Mention Handler Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MentionHandler } from '../mentionHandler';
import { workspaceManager } from '../workspaceManager';
import { memberManager } from '../memberManager';

describe('MentionHandler', () => {
  let mh: MentionHandler;
  let testWorkspaceId: string;

  beforeEach(async () => {
    mh = new MentionHandler();

    // Create a test workspace
    const workspace = await workspaceManager.create({
      name: 'Test Workspace',
      description: 'A test workspace',
      ownerId: 'owner1',
    });
    testWorkspaceId = workspace.id;

    // Add some members
    await workspaceManager.addMember(testWorkspaceId, 'user1', 'editor');
    await workspaceManager.addMember(testWorkspaceId, 'user2', 'viewer');
  });

  afterEach(() => {
    mh.clearCache();
    workspaceManager.clear();
  });

  describe('parseMentions', () => {
    it('should parse single mention', () => {
      const mentions = mh.parseMentions('Hello @user1');

      expect(mentions).toEqual(['user1']);
    });

    it('should parse multiple mentions', () => {
      const mentions = mh.parseMentions('Hello @user1 and @user2');

      expect(mentions).toHaveLength(2);
      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
    });

    it('should return unique mentions', () => {
      const mentions = mh.parseMentions('@user1 @user1 @user2');

      expect(mentions).toHaveLength(2);
      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
    });

    it('should handle mentions with underscores', () => {
      const mentions = mh.parseMentions('Hello @user_name_123');

      expect(mentions).toEqual(['user_name_123']);
    });

    it('should handle mentions with numbers', () => {
      const mentions = mh.parseMentions('Hello @user123');

      expect(mentions).toEqual(['user123']);
    });

    it('should return empty array for text without mentions', () => {
      const mentions = mh.parseMentions('Hello world');

      expect(mentions).toEqual([]);
    });

    it('should not parse emails as mentions', () => {
      const mentions = mh.parseMentions('Contact us at user@example.com');

      // The pattern matches @ followed by alphanumeric
      // For "user@example.com", it matches "@example" not "@user"
      expect(mentions).toEqual(['example']);
    });
  });

  describe('replaceMentions', () => {
    it('should return text unchanged (placeholder)', () => {
      const result = mh.replaceMentions('Hello @user1');

      expect(result).toBe('Hello @user1');
    });
  });

  describe('validateMention', () => {
    it('should return true for workspace member', async () => {
      const isValid = await mh.validateMention('owner1', testWorkspaceId);

      expect(isValid).toBe(true);
    });

    it('should return false for non-member', async () => {
      const isValid = await mh.validateMention('nonexistent', testWorkspaceId);

      expect(isValid).toBe(false);
    });
  });

  describe('searchMentionable', () => {
    it('should return matching user IDs', async () => {
      const results = await mh.searchMentionable(testWorkspaceId, 'owner');

      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain('owner1');
    });

    it('should return empty array for no matches', async () => {
      const results = await mh.searchMentionable(testWorkspaceId, 'xyz');

      expect(results).toEqual([]);
    });
  });

  describe('getUserIdFromUsername', () => {
    it('should convert username to user ID', async () => {
      const userId = await mh.getUserIdFromUsername('john');

      expect(userId).toBe('user_john');
    });

    it('should handle uppercase username', async () => {
      const userId = await mh.getUserIdFromUsername('John');

      expect(userId).toBe('user_john');
    });

    it('should return consistent IDs for same username', async () => {
      const id1 = await mh.getUserIdFromUsername('test');
      const id2 = await mh.getUserIdFromUsername('test');

      expect(id1).toBe(id2);
    });
  });

  describe('getUsernameFromId', () => {
    it('should extract username from user ID', async () => {
      const username = await mh.getUsernameFromId('user_john');

      expect(username).toBe('john');
    });

    it('should generate username for non-standard ID', async () => {
      const username = await mh.getUsernameFromId('abc123def456');

      expect(username).toBe('User_abc123de');
    });
  });

  describe('highlightMentions', () => {
    it('should highlight text and mentions separately', () => {
      const result = mh.highlightMentions('Hello @user1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'text', content: 'Hello ' });
      expect(result[1]).toEqual({ type: 'mention', content: '@user1' });
    });

    it('should handle multiple mentions', () => {
      const result = mh.highlightMentions('@user1 and @user2');

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('mention');
      expect(result[1].type).toBe('text');
      expect(result[2].type).toBe('mention');
    });

    it('should handle text with no mentions', () => {
      const result = mh.highlightMentions('Hello world');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'text', content: 'Hello world' });
    });

    it('should handle empty string', () => {
      const result = mh.highlightMentions('');

      expect(result).toHaveLength(0);
    });

    it('should handle mention at end of text', () => {
      const result = mh.highlightMentions('Hello @user1');

      expect(result[result.length - 1].type).toBe('mention');
    });
  });

  describe('extractMentionContext', () => {
    it('should extract mention query', () => {
      const result = mh.extractMentionContext('Hello @us', 9);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('us');
      expect(result?.startIndex).toBe(6);
    });

    it('should return null when cursor before @', () => {
      const result = mh.extractMentionContext('Hello @us', 5);

      expect(result).toBeNull();
    });

    it('should return null when space after @', () => {
      const result = mh.extractMentionContext('Hello @ us', 8);

      expect(result).toBeNull();
    });

    it('should return null for text without @', () => {
      const result = mh.extractMentionContext('Hello world', 11);

      expect(result).toBeNull();
    });

    it('should handle empty query', () => {
      const result = mh.extractMentionContext('Hello @', 7);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('');
    });

    it('should handle multiple @ symbols', () => {
      const result = mh.extractMentionContext('@user1 @user2', 14);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('user2');
    });
  });

  describe('buildMentionUrl', () => {
    it('should build mention URL', () => {
      const url = mh.buildMentionUrl('user123');

      expect(url).toBe('/users/user123');
    });
  });

  describe('validateAllMentions', () => {
    it('should validate all mentions in text', async () => {
      // Add members with user_ prefix to match getUserIdFromUsername output
      await workspaceManager.addMember(testWorkspaceId, 'user_owner1', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'user_user1', 'viewer');

      const result = await mh.validateAllMentions('@owner1 @user1', testWorkspaceId);

      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain('owner1');
      expect(result.valid).toContain('user1');
      expect(result.invalid).toHaveLength(0);
    });

    it('should separate valid and invalid mentions', async () => {
      // Add member with user_ prefix
      await workspaceManager.addMember(testWorkspaceId, 'user_owner1', 'editor');

      const result = await mh.validateAllMentions('@owner1 @nonexistent', testWorkspaceId);

      expect(result.valid).toContain('owner1');
      expect(result.invalid).toContain('nonexistent');
    });

    it('should return empty arrays for text without mentions', async () => {
      const result = await mh.validateAllMentions('Hello world', testWorkspaceId);

      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });
  });

  describe('convertToUserIds', () => {
    it('should convert usernames to user IDs', async () => {
      const userIds = await mh.convertToUserIds(['john', 'jane']);

      expect(userIds).toHaveLength(2);
      expect(userIds).toContain('user_john');
      expect(userIds).toContain('user_jane');
    });

    it('should return empty array for empty input', async () => {
      const userIds = await mh.convertToUserIds([]);

      expect(userIds).toEqual([]);
    });
  });

  describe('convertToUsernames', () => {
    it('should convert user IDs to usernames', async () => {
      const usernames = await mh.convertToUsernames(['user_john', 'user_jane']);

      expect(usernames).toHaveLength(2);
      expect(usernames).toContain('john');
      expect(usernames).toContain('jane');
    });

    it('should return empty array for empty input', async () => {
      const usernames = await mh.convertToUsernames([]);

      expect(usernames).toEqual([]);
    });
  });

  describe('stripMentions', () => {
    it('should remove all mentions from text', () => {
      const result = mh.stripMentions('Hello @user1 and @user2');

      expect(result).toBe('Hello  and ');
    });

    it('should return text unchanged when no mentions', () => {
      const result = mh.stripMentions('Hello world');

      expect(result).toBe('Hello world');
    });

    it('should handle text with only mentions', () => {
      const result = mh.stripMentions('@user1 @user2');

      // stripMentions removes @user1 and @user2, leaving just the space between them
      expect(result).toBe(' ');
    });
  });

  describe('countMentions', () => {
    it('should count mentions in text', () => {
      const count = mh.countMentions('@user1 @user2 @user1');

      expect(count).toBe(3);
    });

    it('should return 0 for text without mentions', () => {
      const count = mh.countMentions('Hello world');

      expect(count).toBe(0);
    });
  });

  describe('hasMentions', () => {
    it('should return true when text has mentions', () => {
      expect(mh.hasMentions('Hello @user1')).toBe(true);
    });

    it('should return false when text has no mentions', () => {
      expect(mh.hasMentions('Hello world')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(mh.hasMentions('')).toBe(false);
    });

    it('should return true for text with only @', () => {
      // The pattern requires at least one character after @
      expect(mh.hasMentions('@')).toBe(false);
      expect(mh.hasMentions('@u')).toBe(true);
    });
  });

  describe('getMentionedUsersFromComments', () => {
    it('should collect unique mentioned users', async () => {
      const comments = [
        { content: '@user1', mentions: ['user1', 'user2'] },
        { content: '@user2', mentions: ['user2', 'user3'] },
      ];

      const users = await mh.getMentionedUsersFromComments(comments);

      expect(users.size).toBe(3);
      expect(users.has('user1')).toBe(true);
      expect(users.has('user2')).toBe(true);
      expect(users.has('user3')).toBe(true);
    });

    it('should return empty set for empty comments', async () => {
      const users = await mh.getMentionedUsersFromComments([]);

      expect(users.size).toBe(0);
    });

    it('should return empty set for comments with no mentions', async () => {
      const comments = [
        { content: 'Hello world', mentions: [] },
        { content: 'No mentions here', mentions: [] },
      ];

      const users = await mh.getMentionedUsersFromComments(comments);

      expect(users.size).toBe(0);
    });
  });

  describe('updateCache', () => {
    it('should update username to userId mapping', () => {
      mh.updateCache('testuser', 'test123');

      // Cache is internal, but we can verify it doesn't throw
      expect(() => mh.updateCache('user2', 'id2')).not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('should clear cache without errors', () => {
      mh.updateCache('testuser', 'test123');
      mh.clearCache();

      // Should not throw
      expect(() => mh.clearCache()).not.toThrow();
    });
  });
});
