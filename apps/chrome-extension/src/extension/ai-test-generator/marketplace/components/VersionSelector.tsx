/**
 * Version Selector Component
 * Allows users to view and switch between template versions
 */

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Dropdown,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import type { TemplateVersion } from '../types';

const { Text } = Typography;

interface VersionSelectorProps {
  versions: TemplateVersion[];
  currentVersion: string;
  onVersionChange: (version: string) => void;
  showChangelog?: boolean;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({
  versions,
  currentVersion,
  onVersionChange,
  showChangelog = false,
}) => {
  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => {
      // Sort by version number descending (newest first)
      return compareVersions(b.version, a.version);
    });
  }, [versions]);

  const currentVersionInfo = useMemo(() => {
    return versions.find((v) => v.version === currentVersion);
  }, [versions, currentVersion]);

  const latestVersion = sortedVersions[0]?.version;
  const isLatest = currentVersion === latestVersion;

  const handleVersionSelect = useCallback(
    (version: string) => {
      if (version !== currentVersion) {
        onVersionChange(version);
      }
    },
    [currentVersion, onVersionChange]
  );

  const menuItems: MenuProps['items'] = useMemo(() => {
    return sortedVersions.map((v) => ({
      key: v.version,
      label: (
        <Space>
          <Text>{v.version}</Text>
          {v.version === latestVersion && (
            <Tag color="green" style={{ marginLeft: 4 }}>
              Latest
            </Tag>
          )}
          {v.version === currentVersion && (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          )}
        </Space>
      ),
      onClick: () => handleVersionSelect(v.version),
    }));
  }, [sortedVersions, latestVersion, currentVersion, handleVersionSelect]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (versions.length === 0) {
    return null;
  }

  if (versions.length === 1) {
    return (
      <Tag icon={<ClockCircleOutlined />} color="default">
        v{currentVersion}
      </Tag>
    );
  }

  return (
    <div className="version-selector">
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button size="small">
              <Space>
                <HistoryOutlined />
                v{currentVersion}
                {!isLatest && (
                  <Tooltip title="Newer version available">
                    <Badge status="warning" />
                  </Tooltip>
                )}
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>

          {!isLatest && (
            <Button
              type="link"
              size="small"
              onClick={() => handleVersionSelect(latestVersion)}
            >
              Update to v{latestVersion}
            </Button>
          )}
        </Space>

        {showChangelog && currentVersionInfo && (
          <div className="version-changelog" style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Released {formatDate(currentVersionInfo.publishedAt)}
            </Text>
            {currentVersionInfo.changelog && (
              <Timeline
                style={{ marginTop: 8, marginBottom: 0 }}
                items={currentVersionInfo.changelog.map((change, index) => ({
                  key: index,
                  color: getChangeColor(change),
                  children: (
                    <Text style={{ fontSize: 12 }}>{change}</Text>
                  ),
                }))}
              />
            )}
          </div>
        )}
      </Space>
    </div>
  );
};

/**
 * Compare two semantic version strings
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const bParts = b.split('.').map((p) => Number.parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  return 0;
}

/**
 * Get timeline color based on change type
 */
function getChangeColor(change: string): string {
  const lower = change.toLowerCase();
  if (lower.startsWith('fix') || lower.includes('bug')) {
    return 'red';
  }
  if (lower.startsWith('add') || lower.includes('new') || lower.includes('feature')) {
    return 'green';
  }
  if (lower.startsWith('improve') || lower.includes('update') || lower.includes('enhance')) {
    return 'blue';
  }
  if (lower.startsWith('break') || lower.includes('deprecated')) {
    return 'orange';
  }
  return 'gray';
}

export default VersionSelector;
