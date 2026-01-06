/**
 * Workspace Panel Component
 *
 * Displays workspace information, members, and settings.
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import type {
  MemberRole,
  Workspace,
  WorkspaceMember,
} from '../../types/collaboration';

/**
 * Props for WorkspacePanel
 */
export interface WorkspacePanelProps {
  /** Current workspace */
  workspace: Workspace;
  /** Current user ID */
  currentUserId: string;
  /** Callback when workspace is updated */
  onWorkspaceUpdate?: (workspace: Workspace) => void;
  /** Callback when member is added */
  onMemberAdd?: (userId: string, role: MemberRole) => void;
  /** Callback when member role is changed */
  onMemberRoleChange?: (userId: string, role: MemberRole) => void;
  /** Callback when member is removed */
  onMemberRemove?: (userId: string) => void;
}

/**
 * Workspace panel view mode
 */
type ViewMode = 'overview' | 'members' | 'settings' | 'invites';

/**
 * Workspace Panel Component
 */
export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  workspace,
  currentUserId,
  onWorkspaceUpdate,
  onMemberAdd,
  onMemberRoleChange,
  onMemberRemove,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(workspace.name);
  const [editedDescription, setEditedDescription] = useState(
    workspace.description,
  );
  const [editedVisibility, setEditedVisibility] = useState(
    workspace.visibility,
  );

  /**
   * Check if current user can manage workspace
   */
  const canManage =
    workspace.members.find((m) => m.userId === currentUserId)?.role ===
      'admin' || workspace.ownerId === currentUserId;

  /**
   * Handle workspace save
   */
  const handleSave = () => {
    if (onWorkspaceUpdate) {
      onWorkspaceUpdate({
        ...workspace,
        name: editedName,
        description: editedDescription,
        visibility: editedVisibility,
        updatedAt: Date.now(),
      });
    }
    setIsEditing(false);
  };

  /**
   * Handle role change
   */
  const handleRoleChange = (userId: string, newRole: MemberRole) => {
    if (onMemberRoleChange) {
      onMemberRoleChange(userId, newRole);
    }
  };

  /**
   * Handle member removal
   */
  const handleRemoveMember = (userId: string) => {
    if (
      onMemberRemove &&
      confirm('Are you sure you want to remove this member?')
    ) {
      onMemberRemove(userId);
    }
  };

  /**
   * Render overview tab
   */
  const renderOverview = () => (
    <div className="workspace-overview">
      <div className="workspace-header">
        <h2>{workspace.name}</h2>
        <span className={`visibility-badge ${workspace.visibility}`}>
          {workspace.visibility}
        </span>
      </div>
      <p className="workspace-description">{workspace.description}</p>
      <div className="workspace-stats">
        <div className="stat">
          <span className="stat-value">{workspace.members.length}</span>
          <span className="stat-label">Members</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {workspace.visibility === 'public' ? 'Anyone' : 'Members only'}
          </span>
          <span className="stat-label">Visibility</span>
        </div>
      </div>
    </div>
  );

  /**
   * Render members tab
   */
  const renderMembers = () => (
    <div className="workspace-members">
      <div className="members-header">
        <h3>Members ({workspace.members.length})</h3>
        {canManage && (
          <button
            className="btn-primary"
            onClick={() => {
              /* TODO: Open invite modal */
            }}
          >
            Invite Member
          </button>
        )}
      </div>
      <div className="members-list">
        {workspace.members.map((member) => (
          <div key={member.userId} className="member-row">
            <div className="member-info">
              <div className="member-avatar">
                {member.userId.charAt(0).toUpperCase()}
              </div>
              <div className="member-details">
                <div className="member-name">{member.userId}</div>
                <div className="member-joined">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="member-role">
              {canManage && member.userId !== workspace.ownerId ? (
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(
                      member.userId,
                      e.target.value as MemberRole,
                    )
                  }
                  className="role-select"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className={`role-badge ${member.role}`}>
                  {member.role}
                  {member.userId === workspace.ownerId && ' (Owner)'}
                </span>
              )}
            </div>
            {canManage && member.userId !== workspace.ownerId && (
              <button
                className="btn-icon btn-danger"
                onClick={() => handleRemoveMember(member.userId)}
                title="Remove member"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render settings tab
   */
  const renderSettings = () => (
    <div className="workspace-settings">
      {isEditing ? (
        <div className="edit-form">
          <div className="form-group">
            <label>Workspace Name</label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="form-textarea"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Visibility</label>
            <select
              value={editedVisibility}
              onChange={(e) =>
                setEditedVisibility(e.target.value as Workspace['visibility'])
              }
              className="form-select"
            >
              <option value="private">Private</option>
              <option value="team">Team</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSave}>
              Save Changes
            </button>
            <button
              className="btn-secondary"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="settings-view">
          <div className="setting-group">
            <h4>Review Settings</h4>
            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={workspace.settings.requireReview}
                  disabled
                />
                Require review before merging
              </label>
            </div>
            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={workspace.settings.autoMerge}
                  disabled
                />
                Auto-merge after approval
              </label>
            </div>
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => setIsEditing(true)}>
              Edit Workspace
            </button>
          )}
        </div>
      )}
    </div>
  );

  /**
   * Render invites tab
   */
  const renderInvites = () => (
    <div className="workspace-invites">
      <h3>Pending Invitations</h3>
      <p className="empty-state">No pending invitations</p>
      {canManage && (
        <button
          className="btn-primary"
          onClick={() => {
            /* TODO: Open invite modal */
          }}
        >
          Send Invitation
        </button>
      )}
    </div>
  );

  return (
    <div className="workspace-panel">
      <div className="panel-tabs">
        <button
          className={`tab ${viewMode === 'overview' ? 'active' : ''}`}
          onClick={() => setViewMode('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${viewMode === 'members' ? 'active' : ''}`}
          onClick={() => setViewMode('members')}
        >
          Members
        </button>
        <button
          className={`tab ${viewMode === 'settings' ? 'active' : ''}`}
          onClick={() => setViewMode('settings')}
        >
          Settings
        </button>
        <button
          className={`tab ${viewMode === 'invites' ? 'active' : ''}`}
          onClick={() => setViewMode('invites')}
        >
          Invites
        </button>
      </div>
      <div className="panel-content">
        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'members' && renderMembers()}
        {viewMode === 'settings' && renderSettings()}
        {viewMode === 'invites' && renderInvites()}
      </div>
    </div>
  );
};

export default WorkspacePanel;
