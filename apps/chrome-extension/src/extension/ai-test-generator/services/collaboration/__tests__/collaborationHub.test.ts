/**
 * Collaboration Hub Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CursorPosition,
  EditorOperation,
} from '../../types/collaboration';
import { CollaborationHub } from '../collaborationHub';
import { syncEngine } from '../syncEngine';

// Mock sync engine
vi.mock('../syncEngine', () => ({
  syncEngine: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
  },
}));

describe('CollaborationHub', () => {
  let hub: CollaborationHub;

  beforeEach(() => {
    hub = new CollaborationHub();
    vi.clearAllMocks();
  });

  afterEach(() => {
    hub.clear();
  });

  describe('joinSession', () => {
    it('should create a new session when none exists', async () => {
      const session = await hub.joinSession('file1', 'user1');

      expect(session.id).toBeDefined();
      expect(session.fileId).toBe('file1');
      expect(session.participants).toHaveLength(1);
      expect(session.participants[0].userId).toBe('user1');
    });

    it('should add participant to existing session', async () => {
      await hub.joinSession('file1', 'user1');
      const session = await hub.joinSession('file1', 'user2');

      expect(session.participants).toHaveLength(2);
      expect(session.participants.some((p) => p.userId === 'user1')).toBe(true);
      expect(session.participants.some((p) => p.userId === 'user2')).toBe(true);
    });

    it('should not duplicate participant', async () => {
      await hub.joinSession('file1', 'user1');
      const session = await hub.joinSession('file1', 'user1');

      expect(session.participants).toHaveLength(1);
    });

    it('should assign color to participant', async () => {
      const session = await hub.joinSession('file1', 'user1');

      expect(session.participants[0].color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should set default cursor position', async () => {
      const session = await hub.joinSession('file1', 'user1');

      expect(session.participants[0].cursor).toEqual({ line: 0, column: 0 });
    });

    it('should set default selection', async () => {
      const session = await hub.joinSession('file1', 'user1');

      expect(session.participants[0].selection).toEqual({
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
      });
    });

    it('should connect to sync engine', async () => {
      await hub.joinSession('file1', 'user1');

      expect(syncEngine.connect).toHaveBeenCalled();
    });

    it('should update last activity timestamp', async () => {
      const before = Date.now();
      const session = await hub.joinSession('file1', 'user1');

      expect(session.lastActivity).toBeGreaterThanOrEqual(before);
    });

    it('should create separate sessions for different files', async () => {
      const session1 = await hub.joinSession('file1', 'user1');
      const session2 = await hub.joinSession('file2', 'user1');

      expect(session1.id).not.toBe(session2.id);
      expect(session1.fileId).toBe('file1');
      expect(session2.fileId).toBe('file2');
    });
  });

  describe('leaveSession', () => {
    it('should remove participant from session', async () => {
      const session = await hub.joinSession('file1', 'user1');
      await hub.joinSession('file1', 'user2');

      await hub.leaveSession(session.id, 'user1');

      const remaining = await hub.getParticipants(session.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].userId).toBe('user2');
    });

    it('should disconnect from sync engine', async () => {
      const session = await hub.joinSession('file1', 'user1');

      await hub.leaveSession(session.id, 'user1');

      expect(syncEngine.disconnect).toHaveBeenCalled();
    });

    it('should clean up empty session', async () => {
      const session = await hub.joinSession('file1', 'user1');

      await hub.leaveSession(session.id, 'user1');

      expect(hub.size()).toBe(0);
    });

    it('should handle leaving non-existent session gracefully', async () => {
      await hub.leaveSession('non-existent', 'user1');
    });

    it('should handle leaving when participant not in session', async () => {
      const session = await hub.joinSession('file1', 'user1');

      await hub.leaveSession(session.id, 'user2');

      const participants = await hub.getParticipants(session.id);
      expect(participants).toHaveLength(1);
    });

    it('should keep session when other participants remain', async () => {
      const session = await hub.joinSession('file1', 'user1');
      await hub.joinSession('file1', 'user2');

      await hub.leaveSession(session.id, 'user1');

      expect(hub.size()).toBe(1);
    });
  });

  describe('sendOperation', () => {
    it('should apply insert operation', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const operation: EditorOperation = {
        type: 'insert',
        position: 0,
        content: 'Hello',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      await hub.sendOperation(session.id, operation);

      const state = await hub.getSessionState(session.id);
      expect(state.content).toBe('Hello');
    });

    it('should apply delete operation', async () => {
      const session = await hub.joinSession('file1', 'user1');

      // First insert content
      await hub.sendOperation(session.id, {
        type: 'insert',
        position: 0,
        content: 'Hello',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      // Then delete part of it
      await hub.sendOperation(session.id, {
        type: 'delete',
        position: 0,
        length: 2,
        userId: 'user1',
        timestamp: Date.now(),
        version: 2,
      });

      const state = await hub.getSessionState(session.id);
      expect(state.content).toBe('llo');
    });

    it('should increment version', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const operation: EditorOperation = {
        type: 'insert',
        position: 0,
        content: 'Test',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      await hub.sendOperation(session.id, operation);

      const state = await hub.getSessionState(session.id);
      expect(state.version).toBe(1);
    });

    it('should throw error for non-existent session', async () => {
      const operation: EditorOperation = {
        type: 'insert',
        position: 0,
        content: 'Test',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      await expect(
        hub.sendOperation('non-existent', operation),
      ).rejects.toThrow('Session not found');
    });

    it('should update session last activity', async () => {
      const session = await hub.joinSession('file1', 'user1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const operation: EditorOperation = {
        type: 'insert',
        position: 0,
        content: 'Test',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      await hub.sendOperation(session.id, operation);

      const updatedSession = await hub.getSessionByFile('file1');
      expect(updatedSession?.lastActivity).toBeGreaterThan(
        session.lastActivity,
      );
    });
  });

  describe('updateCursor', () => {
    it('should update participant cursor position', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const cursor: CursorPosition = { line: 5, column: 10 };
      await hub.updateCursor(session.id, 'user1', cursor);

      const participants = await hub.getParticipants(session.id);
      expect(participants[0].cursor).toEqual(cursor);
    });

    it('should update participant selection', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const cursor: CursorPosition = { line: 0, column: 0 };
      const selection: CursorPosition = { line: 0, column: 5 };

      await hub.updateCursor(session.id, 'user1', cursor, selection);

      const participants = await hub.getParticipants(session.id);
      expect(participants[0].selection).toEqual({
        start: cursor,
        end: selection,
      });
    });

    it('should update last seen timestamp', async () => {
      const session = await hub.joinSession('file1', 'user1');

      // Capture original timestamp before update
      const originalLastSeen = session.participants[0].lastSeen;

      // Ensure time passes before update
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cursor: CursorPosition = { line: 5, column: 10 };
      await hub.updateCursor(session.id, 'user1', cursor);

      const participants = await hub.getParticipants(session.id);
      expect(participants[0].lastSeen).toBeGreaterThan(originalLastSeen);
    });

    it('should handle non-existent session gracefully', async () => {
      const cursor: CursorPosition = { line: 5, column: 10 };

      await hub.updateCursor('non-existent', 'user1', cursor);
    });

    it('should handle non-existent participant gracefully', async () => {
      const session = await hub.joinSession('file1', 'user1');
      const cursor: CursorPosition = { line: 5, column: 10 };

      await hub.updateCursor(session.id, 'user2', cursor);
    });
  });

  describe('getParticipants', () => {
    it('should return all active participants', async () => {
      const session = await hub.joinSession('file1', 'user1');
      await hub.joinSession('file1', 'user2');

      const participants = await hub.getParticipants(session.id);

      expect(participants).toHaveLength(2);
    });

    it('should return empty array for non-existent session', async () => {
      const participants = await hub.getParticipants('non-existent');
      expect(participants).toEqual([]);
    });

    it('should filter out inactive participants', async () => {
      const session = await hub.joinSession('file1', 'user1');

      // Manually set participant as inactive (older than 1 minute)
      const internalParticipants = (await hub.getSessionByFile('file1'))
        ?.participants;
      if (internalParticipants) {
        internalParticipants[0].lastSeen = Date.now() - 70000;
      }

      const participants = await hub.getParticipants(session.id);

      expect(participants).toHaveLength(0);
    });

    it('should return participant copies not references', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const participants1 = await hub.getParticipants(session.id);
      const participants2 = await hub.getParticipants(session.id);

      expect(participants1).not.toBe(participants2);
    });
  });

  describe('getSessionState', () => {
    it('should return current session state', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const operation: EditorOperation = {
        type: 'insert',
        position: 0,
        content: 'Hello World',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      await hub.sendOperation(session.id, operation);

      const state = await hub.getSessionState(session.id);

      expect(state.content).toBe('Hello World');
      expect(state.version).toBe(1);
    });

    it('should return empty state for non-existent session', async () => {
      const state = await hub.getSessionState('non-existent');

      expect(state.content).toBe('');
      expect(state.version).toBe(0);
    });

    it('should return state copy not reference', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const state1 = await hub.getSessionState(session.id);
      const state2 = await hub.getSessionState(session.id);

      expect(state1).not.toBe(state2);
    });
  });

  describe('getSessionByFile', () => {
    it('should return session for file', async () => {
      const session = await hub.joinSession('file1', 'user1');

      const found = await hub.getSessionByFile('file1');

      expect(found).toBeDefined();
      expect(found?.id).toBe(session.id);
      expect(found?.fileId).toBe('file1');
    });

    it('should return null for file with no session', async () => {
      const found = await hub.getSessionByFile('non-existent');
      expect(found).toBeNull();
    });

    it('should return session with participants', async () => {
      await hub.joinSession('file1', 'user1');
      await hub.joinSession('file1', 'user2');

      const found = await hub.getSessionByFile('file1');

      expect(found?.participants).toHaveLength(2);
    });
  });

  describe('getUserSessions', () => {
    it('should return sessions for user', async () => {
      const session1 = await hub.joinSession('file1', 'user1');
      const session2 = await hub.joinSession('file2', 'user1');

      const sessions = await hub.getUserSessions('user1');

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain(session1.id);
      expect(sessions.map((s) => s.id)).toContain(session2.id);
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await hub.getUserSessions('non-existent');
      expect(sessions).toEqual([]);
    });

    it('should not include sessions from other users', async () => {
      await hub.joinSession('file1', 'user1');
      await hub.joinSession('file2', 'user2');

      const user1Sessions = await hub.getUserSessions('user1');
      const user2Sessions = await hub.getUserSessions('user2');

      expect(user1Sessions).toHaveLength(1);
      expect(user2Sessions).toHaveLength(1);
      expect(user1Sessions[0].fileId).toBe('file1');
      expect(user2Sessions[0].fileId).toBe('file2');
    });
  });

  describe('cleanupInactiveParticipants', () => {
    it('should remove inactive participants', async () => {
      const session = await hub.joinSession('file1', 'user1');
      await hub.joinSession('file1', 'user2');

      // Manually mark one participant as inactive
      const internalSession = await hub.getSessionByFile('file1');
      if (internalSession) {
        internalSession.participants[0].lastSeen = Date.now() - 70000;
      }

      const removed = await hub.cleanupInactiveParticipants();

      expect(removed).toBeGreaterThan(0);
    });

    it('should return count of removed participants', async () => {
      await hub.joinSession('file1', 'user1');
      await hub.joinSession('file1', 'user2');

      // Mark both as inactive
      const internalSession = await hub.getSessionByFile('file1');
      if (internalSession) {
        internalSession.participants[0].lastSeen = Date.now() - 70000;
        internalSession.participants[1].lastSeen = Date.now() - 70000;
      }

      const removed = await hub.cleanupInactiveParticipants();

      expect(removed).toBe(2);
    });

    it('should remove 0 when all participants active', async () => {
      await hub.joinSession('file1', 'user1');

      const removed = await hub.cleanupInactiveParticipants();

      expect(removed).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should send message through sync engine', async () => {
      const session = await hub.joinSession('file1', 'user1');

      await hub.broadcast(session.id, { type: 'test', data: 'message' });

      expect(syncEngine.send).toHaveBeenCalled();
    });

    it('should handle non-existent session gracefully', async () => {
      await hub.broadcast('non-existent', { type: 'test' });
    });
  });

  describe('clear', () => {
    it('should clear all storage', async () => {
      await hub.joinSession('file1', 'user1');
      await hub.joinSession('file2', 'user2');

      expect(hub.size()).toBe(2);

      hub.clear();

      expect(hub.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return number of sessions', () => {
      expect(hub.size()).toBe(0);
    });

    it('should increment on join', async () => {
      await hub.joinSession('file1', 'user1');

      expect(hub.size()).toBe(1);
    });

    it('should decrement when session becomes empty', async () => {
      const session = await hub.joinSession('file1', 'user1');

      await hub.leaveSession(session.id, 'user1');

      expect(hub.size()).toBe(0);
    });
  });
});
