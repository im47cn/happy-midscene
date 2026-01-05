/**
 * Version History Component
 *
 * Displays file version history with diff viewer.
 */

import React, { useState, useEffect } from 'react';
import type { Version, VersionDiff } from '../../types/collaboration';

/**
 * Props for VersionHistory
 */
export interface VersionHistoryProps {
  /** File ID to show history for */
  fileId: string;
  /** Current version ID */
  currentVersionId?: string;
  /** Callback when version is selected */
  onVersionSelect?: (version: Version) => void;
  /** Callback when revert is requested */
  onRevert?: (versionId: string) => void;
  /** Callback when versions are compared */
  onCompare?: (versionA: string, versionB: string) => void;
}

/**
 * Version selection state
 */
interface VersionSelection {
  left: Version | null;
  right: Version | null;
}

/**
 * View mode for history
 */
type ViewMode = 'list' | 'compare' | 'detail';

/**
 * Version History Component
 */
export const VersionHistory: React.FC<VersionHistoryProps> = ({
  fileId,
  currentVersionId,
  onVersionSelect,
  onRevert,
  onCompare,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareSelection, setCompareSelection] = useState<VersionSelection>({
    left: null,
    right: null,
  });
  const [currentDiff, setCurrentDiff] = useState<VersionDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load version history
   */
  useEffect(() => {
    loadVersions();
  }, [fileId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from service
      // const data = await versionControl.getHistory(fileId);
      // setVersions(data);
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle version selection
   */
  const handleVersionClick = (version: Version) => {
    setSelectedVersion(version);
    if (onVersionSelect) {
      onVersionSelect(version);
    }
    setViewMode('detail');
  };

  /**
   * Handle compare mode toggle
   */
  const toggleCompareMode = () => {
    if (viewMode === 'compare') {
      setViewMode('list');
      setCompareSelection({ left: null, right: null });
    } else {
      setViewMode('compare');
    }
  };

  /**
   * Handle version selection for comparison
   */
  const handleCompareSelect = (version: Version, side: 'left' | 'right') => {
    setCompareSelection((prev) => ({
      ...prev,
      [side]: version,
    }));

    // If both selected, generate diff
    const otherSide = side === 'left' ? 'right' : 'left';
    const other = compareSelection[otherSide];

    if (other) {
      generateDiff(
        side === 'left' ? version.id : other.id,
        side === 'left' ? other.id : version.id
      );
    }
  };

  /**
   * Generate diff between versions
   */
  const generateDiff = async (versionAId: string, versionBId: string) => {
    // In production, use diff service
    // const diff = await diffEngine.compare(versionAId, versionBId);
    // setCurrentDiff(diff);
    if (onCompare) {
      onCompare(versionAId, versionBId);
    }
  };

  /**
   * Handle revert
   */
  const handleRevert = () => {
    if (selectedVersion && onRevert) {
      if (confirm(`Revert to version ${selectedVersion.version}?`)) {
        onRevert(selectedVersion.id);
      }
    }
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  /**
   * Render version list
   */
  const renderVersionList = () => (
    <div className="version-list">
      {isLoading ? (
        <div className="loading">Loading version history...</div>
      ) : versions.length === 0 ? (
        <div className="empty-state">No version history available</div>
      ) : (
        <div className="version-timeline">
          {versions.map((version, idx) => (
            <div
              key={version.id}
              className={`version-item ${
                version.id === currentVersionId ? 'current' : ''
              } ${viewMode === 'compare' && compareSelection.left?.id === version.id ? 'compare-left' : ''}
              ${viewMode === 'compare' && compareSelection.right?.id === version.id ? 'compare-right' : ''}`}
              onClick={() => {
                if (viewMode === 'compare') {
                  const side = !compareSelection.left ? 'left' : 'right';
                  handleCompareSelect(version, side);
                } else {
                  handleVersionClick(version);
                }
              }}
            >
              <div className="version-marker">
                <div className="version-dot" />
                {idx < versions.length - 1 && <div className="version-line" />}
              </div>
              <div className="version-content">
                <div className="version-header">
                  <span className="version-number">{version.version}</span>
                  <span className="version-time">
                    {formatTimestamp(version.createdAt)}
                  </span>
                  {version.id === currentVersionId && (
                    <span className="current-badge">Current</span>
                  )}
                </div>
                <div className="version-message">{version.message}</div>
                <div className="version-meta">
                  <span className="version-author">{version.author}</span>
                  <span className="version-size">
                    {(version.content.length / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /**
   * Render version detail
   */
  const renderVersionDetail = () => {
    if (!selectedVersion) return null;

    return (
      <div className="version-detail">
        <div className="detail-header">
          <button
            className="btn-back"
            onClick={() => setViewMode('list')}
          >
            ← Back to history
          </button>
          <div className="detail-actions">
            {selectedVersion.id !== currentVersionId && (
              <button className="btn-warning" onClick={handleRevert}>
                Revert to this version
              </button>
            )}
          </div>
        </div>
        <div className="detail-info">
          <h3>Version {selectedVersion.version}</h3>
          <p className="detail-message">{selectedVersion.message}</p>
          <div className="detail-meta">
            <span>By {selectedVersion.author}</span>
            <span>{new Date(selectedVersion.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="detail-content">
          <pre>{selectedVersion.content}</pre>
        </div>
      </div>
    );
  };

  /**
   * Render compare view
   */
  const renderCompareView = () => (
    <div className="version-compare">
      <div className="compare-header">
        <button className="btn-secondary" onClick={toggleCompareMode}>
          Exit compare mode
        </button>
        {compareSelection.left && compareSelection.right && (
          <div className="compare-info">
            Comparing {compareSelection.left.version} → {compareSelection.right.version}
          </div>
        )}
      </div>
      <div className="compare-instructions">
        <p>Click two versions to compare them</p>
      </div>
      {renderVersionList()}
    </div>
  );

  /**
   * Render diff view
   */
  const renderDiffView = () => {
    if (!currentDiff) return null;

    return (
      <div className="diff-view">
        <div className="diff-header">
          <button
            className="btn-back"
            onClick={() => {
              setCurrentDiff(null);
              setViewMode('list');
            }}
          >
            ← Back
          </button>
          <div className="diff-stats">
            <span className="diff-additions">+{currentDiff.additions} lines</span>
            <span className="diff-deletions">-{currentDiff.deletions} lines</span>
          </div>
        </div>
        <div className="diff-hunks">
          {currentDiff.hunks.map((hunk, idx) => (
            <div key={idx} className="diff-hunk">
              <div className="hunk-header">
                @@ -{hunk.startLineA}, +{hunk.startLineB} @@
              </div>
              {hunk.lines.map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  className={`diff-line diff-line-${line.type}`}
                >
                  <span className="line-number-a">{line.lineNumberA || ''}</span>
                  <span className="line-number-b">{line.lineNumberB || ''}</span>
                  <span className="line-content">{line.content}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="version-history">
      <div className="history-header">
        <h3>Version History</h3>
        <div className="history-actions">
          {versions.length > 1 && (
            <button
              className="btn-secondary"
              onClick={toggleCompareMode}
              disabled={viewMode === 'compare'}
            >
              {viewMode === 'compare' ? 'Comparing...' : 'Compare versions'}
            </button>
          )}
        </div>
      </div>

      <div className="history-content">
        {viewMode === 'list' && renderVersionList()}
        {viewMode === 'detail' && renderVersionDetail()}
        {viewMode === 'compare' && renderCompareView()}
        {currentDiff && renderDiffView()}
      </div>
    </div>
  );
};

export default VersionHistory;
