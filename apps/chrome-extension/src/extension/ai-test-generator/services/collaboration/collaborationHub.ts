/**
 * Collaboration Hub Service
 *
 * Manages real-time collaboration sessions.
 */

import type {
  CollaborationSession,
  Participant,
  CursorPosition,
  EditorOperation,
  EditorState,
} from '../../types/collaboration';
import type { ICollaborationHub } from './interfaces';
import { syncEngine } from './syncEngine';
import { ot } from './ot';

/**
 * Generate a color for a participant
 */
function generateParticipantColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Session storage
 */
interface SessionData {
  session: CollaborationSession;
  doc: string; // Current document state
  version: number; // Document version for OT
}

/**
 * In-memory storage for sessions
 * In production, this would be distributed across servers
 */
interface HubStorage {
  sessions: Map<string, SessionData>;
  byFile: Map<string, Set<string>>;
  sessionsByUser: Map<string, Set<string>>; // userId -> sessionIds
}

/**
 * Collaboration Hub Implementation
 */
export class CollaborationHub implements ICollaborationHub {
  private storage: HubStorage;

  constructor() {
    this.storage = {
      sessions: new Map(),
      byFile: new Map(),
      sessionsByUser: new Map(),
    };
  }

  /**
   * Join a collaboration session
   */
  async joinSession(
    fileId: string,
    userId: string
  ): Promise<CollaborationSession> {
    // Find or create session for this file
    let sessionData = this.findSessionByFile(fileId);

    if (!sessionData) {
      // Create new session
      const sessionId = this.generateId();
      const session: CollaborationSession = {
        id: sessionId,
        fileId,
        participants: [],
        state: {
          content: '',
          version: 0,
        },
        lastActivity: Date.now(),
      };

      sessionData = {
        session,
        doc: '',
        version: 0,
      };

      this.storage.sessions.set(sessionId, sessionData);
      this.addToIndex(this.storage.byFile, fileId, sessionId);
    }

    // Add participant if not already present
    const existingParticipant = sessionData.session.participants.find(
      (p) => p.userId === userId
    );

    if (!existingParticipant) {
      const participant: Participant = {
        userId,
        cursor: { line: 0, column: 0 },
        selection: {
          start: { line: 0, column: 0 },
          end: { line: 0, column: 0 },
        },
        color: generateParticipantColor(userId),
        lastSeen: Date.now(),
      };

      sessionData.session.participants.push(participant);
      this.addToIndex(this.storage.sessionsByUser, userId, sessionData.session.id);

      // Connect to sync engine
      await syncEngine.connect(sessionData.session.id, userId);
    }

    sessionData.session.lastActivity = Date.now();

    // Broadcast participant join
    await this.broadcast(sessionData.session.id, {
      type: 'participant_join',
      sessionId: sessionData.session.id,
      userId,
      timestamp: Date.now(),
    }, userId);

    return {
      ...sessionData.session,
      participants: [...sessionData.session.participants],
    };
  }

  /**
   * Leave a collaboration session
   */
  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const sessionData = this.storage.sessions.get(sessionId);
    if (!sessionData) {
      return;
    }

    // Remove participant
    const index = sessionData.session.participants.findIndex(
      (p) => p.userId === userId
    );

    if (index !== -1) {
      sessionData.session.participants.splice(index, 1);
      this.removeFromIndex(this.storage.sessionsByUser, userId, sessionId);

      // Disconnect from sync engine
      await syncEngine.disconnect();
    }

