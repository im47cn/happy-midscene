/**
 * Quick Questions Component
 * Displays quick question buttons for common debugging actions
 */

import {
  BugOutlined,
  CameraOutlined,
  DiffOutlined,
  EyeOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Card, Divider, Input, Space, Tooltip, Typography } from 'antd';
import type { QuickQuestion } from '../../types/debugAssistant';

const { Text } = Typography;

interface QuickQuestionsProps {
  questions: QuickQuestion[];
  onSelect?: (question: QuickQuestion) => void;
  disabled?: boolean;
  columns?: number;
  size?: 'small' | 'middle' | 'large';
}

/**
 * Get icon for quick question based on content
 */
function getQuestionIcon(question: string | QuickQuestion): React.ReactNode {
  const text =
    typeof question === 'string'
      ? question
      : question.question || question.text || '';

  if (!text) {
    return <QuestionCircleOutlined />;
  }
  if (text.includes('显示') || text.includes('show')) {
    return <EyeOutlined />;
  }
  if (text.includes('解释') || text.includes('explain')) {
    return <BugOutlined />;
  }
  if (text.includes('截图') || text.includes('screenshot')) {
    return <CameraOutlined />;
  }
  if (text.includes('对比') || text.includes('compare')) {
    return <DiffOutlined />;
  }
  if (text.includes('网络') || text.includes('network')) {
    return <GlobalOutlined />;
  }
  if (
    text.includes('元素') ||
    text.includes('element') ||
    text.includes('locate')
  ) {
    return <SearchOutlined />;
  }
  if (
    text.includes('执行') ||
    text.includes('run') ||
    text.includes('execute')
  ) {
    return <PlayCircleOutlined />;
  }

  return <QuestionCircleOutlined />;
}

/**
 * Get button color based on question type
 */
function getQuestionType(
  question: string | QuickQuestion,
): 'default' | 'primary' {
  const text =
    typeof question === 'string'
      ? question
      : question.question || question.text;

  if (text.includes('显示') || text.includes('show')) {
    return 'default';
  }
  if (text.includes('解释') || text.includes('explain')) {
    return 'primary';
  }
  if (
    text.includes('执行') ||
    text.includes('run') ||
    text.includes('execute')
  ) {
    return 'primary';
  }

  return 'default';
}

/**
 * Get question text (with fallback)
 */
function getQuestionText(question: QuickQuestion): string {
  return question.question || question.text;
}

export function QuickQuestions({
  questions,
  onSelect,
  disabled = false,
  columns = 2,
  size = 'middle',
}: QuickQuestionsProps) {
  // Group questions by category
  const groups = {
    基本信息: questions.filter(
      (q) =>
        getQuestionText(q).includes('显示') ||
        getQuestionText(q).includes('状态'),
    ),
    调试操作: questions.filter(
      (q) =>
        getQuestionText(q).includes('高亮') ||
        getQuestionText(q).includes('定位'),
    ),
    对比分析: questions.filter(
      (q) =>
        getQuestionText(q).includes('对比') ||
        getQuestionText(q).includes('检查'),
    ),
  };

  // Flatten back if too few questions
  const useGroups = questions.length > 6;

  const handleClick = (question: QuickQuestion) => {
    if (!disabled) {
      onSelect?.(question);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Text
        type="secondary"
        style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
      >
        快捷问题
      </Text>

      {useGroups ? (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {Object.entries(groups).map(([groupName, groupQuestions]) =>
            groupQuestions.length > 0 ? (
              <div key={groupName}>
                <Text strong style={{ fontSize: 12, color: '#595959' }}>
                  {groupName}
                </Text>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {groupQuestions.map((question) => (
                    <Tooltip
                      key={question.id}
                      title={question.context || getQuestionText(question)}
                    >
                      <Button
                        size={size}
                        icon={getQuestionIcon(question)}
                        onClick={() => handleClick(question)}
                        disabled={disabled}
                        style={{
                          textAlign: 'left',
                          height: 'auto',
                          padding: '8px 12px',
                        }}
                      >
                        <span style={{ fontSize: 12 }}>
                          {getQuestionText(question)}
                        </span>
                      </Button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </Space>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 8,
          }}
        >
          {questions.map((question) => (
            <Tooltip
              key={question.id}
              title={question.context || getQuestionText(question)}
            >
              <Button
                size={size}
                type={getQuestionType(question)}
                icon={getQuestionIcon(question)}
                onClick={() => handleClick(question)}
                disabled={disabled}
                style={{
                  textAlign: 'left',
                  height: 'auto',
                  padding: '8px 12px',
                }}
              >
                <span style={{ fontSize: 12 }}>
                  {getQuestionText(question)}
                </span>
              </Button>
            </Tooltip>
          ))}
        </div>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* Custom input prompt */}
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          自定义问题
        </Text>
        <Input.TextArea
          placeholder="输入你的问题..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={disabled}
          onPressEnter={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            const target = e.target as HTMLTextAreaElement;
            if (target.value.trim() && !disabled) {
              onSelect?.({
                id: 'custom',
                text: target.value,
                question: target.value,
                category: 'reason',
                icon: '❓',
              });
              target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}

/**
 * Compact quick question buttons for toolbar
 */
interface QuickQuestionsCompactProps {
  questions: QuickQuestion[];
  onSelect?: (question: QuickQuestion) => void;
  disabled?: boolean;
  maxVisible?: number;
}

export function QuickQuestionsCompact({
  questions,
  onSelect,
  disabled = false,
  maxVisible = 4,
}: QuickQuestionsCompactProps) {
  const visibleQuestions = questions.slice(0, maxVisible);
  const hasMore = questions.length > maxVisible;

  return (
    <Space size="small">
      {visibleQuestions.map((question) => (
        <Tooltip key={question.id} title={getQuestionText(question)}>
          <Button
            size="small"
            icon={getQuestionIcon(question)}
            onClick={() => onSelect?.(question)}
            disabled={disabled}
          />
        </Tooltip>
      ))}
      {hasMore && (
        <Tooltip title="更多问题">
          <Button
            size="small"
            icon={<QuestionCircleOutlined />}
            disabled={disabled}
          />
        </Tooltip>
      )}
    </Space>
  );
}

/**
 * Quick question category card
 */
interface QuickQuestionCategoryProps {
  title: string;
  icon?: React.ReactNode;
  questions: QuickQuestion[];
  onSelect?: (question: QuickQuestion) => void;
  disabled?: boolean;
}

export function QuickQuestionCategory({
  title,
  icon,
  questions,
  onSelect,
  disabled,
}: QuickQuestionCategoryProps) {
  return (
    <Card
      size="small"
      title={
        <Space>
          {icon}
          {title}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {questions.map((question) => (
          <Button
            key={question.id}
            block
            size="small"
            icon={getQuestionIcon(question)}
            onClick={() => onSelect?.(question)}
            disabled={disabled}
            style={{ textAlign: 'left' }}
          >
            {question.question}
          </Button>
        ))}
      </Space>
    </Card>
  );
}
