/**
 * Test Case Preview Component
 * Shows parsed test cases and allows execution
 */

import {
  BorderOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Input,
  List,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useGeneratorStore } from '../store';
import type { TaskStep, TestCase } from '../types';

const { Text, Title } = Typography;
const { Panel } = Collapse;

interface StepItemProps {
  step: TaskStep;
  index: number;
  onEdit?: (stepId: string, newText: string) => void;
  onDelete?: (stepId: string) => void;
}

function StepItem({ step, index, onEdit, onDelete }: StepItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(step.originalText);

  const getStatusIcon = () => {
    switch (step.status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'skipped':
        return <Tag color="default">跳过</Tag>;
      default:
        return <span style={{ color: '#d9d9d9' }}>○</span>;
    }
  };

  const handleSave = () => {
    if (editText.trim() && onEdit) {
      onEdit(step.id, editText.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className={`step-item step-${step.status}`}>
      <div className="step-number">{index + 1}.</div>
      <div className="step-status">{getStatusIcon()}</div>
      <div className="step-content">
        {isEditing ? (
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onPressEnter={handleSave}
            onBlur={handleSave}
            autoFocus
            size="small"
          />
        ) : (
          <Text
            className={step.status === 'failed' ? 'step-failed-text' : ''}
            onClick={() => setIsEditing(true)}
            style={{ cursor: 'pointer' }}
          >
            {step.originalText}
          </Text>
        )}
        {step.error && (
          <div className="step-error">
            <Text type="danger" style={{ fontSize: 12 }}>
              {step.error}
            </Text>
          </div>
        )}
      </div>
      <div className="step-actions">
        {!isEditing && (
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
            />
            {onDelete && (
              <Popconfirm
                title="确定删除此步骤?"
                onConfirm={() => onDelete(step.id)}
                okText="删除"
                cancelText="取消"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Popconfirm>
            )}
          </Space>
        )}
      </div>
    </div>
  );
}

interface TestCaseCardProps {
  testCase: TestCase;
  selected?: boolean;
  onSelect?: (caseId: string, selected: boolean) => void;
  onExecute?: (testCase: TestCase) => void;
  onEditStep?: (caseId: string, stepId: string, newText: string) => void;
  onDeleteStep?: (caseId: string, stepId: string) => void;
  onAddStep?: (caseId: string) => void;
}

function TestCaseCard({
  testCase,
  selected = false,
  onSelect,
  onExecute,
  onEditStep,
  onDeleteStep,
  onAddStep,
}: TestCaseCardProps) {
  const completedSteps = testCase.steps.filter(
    (s) => s.status === 'success',
  ).length;
  const failedSteps = testCase.steps.filter(
    (s) => s.status === 'failed',
  ).length;
  const totalSteps = testCase.steps.length;

  return (
    <Card
      className={`test-case-card ${selected ? 'selected' : ''}`}
      size="small"
      title={
        <Space>
          {onSelect && (
            <Checkbox
              checked={selected}
              onChange={(e) => onSelect(testCase.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Text strong>{testCase.name}</Text>
          <Tag color="blue">{totalSteps} 步骤</Tag>
          {completedSteps > 0 && (
            <Tag color="success">{completedSteps} 完成</Tag>
          )}
          {failedSteps > 0 && <Tag color="error">{failedSteps} 失败</Tag>}
        </Space>
      }
      extra={
        onExecute && (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => onExecute(testCase)}
          >
            执行
          </Button>
        )
      }
    >
      {testCase.description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {testCase.description}
        </Text>
      )}

      <div className="steps-list">
        {testCase.steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            onEdit={
              onEditStep
                ? (stepId, newText) => onEditStep(testCase.id, stepId, newText)
                : undefined
            }
            onDelete={
              onDeleteStep
                ? (stepId) => onDeleteStep(testCase.id, stepId)
                : undefined
            }
          />
        ))}
      </div>

      {onAddStep && (
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onAddStep(testCase.id)}
          style={{ marginTop: 8 }}
          block
        >
          添加步骤
        </Button>
      )}

      {testCase.potentialParams.length > 0 && (
        <div className="params-section">
          <Text type="secondary" style={{ fontSize: 12 }}>
            识别到的参数:
          </Text>
          <div className="params-list">
            {testCase.potentialParams.map((param, i) => (
              <Tag key={i} color="orange">
                {param.value}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function TestCasePreview() {
  const { parseResult, setCurrentView, executionStatus, setSelectedCaseIds } =
    useGeneratorStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Calculate selection state
  const allCaseIds = useMemo(
    () => parseResult?.cases.map((c) => c.id) || [],
    [parseResult],
  );

  const isAllSelected =
    selectedIds.size === allCaseIds.length && allCaseIds.length > 0;
  const isPartialSelected =
    selectedIds.size > 0 && selectedIds.size < allCaseIds.length;

  const selectedCount = selectedIds.size;
  const selectedStepsCount = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.cases
      .filter((c) => selectedIds.has(c.id))
      .reduce((acc, c) => acc + c.steps.length, 0);
  }, [parseResult, selectedIds]);

  if (!parseResult || parseResult.cases.length === 0) {
    return (
      <Empty description="暂无测试用例" style={{ padding: '40px 0' }}>
        <Button type="primary" onClick={() => setCurrentView('input')}>
          返回输入
        </Button>
      </Empty>
    );
  }

  const handleSelectCase = (caseId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(caseId);
      } else {
        next.delete(caseId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allCaseIds));
    }
  };

  const handleExecuteSelected = () => {
    // Store selected case IDs for execution
    setSelectedCaseIds(Array.from(selectedIds));
    setCurrentView('execute');
  };

  const handleExecuteAll = () => {
    // Clear selection to execute all
    setSelectedCaseIds([]);
    setCurrentView('execute');
  };

  const handleBack = () => {
    setCurrentView('input');
  };

  return (
    <div className="test-case-preview-container">
      <div className="preview-header">
        <div className="header-title">
          <Title level={5} style={{ margin: 0 }}>
            测试用例预览
          </Title>
          <Text type="secondary">
            共 {parseResult.cases.length} 个用例，
            {parseResult.cases.reduce((acc, c) => acc + c.steps.length, 0)}{' '}
            个步骤
          </Text>
        </div>
        <div className="header-actions">
          <Tooltip title={isAllSelected ? '取消全选' : '全选'}>
            <Button
              type="text"
              size="small"
              icon={
                isAllSelected ? <CheckSquareOutlined /> : <BorderOutlined />
              }
              onClick={handleSelectAll}
            >
              {isAllSelected ? '取消全选' : '全选'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="selection-info">
          <Tag color="blue">
            已选择 {selectedCount} 个用例，{selectedStepsCount} 个步骤
          </Tag>
        </div>
      )}

      <div className="preview-content">
        {parseResult.cases.map((testCase) => (
          <TestCaseCard
            key={testCase.id}
            testCase={testCase}
            selected={selectedIds.has(testCase.id)}
            onSelect={handleSelectCase}
          />
        ))}
      </div>

      <div className="preview-actions">
        <Space style={{ width: '100%' }}>
          <Button onClick={handleBack}>返回修改</Button>
          {selectedCount > 0 ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteSelected}
              loading={executionStatus === 'running'}
              style={{ flex: 1 }}
            >
              执行选中 ({selectedCount})
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteAll}
              loading={executionStatus === 'running'}
              style={{ flex: 1 }}
            >
              执行全部
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}
