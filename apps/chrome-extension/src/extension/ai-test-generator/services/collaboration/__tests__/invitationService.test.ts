/**
 * Invitation Service Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateInvitationData } from '../../types/collaboration';
import { InvitationService } from '../invitationService';
import { memberManager } from '../memberManager';
import { workspaceManager } from '../workspaceManager';

describe('InvitationService', () => {
  let is: InvitationService;
  let testWorkspaceId: string;

  beforeEach(async () => {
    is = new InvitationService();

    // Create a test workspace
    const workspace = await workspaceManager.create({
      name: 'Test Workspace',
      description: 'A test workspace',
      ownerId: 'owner1',
    });
    testWorkspaceId = workspace.id;
  });

  afterEach(() => {
    is.clear();
    workspaceManager.clear();
  });

  describe('create', () => {
    it('should create a new invitation', async () => {
      const data: CreateInvitationData = {
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'test@example.com',
        role: 'editor',
      };

      const invitation = await is.create(data);

      expect(invitation.id).toBeDefined();
      expect(invitation.workspaceId).toBe(testWorkspaceId);
      expect(invitation.email).toBe('test@example.com');
      expect(invitation.role).toBe('editor');
      expect(invitation.status).toBe('pending');
      expect(invitation.invitedBy).toBe('owner1');
    });

    it('should normalize email to lowercase', async () => {
      const data: CreateInvitationData = {
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'TEST@EXAMPLE.COM',
        role: 'viewer',
      };

      const invitation = await is.create(data);

      expect(invitation.email).toBe('test@example.com');
    });

    it('should set default expiration if not provided', async () => {
      const data: CreateInvitationData = {
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'test@example.com',
        role: 'editor',
      };

      const invitation = await is.create(data);
      const expectedExpiration = 7 * 24 * 60 * 60 * 1000; // 7 days
      const actualExpiration = invitation.expiresAt - invitation.createdAt;

      expect(actualExpiration).toBe(expectedExpiration);
    });

    it('should use custom expiration if provided', async () => {
      const customExpiration = 24 * 60 * 60 * 1000; // 1 day
      const data: CreateInvitationData = {
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'test@example.com',
        role: 'editor',
        expiresIn: customExpiration,
      };

      const invitation = await is.create(data);
      const actualExpiration = invitation.expiresAt - invitation.createdAt;

      expect(actualExpiration).toBe(customExpiration);
    });
  });

  describe('get', () => {
    it('should retrieve invitation by ID', async () => {
      const data: CreateInvitationData = {
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'test@example.com',
        role: 'editor',
      };

      const created = await is.create(data);
      const retrieved = await is.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.email).toBe('test@example.com');
    });

    it('should return null for non-existent invitation', async () => {
      const result = await is.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getPendingForWorkspace', () => {
    beforeEach(async () => {
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'pending1@example.com',
        role: 'editor',
      });
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'pending2@example.com',
        role: 'viewer',
      });
    });

    it('should return pending invitations for workspace', async () => {
      const pending = await is.getPendingForWorkspace(testWorkspaceId);

      expect(pending).toHaveLength(2);
      expect(pending.every((inv) => inv.status === 'pending')).toBe(true);
    });

    it('should return empty array for workspace with no invitations', async () => {
      const pending = await is.getPendingForWorkspace('non-existent');
      expect(pending).toEqual([]);
    });
  });

  describe('getPendingForEmail', () => {
    beforeEach(async () => {
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'viewer',
      });
    });

    it('should return pending invitations for email', async () => {
      const pending = await is.getPendingForEmail('user@example.com');

      expect(pending).toHaveLength(2);
      expect(pending.every((inv) => inv.email === 'user@example.com')).toBe(
        true,
      );
    });

    it('should be case insensitive for email', async () => {
      const pending = await is.getPendingForEmail('USER@EXAMPLE.COM');

      expect(pending).toHaveLength(2);
    });
  });

  describe('accept', () => {
    it('should accept invitation and add user to workspace', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'newuser@example.com',
        role: 'editor',
      });

      await is.accept(invitation.id, 'newUserUserId');

      const retrieved = await is.get(invitation.id);
      expect(retrieved?.status).toBe('accepted');

      // Verify user was added to workspace
      const members = await memberManager.getMembers(testWorkspaceId);
      expect(members.some((m) => m.userId === 'newUserUserId')).toBe(true);
    });

    it('should throw error for non-existent invitation', async () => {
      await expect(is.accept('non-existent', 'user1')).rejects.toThrow(
        'Invitation not found',
      );
    });

    it('should throw error for already accepted invitation', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      await is.accept(invitation.id, 'user1');

      await expect(is.accept(invitation.id, 'user1')).rejects.toThrow(
        'not pending',
      );
    });
  });

  describe('decline', () => {
    it('should decline invitation', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      await is.decline(invitation.id);

      const retrieved = await is.get(invitation.id);
      expect(retrieved?.status).toBe('declined');
    });

    it('should throw error for non-existent invitation', async () => {
      await expect(is.decline('non-existent')).rejects.toThrow(
        'Invitation not found',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel and remove invitation', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      await is.cancel(invitation.id);

      const retrieved = await is.get(invitation.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error for non-pending invitation', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      await is.decline(invitation.id);

      await expect(is.cancel(invitation.id)).rejects.toThrow(
        'Can only cancel pending',
      );
    });
  });

  describe('sendEmail', () => {
    it('should simulate sending email', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      // Should not throw
      await is.sendEmail(invitation);

      // Just verify it completes
      expect(true).toBe(true);
    });
  });

  describe('createAndSend', () => {
    it('should create and send invitation', async () => {
      const data: CreateInvitationData = {
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      };

      const invitation = await is.createAndSend(data);

      expect(invitation.id).toBeDefined();
      expect(invitation.email).toBe('user@example.com');
    });
  });

  describe('cleanupExpired', () => {
    it('should mark expired invitations', async () => {
      // Create an invitation that expires very soon
      const shortExpiration = 10; // 10ms
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'expire@example.com',
        role: 'editor',
        expiresIn: shortExpiration,
      });

      // Create a normal invitation
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'normal@example.com',
        role: 'editor',
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      const cleaned = await is.cleanupExpired();

      expect(cleaned).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getByToken', () => {
    it('should get invitation by token (alias for get)', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      const retrieved = await is.getByToken(invitation.id);

      expect(retrieved?.id).toBe(invitation.id);
    });
  });

  describe('generateInviteLink', () => {
    it('should generate invite link', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      const link = is.generateInviteLink(invitation.id);

      expect(link).toContain(invitation.id);
      expect(link).toContain('/invite/');
    });
  });

  describe('validate', () => {
    it('should validate pending non-expired invitation', async () => {
      const invitation = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      const valid = await is.validate(invitation.id);

      expect(valid).toBe(true);
    });

    it('should invalidate non-existent invitation', async () => {
      const valid = await is.validate('non-existent');

      expect(valid).toBe(false);
    });
  });

  describe('existsForWorkspace', () => {
    it('should return true if invitation exists for email and workspace', async () => {
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      const exists = await is.existsForWorkspace(
        testWorkspaceId,
        'user@example.com',
      );

      expect(exists).toBe(true);
    });

    it('should return false if no invitation exists', async () => {
      const exists = await is.existsForWorkspace(
        testWorkspaceId,
        'nonexistent@example.com',
      );

      expect(exists).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'pending@example.com',
        role: 'editor',
      });

      const accepted = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'accepted@example.com',
        role: 'editor',
      });
      await is.accept(accepted.id, 'user1');

      const declined = await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'declined@example.com',
        role: 'editor',
      });
      await is.decline(declined.id);
    });

    it('should return invitation statistics', async () => {
      const stats = await is.getStats(testWorkspaceId);

      expect(stats.pending).toBe(1);
      expect(stats.accepted).toBe(1);
      expect(stats.declined).toBe(1);
    });

    it('should return zeros for workspace with no invitations', async () => {
      const stats = await is.getStats('non-existent');

      expect(stats.pending).toBe(0);
      expect(stats.accepted).toBe(0);
      expect(stats.declined).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  describe('size', () => {
    it('should return number of invitations', async () => {
      expect(is.size()).toBe(0);

      await is.create({
        workspaceId: testWorkspaceId,
        invitedBy: 'owner1',
        email: 'user@example.com',
        role: 'editor',
      });

      expect(is.size()).toBe(1);
    });
  });
});
