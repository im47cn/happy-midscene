/**
 * Comment Notifier Service
 *
 * Handles notifications for comments and mentions.
 */

import type { Comment } from '../../types/collaboration';

/**
 * Notification types
 */
export type NotificationType =
  | 'comment_added'
  | 'comment_replied'
  | 'comment_resolved'
  | 'mentioned';

/**
 * Notification data
 */
export interface Notification {
  id: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  commentId: string;
  reviewId?: string;
  fileId: string;
  createdBy: string;
  createdAt: number;
  read: boolean;
  actionUrl?: string;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  mentions: boolean;
  replies: boolean;
  resolves: boolean;
}

/**
 * In-memory storage for notifications
 * In production, this would be replaced with a database
 */
interface NotificationStorage {
  notifications: Map<string, Notification>;
  byUser: Map<string, Set<string>>;
  preferences: Map<string, NotificationPreferences>;
}

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: false,
  inApp: true,
  mentions: true,
  replies: true,
  resolves: false,
};

/**
 * Comment Notifier Service
 */
export class CommentNotifier {
  private storage: NotificationStorage;

  constructor() {
    this.storage = {
      notifications: new Map(),
      byUser: new Map(),
      preferences: new Map(),
    };
  }

  /**
   * Notify when a comment is added
   */
  async notifyCommentAdded(comment: Comment): Promise<void> {
    // Notify mentioned users
    for (const userId of comment.mentions) {
      if (userId !== comment.author) {
        await this.createNotification({
          type: 'mentioned',
          userId,
          title: 'You were mentioned',
          message: `${comment.author} mentioned you in a comment`,
          commentId: comment.id,
          reviewId: comment.reviewId,
          fileId: comment.fileId,
          createdBy: comment.author,
        });
      }
    }

    // In production, also send to subscribers of the file/review
  }

  /**
   * Notify when a comment is replied to
   */
  async notifyCommentReply(
    parentComment: Comment,
    reply: Comment,
  ): Promise<void> {
    if (parentComment.author === reply.author) {
      return; // Don't notify for self-replies
    }

    await this.createNotification({
      type: 'comment_replied',
      userId: parentComment.author,
      title: 'New reply to your comment',
      message: `${reply.author} replied to your comment`,
      commentId: reply.id,
      reviewId: reply.reviewId,
      fileId: reply.fileId,
      createdBy: reply.author,
    });
  }

  /**
   * Notify when a comment is resolved
   */
  async notifyCommentResolved(
    comment: Comment,
    resolvedBy: string,
  ): Promise<void> {
    if (comment.author === resolvedBy) {
      return; // Don't notify for self-resolution
    }

    await this.createNotification({
      type: 'comment_resolved',
      userId: comment.author,
      title: 'Comment resolved',
      message: `Your comment was resolved`,
      commentId: comment.id,
      reviewId: comment.reviewId,
      fileId: comment.fileId,
      createdBy: resolvedBy,
    });
  }

  /**
   * Create a notification
   */
  async createNotification(
    data: Omit<Notification, 'id' | 'createdAt' | 'read'>,
  ): Promise<Notification> {
    const id = this.generateId();
    const now = Date.now();

    const notification: Notification = {
      id,
      ...data,
      createdAt: now,
      read: false,
    };

    this.storage.notifications.set(id, notification);
    this.addToIndex(this.storage.byUser, data.userId, id);

    // Send in-app notification
    const prefs = this.getPreferences(data.userId);
    if (prefs.inApp) {
      // In production, would send via WebSocket or push notification
      console.log(
        `[CommentNotifier] In-app notification for ${data.userId}:`,
        data.title,
      );
    }

    // Send email notification
    if (prefs.email) {
      await this.sendEmailNotification(notification);
    }

    return notification;
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    unreadOnly = false,
  ): Promise<Notification[]> {
    const notificationIds = this.storage.byUser.get(userId);
    if (!notificationIds) {
      return [];
    }

    const notifications: Notification[] = [];
    for (const id of notificationIds) {
      const notification = this.storage.notifications.get(id);
      if (notification && (!unreadOnly || !notification.read)) {
        notifications.push({ ...notification });
      }
    }

    return notifications.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.storage.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Mark all notifications for a user as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const notificationIds = this.storage.byUser.get(userId);
    if (notificationIds) {
      for (const id of notificationIds) {
        const notification = this.storage.notifications.get(id);
        if (notification) {
          notification.read = true;
        }
      }
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getNotifications(userId, true);
    return notifications.length;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const notification = this.storage.notifications.get(notificationId);
    if (notification) {
      this.storage.notifications.delete(notificationId);
      this.removeFromIndex(
        this.storage.byUser,
        notification.userId,
        notificationId,
      );
    }
  }

  /**
   * Get user notification preferences
   */
  getPreferences(userId: string): NotificationPreferences {
    if (!this.storage.preferences.has(userId)) {
      this.storage.preferences.set(userId, { ...DEFAULT_PREFERENCES });
    }
    return { ...this.storage.preferences.get(userId)! };
  }

  /**
   * Update user notification preferences
   */
  updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): void {
    const current = this.getPreferences(userId);
    this.storage.preferences.set(userId, {
      ...current,
      ...preferences,
    });
  }

  /**
   * Send email notification
   * In production, this would integrate with an email service
   */
  private async sendEmailNotification(
    notification: Notification,
  ): Promise<void> {
    console.log(`[CommentNotifier] Email notification:`, {
      to: notification.userId,
      subject: notification.title,
      message: notification.message,
    });

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /**
   * Generate action URL for notification
   */
  generateActionUrl(notification: Notification): string {
    const parts = ['/files', notification.fileId];
    if (notification.reviewId) {
      parts.push('reviews', notification.reviewId);
    }
    parts.push('comments', notification.commentId);
    return parts.join('/');
  }

  /**
   * Get notification statistics
   */
  async getStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
  }> {
    const notifications = await this.getNotifications(userId);

    const byType: Record<string, number> = {
      comment_added: 0,
      comment_replied: 0,
      comment_resolved: 0,
      mentioned: 0,
    };

    for (const n of notifications) {
      byType[n.type]++;
    }

    return {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      byType: byType as Record<NotificationType, number>,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
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
    value: string,
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
   * Clear all notifications (for testing)
   */
  clear(): void {
    this.storage.notifications.clear();
    this.storage.byUser.clear();
    this.storage.preferences.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.notifications.size;
  }
}

// Export singleton instance
export const commentNotifier = new CommentNotifier();
