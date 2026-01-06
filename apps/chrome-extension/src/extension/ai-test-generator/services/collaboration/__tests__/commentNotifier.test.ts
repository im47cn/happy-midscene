/**
 * Comment Notifier Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Comment } from '../../types/collaboration';
import { CommentNotifier, type Notification } from '../commentNotifier';

describe('CommentNotifier', () => {
  let cn: CommentNotifier;
  let testComment: Comment;

  beforeEach(() => {
    cn = new CommentNotifier();

    testComment = {
      id: 'comment1',
      reviewId: 'review1',
      fileId: 'file1',
      content: 'Test comment',
      author: 'user1',
      mentions: ['user2', 'user3'],
      resolved: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  afterEach(() => {
    cn.clear();
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const notification = await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test notification',
        message: 'Test message',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      expect(notification.id).toBeDefined();
      expect(notification.type).toBe('comment_added');
      expect(notification.userId).toBe('user1');
      expect(notification.title).toBe('Test notification');
      expect(notification.message).toBe('Test message');
      expect(notification.read).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });

    it('should store notification in index', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(1);
    });
  });

  describe('notifyCommentAdded', () => {
    it('should notify mentioned users', async () => {
      await cn.notifyCommentAdded(testComment);

      const user2Notifications = await cn.getNotifications('user2');
      const user3Notifications = await cn.getNotifications('user3');

      expect(user2Notifications).toHaveLength(1);
      expect(user3Notifications).toHaveLength(1);
      expect(user2Notifications[0].type).toBe('mentioned');
      expect(user3Notifications[0].type).toBe('mentioned');
    });

    it('should not notify author if they mention themselves', async () => {
      const selfMentionComment: Comment = {
        ...testComment,
        mentions: ['user1'], // Author mentions themselves
      };

      await cn.notifyCommentAdded(selfMentionComment);

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(0);
    });

    it('should create notifications with correct content', async () => {
      await cn.notifyCommentAdded(testComment);

      const notifications = await cn.getNotifications('user2');
      expect(notifications[0].title).toBe('You were mentioned');
      expect(notifications[0].message).toContain('user1');
      expect(notifications[0].commentId).toBe('comment1');
      expect(notifications[0].fileId).toBe('file1');
    });
  });

  describe('notifyCommentReply', () => {
    it('should notify parent comment author', async () => {
      const reply: Comment = {
        id: 'reply1',
        reviewId: 'review1',
        fileId: 'file1',
        content: 'Reply',
        author: 'user2',
        mentions: [],
        resolved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await cn.notifyCommentReply(testComment, reply);

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('comment_replied');
      expect(notifications[0].title).toBe('New reply to your comment');
    });

    it('should not notify for self-replies', async () => {
      const selfReply: Comment = {
        ...testComment,
        id: 'reply1',
      };

      await cn.notifyCommentReply(testComment, selfReply);

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(0);
    });
  });

  describe('notifyCommentResolved', () => {
    it('should notify comment author', async () => {
      await cn.notifyCommentResolved(testComment, 'user2');

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('comment_resolved');
      expect(notifications[0].title).toBe('Comment resolved');
    });

    it('should not notify for self-resolution', async () => {
      await cn.notifyCommentResolved(testComment, 'user1');

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(0);
    });
  });

  describe('getNotifications', () => {
    it('should return all notifications for user', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test 1',
        message: 'Message 1',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });
      await cn.createNotification({
        type: 'mentioned',
        userId: 'user1',
        title: 'Test 2',
        message: 'Message 2',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      const notifications = await cn.getNotifications('user1');
      expect(notifications).toHaveLength(2);
    });

    it('should return empty array for user with no notifications', async () => {
      const notifications = await cn.getNotifications('nonexistent');
      expect(notifications).toEqual([]);
    });

    it('should return only unread when unreadOnly is true', async () => {
      const notification = await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      const unread = await cn.getNotifications('user1', true);
      expect(unread).toHaveLength(1);

      await cn.markAsRead(notification.id);

      const unreadAfter = await cn.getNotifications('user1', true);
      expect(unreadAfter).toHaveLength(0);
    });

    it('should sort notifications by creation time descending', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'First',
        message: 'First',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await cn.createNotification({
        type: 'mentioned',
        userId: 'user1',
        title: 'Second',
        message: 'Second',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      const notifications = await cn.getNotifications('user1');
      expect(notifications[0].title).toBe('Second');
      expect(notifications[1].title).toBe('First');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      expect(notification.read).toBe(false);

      await cn.markAsRead(notification.id);

      const notifications = await cn.getNotifications('user1');
      expect(notifications[0].read).toBe(true);
    });

    it('should handle marking non-existent notification', async () => {
      await cn.markAsRead('nonexistent');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for user', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test 1',
        message: 'Test 1',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });
      await cn.createNotification({
        type: 'mentioned',
        userId: 'user1',
        title: 'Test 2',
        message: 'Test 2',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      await cn.markAllAsRead('user1');

      const notifications = await cn.getNotifications('user1');
      expect(notifications.every((n) => n.read)).toBe(true);
    });

    it('should not affect other users notifications', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'User1 notification',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });
      await cn.createNotification({
        type: 'mentioned',
        userId: 'user2',
        title: 'User2 notification',
        message: 'Test',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      await cn.markAllAsRead('user1');

      const user1Notifications = await cn.getNotifications('user1');
      const user2Notifications = await cn.getNotifications('user2');

      expect(user1Notifications.every((n) => n.read)).toBe(true);
      expect(user2Notifications.every((n) => n.read)).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test 1',
        message: 'Test 1',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });
      await cn.createNotification({
        type: 'mentioned',
        userId: 'user1',
        title: 'Test 2',
        message: 'Test 2',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      const count = await cn.getUnreadCount('user1');
      expect(count).toBe(2);
    });

    it('should exclude read notifications from count', async () => {
      const notification1 = await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test 1',
        message: 'Test 1',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });
      await cn.createNotification({
        type: 'mentioned',
        userId: 'user1',
        title: 'Test 2',
        message: 'Test 2',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      await cn.markAsRead(notification1.id);

      const count = await cn.getUnreadCount('user1');
      expect(count).toBe(1);
    });

    it('should return 0 for user with no notifications', async () => {
      const count = await cn.getUnreadCount('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const notification = await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      expect(await cn.getUnreadCount('user1')).toBe(1);

      await cn.deleteNotification(notification.id);

      expect(await cn.getUnreadCount('user1')).toBe(0);
    });

    it('should handle deleting non-existent notification', async () => {
      await cn.deleteNotification('nonexistent');
    });
  });

  describe('getPreferences', () => {
    it('should return default preferences for new user', () => {
      const prefs = cn.getPreferences('user1');

      expect(prefs.email).toBe(false);
      expect(prefs.inApp).toBe(true);
      expect(prefs.mentions).toBe(true);
      expect(prefs.replies).toBe(true);
      expect(prefs.resolves).toBe(false);
    });

    it('should return same preferences on subsequent calls', () => {
      const prefs1 = cn.getPreferences('user1');
      const prefs2 = cn.getPreferences('user1');

      expect(prefs1).toEqual(prefs2);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', () => {
      cn.updatePreferences('user1', { email: true });

      const prefs = cn.getPreferences('user1');
      expect(prefs.email).toBe(true);
    });

    it('should preserve other preferences when updating', () => {
      cn.updatePreferences('user1', { email: true });

      const prefs = cn.getPreferences('user1');
      expect(prefs.inApp).toBe(true); // Default preserved
      expect(prefs.mentions).toBe(true); // Default preserved
    });

    it('should allow updating multiple preferences', () => {
      cn.updatePreferences('user1', {
        email: true,
        mentions: false,
        resolves: true,
      });

      const prefs = cn.getPreferences('user1');
      expect(prefs.email).toBe(true);
      expect(prefs.mentions).toBe(false);
      expect(prefs.resolves).toBe(true);
    });
  });

  describe('generateActionUrl', () => {
    it('should generate URL for notification without review', () => {
      const notification: Notification = {
        id: 'notif1',
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
        createdAt: Date.now(),
        read: false,
      };

      const url = cn.generateActionUrl(notification);
      expect(url).toBe('/files/file1/comments/comment1');
    });

    it('should generate URL for notification with review', () => {
      const notification: Notification = {
        id: 'notif1',
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        reviewId: 'review1',
        fileId: 'file1',
        createdBy: 'user2',
        createdAt: Date.now(),
        read: false,
      };

      const url = cn.generateActionUrl(notification);
      expect(url).toBe('/files/file1/reviews/review1/comments/comment1');
    });
  });

  describe('getStats', () => {
    it('should return notification statistics', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test 1',
        message: 'Test 1',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });
      await cn.createNotification({
        type: 'mentioned',
        userId: 'user1',
        title: 'Test 2',
        message: 'Test 2',
        commentId: 'comment2',
        fileId: 'file2',
        createdBy: 'user3',
      });

      const stats = await cn.getStats('user1');

      expect(stats.total).toBe(2);
      expect(stats.unread).toBe(2);
      expect(stats.byType.comment_added).toBe(1);
      expect(stats.byType.mentioned).toBe(1);
    });

    it('should return zeros for user with no notifications', async () => {
      const stats = await cn.getStats('nonexistent');

      expect(stats.total).toBe(0);
      expect(stats.unread).toBe(0);
      expect(stats.byType.comment_added).toBe(0);
      expect(stats.byType.mentioned).toBe(0);
      expect(stats.byType.comment_replied).toBe(0);
      expect(stats.byType.comment_resolved).toBe(0);
    });

    it('should count only unread notifications correctly', async () => {
      const notification = await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      await cn.markAsRead(notification.id);

      const stats = await cn.getStats('user1');
      expect(stats.total).toBe(1);
      expect(stats.unread).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all storage', async () => {
      await cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      expect(cn.size()).toBe(1);

      cn.clear();

      expect(cn.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return number of notifications', () => {
      expect(cn.size()).toBe(0);

      cn.createNotification({
        type: 'comment_added',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        commentId: 'comment1',
        fileId: 'file1',
        createdBy: 'user2',
      });

      expect(cn.size()).toBe(1);
    });
  });
});
