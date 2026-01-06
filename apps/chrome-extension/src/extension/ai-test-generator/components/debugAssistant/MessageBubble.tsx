/**
 * Message Bubble Component
 * Displays a single message in the debug assistant chat
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Card, Divider, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import type {
  DebugAction,
  FixSuggestion,
  Message,
} from '../../types/debugAssistant';
import { ActionButtonGroup } from './ActionButton';
import {
  FixSuggestionCard,
  FixSuggestionList as FixSuggestionListCard,
} from './FixSuggestionCard';

const { Text, Paragraph } = Typography;

interface MessageBubbleProps {
  message: Message;
  onExecuteAction?: (action: DebugAction) => Promise<void>;
  onApplyFix?: (fix: FixSuggestion) => Promise<void>;
  loading?: boolean;
}

export function MessageBubble({
  message,
  onExecuteAction,
  onApplyFix,
  loading = false,
}: MessageBubbleProps) {
  const [expandedActions, setExpandedActions] = useState(false);
  const [expandedSuggestions, setExpandedSuggestions] = useState(false);

  const isUser = message.role === 'user';
  const isError = !!message.error;

  // Get actions from message
  const actions = message.actions || [];
  const suggestions = message.suggestions || [];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
        }}
      >
        {!isUser && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: isError ? '#ff4d4f' : '#1890ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isError ? (
              <CloseCircleOutlined style={{ color: '#fff' }} />
            ) : (
              <RobotOutlined style={{ color: '#fff' }} />
            )}
          </div>
        )}
        <div>
          <Card
            size="small"
            style={{
              backgroundColor: isUser
                ? '#e6f7ff'
                : isError
                  ? '#fff2f0'
                  : '#f5f5f5',
              border: isUser
                ? '1px solid #91d5ff'
                : isError
                  ? '1px solid #ffccc7'
                  : '1px solid #d9d9d9',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space>
                {!isUser && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    助手
                  </Text>
                )}
                {isError && <Tag color="red">错误</Tag>}
              </Space>
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {message.content}
              </Paragraph>

              {/* Actions */}
              {actions.length > 0 && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <div>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => setExpandedActions(!expandedActions)}
                    >
                      {expandedActions ? '隐藏' : '显示'} 操作 ({actions.length}
                      )
                    </Button>
                    {expandedActions && (
                      <div style={{ marginTop: 8 }}>
                        <ActionButtonGroup
                          actions={actions}
                          onExecute={onExecuteAction}
                          loading={loading}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <div>
                    <Button
                      size="small"
                      type="text"
                      onClick={() =>
                        setExpandedSuggestions(!expandedSuggestions)
                      }
                    >
                      {expandedSuggestions ? '隐藏' : '显示'} 建议 (
                      {suggestions.length})
                    </Button>
                    {expandedSuggestions && (
                      <div style={{ marginTop: 8 }}>
                        <FixSuggestionListWrapper
                          suggestions={suggestions}
                          onApply={onApplyFix}
                          loading={loading}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </Space>
          </Card>
          {!isUser && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </div>
        {isUser && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#52c41a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <UserOutlined style={{ color: '#fff' }} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version of message bubble
 */
interface MessageBubbleCompactProps {
  message: Message;
  onExecuteAction?: (action: DebugAction) => Promise<void>;
  onApplyFix?: (fix: FixSuggestion) => Promise<void>;
  loading?: boolean;
}

export function MessageBubbleCompact({
  message,
  onExecuteAction,
  onApplyFix,
  loading = false,
}: MessageBubbleCompactProps) {
  const isUser = message.role === 'user';
  const actions = message.actions || [];
  const suggestions = message.suggestions || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {isUser ? (
          <UserOutlined style={{ color: '#52c41a' }} />
        ) : (
          <RobotOutlined style={{ color: '#1890ff' }} />
        )}
        <Text style={{ fontSize: 12 }} ellipsis>
          {message.content.slice(0, 100)}
          {message.content.length > 100 && '...'}
        </Text>
      </div>
      {actions.length > 0 && (
        <ActionButtonGroup
          actions={actions}
          onExecute={onExecuteAction}
          loading={loading}
          size="small"
        />
      )}
      {suggestions.length > 0 && (
        <FixSuggestionListWrapper
          suggestions={suggestions}
          onApply={onApplyFix}
          loading={loading}
          compact
        />
      )}
    </div>
  );
}

/**
 * Fix suggestion list wrapper - converts FixSuggestion to format expected by FixSuggestionList
 */
interface FixSuggestionListWrapperProps {
  suggestions: FixSuggestion[];
  onApply?: (fix: FixSuggestion) => Promise<void>;
  loading?: boolean;
  compact?: boolean;
}

function FixSuggestionListWrapper({
  suggestions,
  onApply,
  loading,
  compact,
}: FixSuggestionListWrapperProps) {
  // Convert FixSuggestion[] to the format expected by FixSuggestionList
  const convertedSuggestions = suggestions.map((s) => ({
    description: s.description,
    code: s.code,
    confidence: s.confidence,
    type: s.type,
  }));

  const handleApply = async (index: number) => {
    await onApply?.(suggestions[index]);
  };

  return (
    <FixSuggestionListCard
      suggestions={convertedSuggestions}
      onApply={onApply ? handleApply : undefined}
      loading={loading}
    />
  );
}
