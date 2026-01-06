/**
 * Fix Suggestion Card Component
 * Displays a single fix suggestion with apply button
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  EditOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Collapse,
  Input,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { FixSuggestion } from '../../types/debugAssistant';

const { Text, Paragraph } = Typography;

interface FixSuggestionCardProps {
  description: string;
  code?: string;
  confidence?: number;
  type?: FixSuggestion['type'];
  onApply?: () => Promise<void>;
  onReject?: () => void;
  onEdit?: (newCode: string) => void;
  loading?: boolean;
  compact?: boolean;
}

/**
 * Get confidence color
 */
function getConfidenceColor(confidence?: number): string {
  if (!confidence) return 'default';
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'error';
}

/**
 * Get confidence text
 */
function getConfidenceLabel(confidence?: number): string {
  if (!confidence) return '';
  if (confidence >= 0.8) return '高';
  if (confidence >= 0.6) return '中';
  return '低';
}

/**
 * Get type icon
 */
function getTypeIcon(type?: FixSuggestion['type']) {
  switch (type) {
    case 'wait':
    case 'timeout':
      return '⏱️';
    case 'locator':
      return '🎯';
    case 'retry':
      return '🔄';
    case 'assertion':
      return '✓';
    case 'action':
      return '▶️';
    case 'debug':
      return '🔍';
    default:
      return '💡';
  }
}

/**
 * Get type label
 */
function getTypeLabel(type?: FixSuggestion['type']): string {
  switch (type) {
    case 'wait':
      return '等待';
    case 'timeout':
      return '超时';
    case 'locator':
      return '选择器';
    case 'retry':
      return '重试';
    case 'assertion':
      return '断言';
    case 'action':
      return '操作';
    case 'debug':
      return '调试';
    case 'navigation':
      return '导航';
    case 'auth':
      return '认证';
    default:
      return '建议';
  }
}

export function FixSuggestionCard({
  description,
  code,
  confidence,
  type,
  onApply,
  onReject,
  onEdit,
  loading = false,
  compact = false,
}: FixSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code || '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveEdit = () => {
    onEdit?.(editedCode);
    setEditing(false);
  };

  if (compact) {
    return (
      <div
        style={{
          padding: '8px 12px',
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          marginBottom: 8,
        }}
      >
        <Space>
          <span>{getTypeIcon(type)}</span>
          <Text ellipsis style={{ maxWidth: 200 }}>
            {description}
          </Text>
          {confidence !== undefined && (
            <Tag color={getConfidenceColor(confidence)}>
              {Math.round(confidence * 100)}%
            </Tag>
          )}
          {onApply && (
            <Button
              size="small"
              type="primary"
              onClick={onApply}
              loading={loading}
            >
              应用
            </Button>
          )}
        </Space>
      </div>
    );
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      bodyStyle={{ padding: 12 }}
      extra={
        <Space>
          {type && (
            <Tooltip title={getTypeLabel(type)}>
              <span style={{ fontSize: 16 }}>{getTypeIcon(type)}</span>
            </Tooltip>
          )}
          {confidence !== undefined && (
            <Tooltip title={`置信度: ${getConfidenceLabel(confidence)}`}>
              <Tag color={getConfidenceColor(confidence)}>
                {Math.round(confidence * 100)}%
              </Tag>
            </Tooltip>
          )}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* Description */}
        <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
          <InfoCircleOutlined style={{ marginRight: 4, color: '#1890ff' }} />
          {description}
        </Paragraph>

        {/* Code block */}
        {code && (
          <div>
            <Collapse
              ghost
              size="small"
              items={[
                {
                  key: 'code',
                  label: (
                    <Space>
                      <CodeOutlined />
                      <Text style={{ fontSize: 12 }}>代码</Text>
                    </Space>
                  ),
                  children: editing ? (
                    <div>
                      <Input.TextArea
                        value={editedCode}
                        onChange={(e) => setEditedCode(e.target.value)}
                        autoSize={{ minRows: 3, maxRows: 10 }}
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                      />
                      <Space style={{ marginTop: 8 }}>
                        <Button
                          size="small"
                          type="primary"
                          onClick={handleSaveEdit}
                        >
                          保存
                        </Button>
                        <Button size="small" onClick={() => setEditing(false)}>
                          取消
                        </Button>
                      </Space>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <pre
                        style={{
                          background: '#f5f5f5',
                          padding: 12,
                          borderRadius: 4,
                          fontSize: 12,
                          overflow: 'auto',
                          maxHeight: 200,
                        }}
                      >
                        {code}
                      </pre>
                      <Space style={{ marginTop: 8 }}>
                        <Button
                          size="small"
                          icon={
                            copied ? <CheckCircleOutlined /> : <CopyOutlined />
                          }
                          onClick={handleCopy}
                        >
                          {copied ? '已复制' : '复制'}
                        </Button>
                        {onEdit && (
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => setEditing(true)}
                          >
                            编辑
                          </Button>
                        )}
                      </Space>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* Action buttons */}
        <Space>
          {onApply && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={onApply}
              loading={loading}
            >
              应用修复
            </Button>
          )}
          {onReject && (
            <Button
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={onReject}
              disabled={loading}
            >
              忽略
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
}

/**
 * Compact list of fix suggestions
 */
interface FixSuggestionListProps {
  suggestions: Array<{
    description: string;
    code?: string;
    confidence?: number;
    type?: FixSuggestion['type'];
  }>;
  onApply?: (index: number) => Promise<void>;
  onReject?: (index: number) => void;
  loading?: boolean;
}

export function FixSuggestionList({
  suggestions,
  onApply,
  onReject,
  loading,
}: FixSuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Text type="secondary">暂无修复建议</Text>
      </div>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {suggestions.map((suggestion, index) => (
        <FixSuggestionCard
          key={index}
          {...suggestion}
          onApply={onApply ? () => onApply(index) : undefined}
          onReject={onReject ? () => onReject(index) : undefined}
          loading={loading}
          compact
        />
      ))}
    </Space>
  );
}