    // Clean up empty sessions
    if (sessionData.session.participants.length === 0) {
      this.storage.sessions.delete(sessionId);
      this.removeFromIndex(this.storage.byFile, sessionData.session.fileId, sessionId);
    } else {
      // Broadcast participant leave
      await this.broadcast(sessionId, {
        type: 'participant_leave',
        sessionId,
        userId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Send an editing operation
   */
  async sendOperation(
    sessionId: string,
    operation: EditorOperation
  ): Promise<void> {
    const sessionData = this.storage.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Apply operation through OT
    const transformed = await ot.transform(operation, sessionData.version);

    // Apply to document
    sessionData.doc = await ot.apply(sessionData.doc, transformed);
    sessionData.version++;
    transformed.version = sessionData.version;

    // Update session state
    sessionData.session.state = {
      content: sessionData.doc,
      version: sessionData.version,
    };
    sessionData.session.lastActivity = Date.now();

    // Broadcast to other participants
    await this.broadcast(sessionId, {
      type: 'operation',
      sessionId,
      userId: operation.userId,
      timestamp: Date.now(),
    } as unknown, operation.userId);
  }

  /**
   * Update cursor position
   */
  async updateCursor(
    sessionId: string,
    userId: string,
    cursor: CursorPosition,
    selection?: CursorPosition
  ): Promise<void> {
    const sessionData = this.storage.sessions.get(sessionId);
    if (!sessionData) {
      return;
    }

    const participant = sessionData.session.participants.find(
      (p) => p.userId === userId
    );

    if (participant) {
      participant.cursor = cursor;
      participant.lastSeen = Date.now();

      if (selection) {
        participant.selection = {
          start: cursor,
          end: selection,
        };
      }
    }

    // Broadcast cursor update
    await this.broadcast(sessionId, {
      type: 'cursor',
      sessionId,
      userId,
      timestamp: Date.now(),
    } as unknown, userId);
  }

  /**
   * Get participants in a session
   */
  async getParticipants(sessionId: string): Promise<Participant[]> {
    const sessionData = this.storage.sessions.get(sessionId);
    if (!sessionData) {
      return [];
    }

    // Filter out inactive participants
    const now = Date.now();
    const active = sessionData.session.participants.filter(
      (p) => now - p.lastSeen < 60000 // 1 minute timeout
    );

    return active.map((p) => ({ ...p }));
  }

  /**
   * Get current session state
   */
  async getSessionState(sessionId: string): Promise<EditorState> {
    const sessionData = this.storage.sessions.get(sessionId);
    if (!sessionData) {
      return {
        content: '',
        version: 0,
      };
    }

    return {
      ...sessionData.session.state,
    };
  }

  /**
   * Broadcast a message to all participants
   */
  async broadcast(
    sessionId: string,
    message: unknown,
    excludeUserId?: string
  ): Promise<void> {
    const sessionData = this.storage.sessions.get(sessionId);
    if (!sessionData) {
      return;
    }

    // In production, this would use WebSocket or similar
    // For now, we just log the broadcast
    console.log(`[CollaborationHub] Broadcast to session ${sessionId}:`, {
      message,
      exclude: excludeUserId,
      participants: sessionData.session.participants.length,
    });

    // Send through sync engine
    await syncEngine.send(message);
  }

  /**
   * Get session for a file
   */
  async getSessionByFile(fileId: string): Promise<CollaborationSession | null> {
    const sessionData = this.findSessionByFile(fileId);
    if (!sessionData) {
      return null;
    }

    return {
      ...sessionData.session,
      participants: [...sessionData.session.participants],
    };
  }

  /**
   * Get sessions for a user
   */
  async getUserSessions(userId: string): Promise<CollaborationSession[]> {
    const sessionIds = this.storage.sessionsByUser.get(userId);
    if (!sessionIds) {
      return [];
    }

    const sessions: CollaborationSession[] = [];
    for (const sessionId of sessionIds) {
      const sessionData = this.storage.sessions.get(sessionId);
      if (sessionData) {
        sessions.push({
          ...sessionData.session,
          participants: [...sessionData.session.participants],
        });
      }
    }

    return sessions;
  }

  /**
   * Remove inactive participants
   */
  async cleanupInactiveParticipants(): Promise<number> {
    let removed = 0;
    const now = Date.now();
    const timeout = 60000; // 1 minute

    for (const sessionData of this.storage.sessions.values()) {
      const active = sessionData.session.participants.filter(
        (p) => now - p.lastSeen < timeout
      );

      removed += sessionData.session.participants.length - active.length;
      sessionData.session.participants = active;
    }

    return removed;
  }

  /**
   * Find session by file
   */
  private findSessionByFile(fileId: string): SessionData | null {
    const sessionIds = this.storage.byFile.get(fileId);
    if (!sessionIds) {
      return null;
    }

    for (const sessionId of sessionIds) {
      const sessionData = this.storage.sessions.get(sessionId);
      if (sessionData && sessionData.session.participants.length > 0) {
        return sessionData;
      }
    }

    return null;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  /**
   * Remove from index
   */
  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.storage.sessions.clear();
    this.storage.byFile.clear();
    this.storage.sessionsByUser.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.sessions.size;
  }
}

// Export singleton instance
export const collaborationHub = new CollaborationHub();
