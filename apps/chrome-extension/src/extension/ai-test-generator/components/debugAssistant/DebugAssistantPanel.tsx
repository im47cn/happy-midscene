/**
 * Debug Assistant Panel Component
 * Main panel content for the debug assistant
 */

import {
  ClearOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Divider, Empty, Space, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type {
  DebugAction,
  DebugContext,
  FixSuggestion,
  Message,
} from '../../types/debugAssistant';
import { ActionButtonGroup } from './ActionButton';
import { MessageBubble } from './MessageBubble';

const { Text, Paragraph } = Typography;

interface DebugAssistantPanelProps {
  messages: Message[];
  debugContext?: DebugContext;
  onExecuteAction?: (action: DebugAction) => Promise<void>;
  onApplyFix?: (fix: FixSuggestion) => Promise<void>;
  onClear?: () => void;
  loading?: boolean;
}

export function DebugAssistantPanel({
  messages,
  debugContext,
  onExecuteAction,
  onApplyFix,
  onClear,
  loading = false,
}: DebugAssistantPanelProps) {
  const [actionsInProgress, setActionsInProgress] = useState<Set<string>>(
    new Set(),
  );
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle action execution
  const handleExecuteAction = async (action: DebugAction) => {
    const actionKey = `${action.type}-${action.target || ''}`;
    setActionsInProgress((prev) => new Set(prev).add(actionKey));

    try {
      await onExecuteAction?.(action);
    } finally {
      setActionsInProgress((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  };

  // Handle fix application
  const handleApplyFix = async (fix: FixSuggestion) => {
    await onApplyFix?.(fix);
  };

  // Check if there are actions to execute
  const hasActions = messages.some(
    (msg) =>
      (msg.actions && msg.actions.length > 0) ||
      msg.content.includes('[ACTION:'),
  );

  // Check if there are suggestions to apply
  const hasSuggestions = messages.some(
    (msg) =>
      (msg.suggestions && msg.suggestions.length > 0) ||
      msg.content.includes('[SUGGESTION:'),
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#fafafa',
      }}
    >
      {/* Header with context info */}
      {debugContext && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            backgroundColor: '#fff',
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {debugContext.lastError && (
              <Alert
                message="测试失败"
                description={
                  <Text ellipsis style={{ fontSize: 12 }}>
                    {debugContext.lastError.message}
                  </Text>
                }
                type="error"
                showIcon
              />
            )}
            {debugContext.failedStep && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                失败步骤: {debugContext.failedStep}
              </Text>
            )}
            {debugContext.pageState && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                页面: {debugContext.pageState.title}
              </Text>
            )}
          </Space>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        {messages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">开始对话以获取调试帮助</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  你可以询问错误原因、请求修复建议或执行调试操作
                </Text>
              </Space>
            }
          />
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id || index}
                message={message}
                onExecuteAction={handleExecuteAction}
                onApplyFix={handleApplyFix}
                loading={loading || actionsInProgress.size > 0}
              />
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Space>
                  <Spin indicator={<LoadingOutlined spin />} />
                  <Text type="secondary">思考中...</Text>
                </Space>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with actions */}
      {(hasActions || hasSuggestions || onClear) && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #f0f0f0',
            backgroundColor: '#fff',
          }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {messages.length} 条消息
            </Text>
            {onClear && (
              <Button size="small" icon={<ClearOutlined />} onClick={onClear}>
                清空
              </Button>
            )}
          </Space>
        </div>
      )}
    </div>
  );
}

/**
 * Compact debug panel for inline display
 */
interface DebugPanelCompactProps {
  messages: Message[];
  debugContext?: DebugContext;
  onExecuteAction?: (action: DebugAction) => Promise<void>;
  onApplyFix?: (fix: FixSuggestion) => Promise<void>;
  loading?: boolean;
}

export function DebugPanelCompact({
  messages,
  debugContext,
  onExecuteAction,
  onApplyFix,
  loading,
}: DebugPanelCompactProps) {
  const lastMessage = messages[messages.length - 1];

  // Extract pending actions and suggestions from last message
  const pendingActions = lastMessage?.actions || [];
  const pendingSuggestions = lastMessage?.suggestions || [];

  return (
    <div
      style={{
        padding: 12,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 4,
      }}
    >
      {debugContext?.lastError && (
        <Alert
          message={debugContext.lastError.message.slice(0, 50)}
          type="error"
          style={{ marginBottom: 12 }}
        />
      )}

      {lastMessage && (
        <div style={{ marginBottom: 12 }}>
          <Space>
            {lastMessage.role === 'assistant' ? (
              <RobotOutlined />
            ) : (
              <UserOutlined />
            )}
            <Text ellipsis style={{ maxWidth: 300 }}>
              {lastMessage.content.slice(0, 100)}
            </Text>
          </Space>
        </div>
      )}

      {pendingActions.length > 0 && (
        <>
          <Text strong style={{ fontSize: 12 }}>
            可执行操作:
          </Text>
          <div style={{ marginTop: 8 }}>
            <ActionButtonGroup
              actions={pendingActions}
              onExecute={onExecuteAction}
              loading={loading}
            />
          </div>
        </>
      )}

      {pendingSuggestions.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong style={{ fontSize: 12 }}>
            修复建议:
          </Text>
          <div style={{ marginTop: 8 }}>
            {pendingSuggestions.map((suggestion, index) => (
              <Button
                key={index}
                size="small"
                type="primary"
                onClick={() => onApplyFix?.(suggestion)}
                loading={loading}
                style={{ marginRight: 8, marginBottom: 8 }}
              >
                {suggestion.description}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
