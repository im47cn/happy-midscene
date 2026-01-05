/**
 * Collaborative Editor Component
 *
 * Real-time collaborative editing with multi-user cursors.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CollaborationSession,
  Participant,
  EditorOperation,
  EditorState,
} from '../../types/collaboration';

/**
 * Props for CollaborativeEditor
 */
export interface CollaborativeEditorProps {
  /** File ID being edited */
  fileId: string;
  /** Current user ID */
  currentUserId: string;
  /** Initial content */
  initialContent?: string;
  /** Height of the editor */
  height?: string | number;
  /** Callback when content changes */
  onContentChange?: (content: string) => void;
  /** Callback when operation is sent */
  onOperationSend?: (operation: EditorOperation) => void;
  /** Callback when cursor moves */
  onCursorMove?: (cursor: { line: number; column: number }) => void;
}

/**
 * Remote cursor position
 */
interface RemoteCursor {
  userId: string;
  color: string;
  position: { line: number; column: number };
  label: string;
}

/**
 * Collaborative Editor Component
 */
export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  fileId,
  currentUserId,
  initialContent = '',
  height = '400px',
  onContentChange,
  onOperationSend,
  onCursorMove,
}) => {
  const [content, setContent] = useState(initialContent);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [version, setVersion] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const operationQueueRef = useRef<EditorOperation[]>([]);

  /**
   * Handle content change with OT
   */
  const handleContentChange = useCallback((newContent: string) => {
    if (newContent === content) return;

    // Generate operation
    const operation: EditorOperation = {
      type: 'insert',
      position: 0, // Simplified - real implementation would calculate diff
      content: newContent.slice(content.length),
      userId: currentUserId,
      timestamp: Date.now(),
      version: version + 1,
    };

    setContent(newContent);
    setVersion(version + 1);

    if (onContentChange) {
      onContentChange(newContent);
    }
    if (onOperationSend) {
      onOperationSend(operation);
    }
  }, [content, version, currentUserId, onContentChange, onOperationSend]);

  /**
   * Handle cursor position change
   */
  const handleCursorChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split('\n');
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;

    if (onCursorMove) {
      onCursorMove({ line, column });
    }
  }, [onCursorMove]);

  /**
   * Apply remote operation
   */
  const applyRemoteOperation = useCallback((operation: EditorOperation) => {
    // Skip operations from current user
    if (operation.userId === currentUserId) return;

    setTextarea((prevContent) => {
      let newContent = prevContent;

      switch (operation.type) {
        case 'insert':
          if (operation.content) {
            newContent =
              prevContent.slice(0, operation.position) +
              operation.content +
              prevContent.slice(operation.position);
          }
          break;

        case 'delete':
          const length = operation.length || 0;
          newContent =
            prevContent.slice(0, operation.position) +
            prevContent.slice(operation.position + length);
          break;

        case 'retain':
          // No change
          break;
      }

      return newContent;
    });
  }, [currentUserId]);

  /**
   * Update textarea content programmatically
   */
  const setTextarea = useCallback((updater: (prev: string) => string) => {
    setContent(updater);
  }, []);

  /**
   * Sync with session state
   */
  useEffect(() => {
    // In production, this would connect to WebSocket
    // For now, simulate connection
    setIsConnected(true);
  }, [fileId]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        // Save functionality
      }
    }
  };

  /**
   * Render remote cursors
   */
  const renderRemoteCursors = () => {
    if (!textareaRef.current) return null;

    const textarea = textareaRef.current;
    const fontSize = parseFloat(getComputedStyle(textarea).fontSize);
    const lineHeight = fontSize * 1.5;

    return remoteCursors.map((cursor) => {
      // Calculate position (simplified)
      const top = cursor.position.line * lineHeight;
      const left = cursor.position.column * (fontSize * 0.6);

      return (
        <div
          key={cursor.userId}
          className="remote-cursor"
          style={{
            top: `${top}px`,
            left: `${left}px`,
            borderColor: cursor.color,
          }}
        >
          <div className="cursor-flag" style={{ backgroundColor: cursor.color }}>
            {cursor.label}
          </div>
        </div>
      );
    });
  };

  /**
   * Render participant avatars
   */
  const renderParticipantAvatars = () => (
    <div className="participant-avatars">
      {participants
        .filter((p) => p.userId !== currentUserId)
        .map((participant) => (
          <div
            key={participant.userId}
            className="participant-avatar"
            style={{ backgroundColor: participant.color }}
            title={`${participant.userId} - ${participant.cursor.line}:${participant.cursor.column}`}
          >
            {participant.userId.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
  );

  /**
   * Get connection status indicator
   */
  const getConnectionStatus = () => {
    if (isConnected) {
      return <span className="status-indicator connected">● Connected</span>;
    }
    return <span className="status-indicator disconnected">● Reconnecting...</span>;
  };

  return (
    <div
      ref={containerRef}
      className="collaborative-editor"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          {getConnectionStatus()}
          <span className="version-info">v{version}</span>
        </div>
        <div className="toolbar-right">
          {renderParticipantAvatars()}
        </div>
      </div>

      {/* Editor container */}
      <div className="editor-container">
        {/* Line numbers */}
        <div className="line-numbers">
          {content.split('\n').map((_, idx) => (
            <div key={idx} className="line-number">
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Text area */}
        <div className="editor-textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyUp={handleCursorChange}
            onClick={handleCursorChange}
            onKeyDown={handleKeyDown}
            className="editor-textarea"
            spellCheck={false}
            placeholder="Start typing..."
          />
          {renderRemoteCursors()}
        </div>
      </div>

      {/* Status bar */}
      <div className="editor-statusbar">
        <span>Ln {textareaRef.current ? textareaRef.current.value.substring(0, textareaRef.current.selectionStart).split('\n').length : 1}, Col {textareaRef.current ? textareaRef.current.selectionStart : 0}</span>
        <span>{participants.length} {participants.length === 1 ? 'participant' : 'participants'}</span>
      </div>
    </div>
  );
};

export default CollaborativeEditor;
