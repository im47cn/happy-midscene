/**
 * Participant List Component
 *
 * Shows active collaborators in real-time.
 */

import React, { useState, useEffect } from 'react';
import type { Participant, CollaborationSession } from '../../types/collaboration';

/**
 * Props for ParticipantList
 */
export interface ParticipantListProps {
  /** Current collaboration session */
  session: CollaborationSession;
  /** Current user ID */
  currentUserId: string;
  /** Layout mode */
  layout?: 'horizontal' | 'vertical' | 'compact';
  /** Show cursor positions */
  showCursors?: boolean;
  /** Callback when participant is clicked */
  onParticipantClick?: (userId: string) => void;
}

/**
 * Participant with computed properties
 */
interface ParticipantWithInfo extends Participant {
  isCurrentUser: boolean;
  isActive: boolean;
  timeSinceActive: string;
}

/**
 * Participant List Component
 */
export const ParticipantList: React.FC<ParticipantListProps> = ({
  session,
  currentUserId,
  layout = 'horizontal',
  showCursors = false,
  onParticipantClick,
}) => {
  const [participants, setParticipants] = useState<ParticipantWithInfo[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  /**
   * Update participants with computed info
   */
  useEffect(() => {
    const updateParticipants = () => {
      const now = Date.now();
      const updated = session.participants.map((p) => ({
        ...p,
        isCurrentUser: p.userId === currentUserId,
        isActive: now - p.lastSeen < 30000, // Active within 30 seconds
        timeSinceActive: getTimeSinceActive(now - p.lastSeen),
      }));
      setParticipants(updated);
      setLastUpdate(now);
    };

    updateParticipants();
    const interval = setInterval(updateParticipants, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [session.participants, currentUserId]);

  /**
   * Get human-readable time since active
   */
  const getTimeSinceActive = (diffMs: number): string => {
    if (diffMs < 1000) return 'now';
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  /**
   * Get user initials
   */
  const getInitials = (userId: string): string => {
    const parts = userId.split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return userId.slice(0, 2).toUpperCase();
  };

  /**
   * Handle participant click
   */
  const handleClick = (participant: ParticipantWithInfo) => {
    if (onParticipantClick) {
      onParticipantClick(participant.userId);
    }
  };

  /**
   * Sort participants: current user first, then active, then by name
   */
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.userId.localeCompare(b.userId);
  });

  /**
   * Render horizontal layout
   */
  const renderHorizontal = () => (
    <div className="participant-list participant-list-horizontal">
      {sortedParticipants.map((p) => (
        <div
          key={p.userId}
          className={`participant-item ${p.isCurrentUser ? 'current-user' : ''} ${!p.isActive ? 'inactive' : ''}`}
          onClick={() => handleClick(p)}
          title={`${p.userId}${showCursors ? ` - Line ${p.cursor.line}:${p.cursor.column}` : ''}`}
        >
          <div
            className="participant-avatar"
            style={{ backgroundColor: p.color }}
          >
            {getInitials(p.userId)}
          </div>
          {p.isCurrentUser && <span className="current-user-indicator">You</span>}
          {!p.isActive && <span className="inactive-indicator">zzz</span>}
        </div>
      ))}
    </div>
  );

  /**
   * Render vertical layout
   */
  const renderVertical = () => (
    <div className="participant-list participant-list-vertical">
      <h4>Participants ({sortedParticipants.length})</h4>
      <div className="participant-list-items">
        {sortedParticipants.map((p) => (
          <div
            key={p.userId}
            className={`participant-item ${p.isCurrentUser ? 'current-user' : ''} ${!p.isActive ? 'inactive' : ''}`}
            onClick={() => handleClick(p)}
          >
            <div
              className="participant-avatar"
              style={{ backgroundColor: p.color }}
            >
              {getInitials(p.userId)}
            </div>
            <div className="participant-info">
              <div className="participant-name">
                {p.userId}
                {p.isCurrentUser && ' (you)'}
              </div>
              {showCursors && p.isActive && (
                <div className="participant-cursor">
                  Line {p.cursor.line}, Col {p.cursor.column}
                </div>
              )}
              <div className="participant-status">
                {p.isActive ? (
                  <span className="status-active">● Active</span>
                ) : (
                  <span className="status-inactive">○ {p.timeSinceActive}</span>
                )}
              </div>
            </div>
            {p.selection && p.selection.start.line !== p.selection.end.line && (
              <div className="participant-selection-indicator">
                📝 Selecting
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render compact layout
   */
  const renderCompact = () => (
    <div className="participant-list participant-list-compact">
      <div className="compact-avatars">
        {sortedParticipants.slice(0, 5).map((p) => (
          <div
            key={p.userId}
            className={`participant-avatar-compact ${p.isCurrentUser ? 'current-user' : ''} ${!p.isActive ? 'inactive' : ''}`}
            style={{ backgroundColor: p.color }}
            title={`${p.userId}${p.isActive ? '' : ` - ${p.timeSinceActive}`}`}
          >
            {getInitials(p.userId)}
          </div>
        ))}
        {sortedParticipants.length > 5 && (
          <div className="participant-count">
            +{sortedParticipants.length - 5}
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Render activity indicator
   */
  const renderActivityIndicator = () => {
    const activeCount = participants.filter((p) => p.isActive).length;
    return (
      <div className="activity-indicator">
        <span className={`status-dot ${activeCount > 1 ? 'active' : ''}`}>
          ●
        </span>
        <span className="activity-text">
          {activeCount} {activeCount === 1 ? 'person' : 'people'} active
        </span>
      </div>
    );
  };

  return (
    <div className={`participant-list-container layout-${layout}`}>
      {layout === 'horizontal' && renderHorizontal()}
      {layout === 'vertical' && renderVertical()}
      {layout === 'compact' && renderCompact()}
      {layout === 'compact' && renderActivityIndicator()}
    </div>
  );
};

export default ParticipantList;
