/**
 * Sync Engine Service
 *
 * Manages WebSocket connections and message synchronization.
 */

import type { ISyncEngine } from './interfaces';

/**
 * Connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/**
 * Message handler type
 */
type MessageHandler = (message: unknown) => void;

/**
 * In-memory queue for offline operations
 */
interface OfflineQueue {
  operations: unknown[];
  maxSize: number;
}

/**
 * Sync Engine Implementation
 */
export class SyncEngine implements ISyncEngine {
  private connection: ConnectionState = 'disconnected';
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null;
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private offlineQueue: OfflineQueue = {
    operations: [],
    maxSize: 100,
  };
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  /**
   * Connect to the sync server
   */
  async connect(sessionId: string, userId: string): Promise<void> {
    if (this.connection === 'connected') {
      await this.disconnect();
    }

    this.currentSessionId = sessionId;
    this.currentUserId = userId;
    this.connection = 'connecting';

    try {
      // In production, establish actual WebSocket connection
      // For now, simulate connection
      await this.simulateConnect(sessionId);

      this.connection = 'connected';
      this.reconnectDelay = 1000;

      // Process queued offline operations
      await this.processOfflineQueue();

      console.log(`[SyncEngine] Connected to session ${sessionId} as user ${userId}`);
    } catch (error) {
      this.connection = 'disconnected';
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from the sync server
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connection = 'disconnected';
    this.currentSessionId = null;
    this.currentUserId = null;
  }

  /**
   * Send a message
   */
  async send(message: unknown): Promise<void> {
    if (this.connection !== 'connected') {
      // Queue message for later
      this.addToOfflineQueue(message);
      return;
    }

    try {
      // In production, send via WebSocket
      // this.ws?.send(JSON.stringify(message));

      console.log('[SyncEngine] Sent:', message);
    } catch (error) {
      // Queue on failure
      this.addToOfflineQueue(message);
      throw error;
    }
  }

  /**
   * Subscribe to messages
   */
  subscribe(callback: (message: unknown) => void): void {
    this.handlers.push(callback);
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(callback: (message: unknown) => void): void {
    const index = this.handlers.indexOf(callback);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Request a sync
   */
  async requestSync(fromVersion: number): Promise<void> {
    await this.send({
      type: 'sync_request',
      sessionId: this.currentSessionId,
      userId: this.currentUserId,
      fromVersion,
      timestamp: Date.now(),
    });
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connection === 'connected';
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connection;
  }

  /**
   * Get current session info
   */
  getSessionInfo(): { sessionId: string | null; userId: string | null } {
    return {
      sessionId: this.currentSessionId,
      userId: this.currentUserId,
    };
  }

  /**
   * Handle received message
   */
  private handleMessage(message: unknown): void {
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('[SyncEngine] Handler error:', error);
      }
    }
  }

  /**
   * Add message to offline queue
   */
  private addToOfflineQueue(message: unknown): void {
    this.offlineQueue.operations.push(message);

    // Limit queue size
    if (this.offlineQueue.operations.length > this.offlineQueue.maxSize) {
      this.offlineQueue.operations.shift();
    }

    console.log('[SyncEngine] Queued message (offline):', message);
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    while (this.offlineQueue.operations.length > 0) {
      const message = this.offlineQueue.operations.shift();
      if (message) {
        try {
          await this.send(message);
        } catch (error) {
          // Re-queue on failure
          this.offlineQueue.operations.unshift(message);
          break;
        }
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    console.log(`[SyncEngine] Scheduling reconnect in ${this.reconnectDelay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      if (this.currentSessionId && this.currentUserId) {
        try {
          await this.connect(this.currentSessionId, this.currentUserId);
        } catch (error) {
          // Exponential backoff
          this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            this.maxReconnectDelay
          );
          this.scheduleReconnect();
        }
      }
    }, this.reconnectDelay);
  }

  /**
   * Simulate connection (for development)
   */
  private async simulateConnect(sessionId: string): Promise<void> {
    // In production, this would establish actual WebSocket connection
    return new Promise((resolve) => {
      setTimeout(resolve, 100);

      // Simulate incoming messages
      setInterval(() => {
        if (this.isConnected()) {
          // Simulate periodic sync messages
          this.handleMessage({
            type: 'sync_response',
            sessionId,
            operations: [],
            currentVersion: 0,
          });
        }
      }, 5000);
    });
  }

  /**
   * Get offline queue size
   */
  getOfflineQueueSize(): number {
    return this.offlineQueue.operations.length;
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    this.offlineQueue.operations = [];
  }

  /**
   * Set reconnect delay
   */
  setReconnectDelay(delay: number): void {
    this.reconnectDelay = Math.min(Math.max(delay, 1000), this.maxReconnectDelay);
  }

  /**
   * Get current reconnect delay
   */
  getReconnectDelay(): number {
    return this.reconnectDelay;
  }

  /**
   * Force reconnection
   */
  async forceReconnect(): Promise<void> {
    await this.disconnect();

    if (this.currentSessionId && this.currentUserId) {
      await this.connect(this.currentSessionId, this.currentUserId);
    }
  }

  /**
   * Enable offline mode
   */
  enableOfflineMode(): void {
    this.connection = 'disconnected';
    console.log('[SyncEngine] Offline mode enabled');
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    state: ConnectionState;
    reconnectDelay: number;
    queuedMessages: number;
    handlerCount: number;
  } {
    return {
      state: this.connection,
      reconnectDelay: this.reconnectDelay,
      queuedMessages: this.offlineQueue.operations.length,
      handlerCount: this.handlers.length,
    };
  }
}

// Export singleton instance
export const syncEngine = new SyncEngine();
