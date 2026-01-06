/**
 * Debug Assistant Component
 * Main panel for conversational debugging interface
 */

import {
  BugOutlined,
  CloseOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Badge, Button, Drawer, Input, Space, Tabs, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_QUICK_QUESTIONS } from '../../services/debugAssistant/prompts';
import type {
  DebugAction,
  DebugContext,
  FixSuggestion,
  Message,
  QuickQuestion,
} from '../../types/debugAssistant';
import { DebugAssistantPanel } from './DebugAssistantPanel';
import { QuickQuestions } from './QuickQuestions';

const { Text } = Typography;

interface DebugAssistantProps {
  open: boolean;
  debugContext?: DebugContext;
  onClose?: () => void;
  onSendMessage?: (message: string) => Promise<Message>;
  onExecuteAction?: (action: DebugAction) => Promise<void>;
  onApplyFix?: (fix: FixSuggestion) => Promise<void>;
  quickQuestions?: QuickQuestion[];
  loading?: boolean;
}

export function DebugAssistant({
  open,
  debugContext,
  onClose,
  onSendMessage,
  onExecuteAction,
  onApplyFix,
  quickQuestions = DEFAULT_QUICK_QUESTIONS,
  loading = false,
}: DebugAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'actions' | 'history'>(
    'chat',
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle quick question click
  const handleQuickQuestion = async (question: QuickQuestion) => {
    if (onSendMessage) {
      const questionText = question.question || question.text;
      setInputValue(questionText);
      // Auto-send after a short delay
      setTimeout(async () => {
        const response = await onSendMessage(questionText);
        setMessages((prev) => [...prev, response]);
        setUnreadCount(0);
      }, 100);
    }
  };

  // Handle send message
  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || !onSendMessage) return;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    try {
      // Send and get response
      const response = await onSendMessage(message);
      setMessages((prev) => [...prev, response]);
      setUnreadCount(0);
    } catch (error) {
      // Add error message
      const errorMessage: Message = {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，发生了错误：${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clear conversation
  const handleClear = () => {
    setMessages([]);
    setUnreadCount(0);
  };

  // Get error info for header
  const hasError = !!debugContext?.lastError;
  const errorType =
    debugContext?.lastError?.message?.split(':')[0] || '未知错误';

  return (
    <Drawer
      title={
        <Space>
          <BugOutlined />
          <span>调试助手</span>
          {hasError && (
            <Badge count={errorType} style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      width={500}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column' },
      }}
      extra={
        <Space>
          <Button
            type="text"
            icon={<MessageOutlined />}
            onClick={() => setActiveTab('chat')}
            disabled={activeTab === 'chat'}
          />
          <Button
            type="text"
            icon={<ThunderboltOutlined />}
            onClick={() => setActiveTab('actions')}
            disabled={activeTab === 'actions'}
          />
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            onClick={() => setActiveTab('history')}
            disabled={activeTab === 'history'}
          />
        </Space>
      }
      footer={
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
          {activeTab === 'chat' && (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入问题或选择快捷问题..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={loading}
                allowClear
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={!inputValue.trim() || loading}
                loading={loading}
              />
            </Space.Compact>
          )}
        </div>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        items={[
          {
            key: 'chat',
            label: (
              <span>
                对话
                {unreadCount > 0 && (
                  <Badge count={unreadCount} style={{ marginLeft: 8 }} />
                )}
              </span>
            ),
            children: (
              <DebugAssistantPanel
                messages={messages}
                debugContext={debugContext}
                onExecuteAction={onExecuteAction}
                onApplyFix={onApplyFix}
                onClear={handleClear}
                loading={loading}
              />
            ),
          },
          {
            key: 'actions',
            label: '操作',
            children: (
              <QuickQuestions
                questions={quickQuestions}
                onSelect={handleQuickQuestion}
                disabled={loading}
              />
            ),
          },
          {
            key: 'history',
            label: '历史',
            children: (
              <div style={{ padding: 16 }}>
                <Text type="secondary">执行历史</Text>
                {debugContext?.executionHistory?.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <Text>{step.description}</Text>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
        style={
          {
            body: { padding: 0 },
          } as any
        }
      />
      <div ref={messagesEndRef} />
    </Drawer>
  );
}

/**
 * Compact inline version of debug assistant
 */
interface DebugAssistantInlineProps {
  debugContext?: DebugContext;
  onSendMessage?: (message: string) => Promise<Message>;
  onExecuteAction?: (action: DebugAction) => Promise<void>;
}

export function DebugAssistantInline({
  debugContext,
  onSendMessage,
  onExecuteAction,
}: DebugAssistantInlineProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || !onSendMessage) return;

    setLoading(true);
    setInputValue('');

    try {
      await onSendMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        background: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
      }}
    >
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Space>
          <BugOutlined />
          <Text>调试助手</Text>
          {debugContext?.lastError && (
            <Text type="danger">
              {debugContext.lastError.message.slice(0, 30)}...
            </Text>
          )}
        </Space>
        <Button type="text" size="small">
          {expanded ? <CloseOutlined /> : <QuestionCircleOutlined />}
        </Button>
      </Space>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <Input.TextArea
            placeholder="描述问题或选择快捷操作..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleSend}
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={loading}
          />
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
              loading={loading}
            >
              发送
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
