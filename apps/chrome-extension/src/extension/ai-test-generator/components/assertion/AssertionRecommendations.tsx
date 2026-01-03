/**
 * Assertion Recommendations Component
 * Displays a list of assertion recommendations with keyboard navigation
 */

import {
  BulbOutlined,
  CloseOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Empty,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { assertionValidator } from '../../services/assertion';
import type {
  AssertionRecommendation,
  ValidationResult,
} from '../../types/assertion';
import { AssertionCard } from './AssertionCard';

const { Text } = Typography;

interface AssertionRecommendationsProps {
  recommendations: AssertionRecommendation[];
  loading?: boolean;
  onAccept?: (recommendation: AssertionRecommendation) => void;
  onReject?: (recommendation: AssertionRecommendation) => void;
  onEdit?: (recommendation: AssertionRecommendation) => void;
  onSaveAsTemplate?: (recommendation: AssertionRecommendation) => void;
  onRefresh?: () => void;
  onClose?: () => void;
  onSettings?: () => void;
  showPreview?: boolean;
  autoValidate?: boolean;
}

export function AssertionRecommendations({
  recommendations,
  loading = false,
  onAccept,
  onReject,
  onEdit,
  onSaveAsTemplate,
  onRefresh,
  onClose,
  onSettings,
  showPreview = true,
  autoValidate = true,
}: AssertionRecommendationsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [validationResults, setValidationResults] = useState<
    Map<string, ValidationResult>
  >(new Map());
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set());

  // Reset selection when recommendations change
  useEffect(() => {
    setSelectedIndex(0);
    setValidationResults(new Map());
  }, [recommendations]);

  // Auto-validate recommendations
  useEffect(() => {
    if (autoValidate && showPreview && recommendations.length > 0) {
      validateAll();
    }
  }, [recommendations, autoValidate, showPreview]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (recommendations.length === 0) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'Tab':
          if (e.shiftKey || e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : recommendations.length - 1,
            );
          } else {
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev < recommendations.length - 1 ? prev + 1 : 0,
            );
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < recommendations.length - 1 ? prev + 1 : 0,
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (recommendations[selectedIndex]) {
            onAccept?.(recommendations[selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (recommendations[selectedIndex]) {
            onReject?.(recommendations[selectedIndex]);
          }
          break;

        case 'e':
        case 'E':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (recommendations[selectedIndex]) {
              onEdit?.(recommendations[selectedIndex]);
            }
          }
          break;

        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (recommendations[selectedIndex]) {
              onSaveAsTemplate?.(recommendations[selectedIndex]);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    recommendations,
    selectedIndex,
    onAccept,
    onReject,
    onEdit,
    onSaveAsTemplate,
  ]);

  // Validate single recommendation
  const validateRecommendation = useCallback(
    async (recommendation: AssertionRecommendation) => {
      if (validatingIds.has(recommendation.id)) return;

      setValidatingIds((prev) => new Set(prev).add(recommendation.id));

      try {
        const result = await assertionValidator.validate(recommendation);
        setValidationResults((prev) => {
          const next = new Map(prev);
          next.set(recommendation.id, result);
          return next;
        });
      } finally {
        setValidatingIds((prev) => {
          const next = new Set(prev);
          next.delete(recommendation.id);
          return next;
        });
      }
    },
    [validatingIds],
  );

  // Validate all recommendations
  const validateAll = useCallback(async () => {
    for (const rec of recommendations) {
      await validateRecommendation(rec);
    }
  }, [recommendations, validateRecommendation]);

  // Get count of passed validations
  const passedCount = Array.from(validationResults.values()).filter(
    (r) => r.success,
  ).length;

  if (loading) {
    return (
      <Card size="small" className="assertion-recommendations loading">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">分析中...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null; // Don't show empty panel
  }

  return (
    <Card
      size="small"
      className="assertion-recommendations"
      title={
        <Space>
          <BulbOutlined style={{ color: '#faad14' }} />
          <span>断言推荐</span>
          <Badge
            count={recommendations.length}
            style={{ backgroundColor: '#1890ff' }}
          />
          {showPreview && validationResults.size > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({passedCount}/{validationResults.size} 通过)
            </Text>
          )}
        </Space>
      }
      extra={
        <Space size="small">
          {onRefresh && (
            <Tooltip title="刷新推荐">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
              />
            </Tooltip>
          )}
          {onSettings && (
            <Tooltip title="设置">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={onSettings}
              />
            </Tooltip>
          )}
          {onClose && (
            <Tooltip title="关闭">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={onClose}
              />
            </Tooltip>
          )}
        </Space>
      }
    >
      {/* Keyboard shortcuts hint */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          backgroundColor: '#fafafa',
          borderRadius: 4,
          fontSize: 11,
        }}
      >
        <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
          <Text type="secondary">
            <kbd>↑↓</kbd> 选择
          </Text>
          <Text type="secondary">
            <kbd>Enter</kbd> 采用
          </Text>
          <Text type="secondary">
            <kbd>Esc</kbd> 跳过
          </Text>
          <Text type="secondary">
            <kbd>E</kbd> 编辑
          </Text>
          <Text type="secondary">
            <kbd>S</kbd> 保存模板
          </Text>
        </Space>
      </div>

      {/* Recommendations list */}
      <div className="recommendations-list">
        {recommendations.map((recommendation, index) => (
          <AssertionCard
            key={recommendation.id}
            recommendation={recommendation}
            validationResult={validationResults.get(recommendation.id)}
            isValidating={validatingIds.has(recommendation.id)}
            onAccept={onAccept}
            onReject={onReject}
            onEdit={onEdit}
            onSaveAsTemplate={onSaveAsTemplate}
            onValidate={validateRecommendation}
            showPreview={showPreview}
            selected={index === selectedIndex}
          />
        ))}
      </div>
    </Card>
  );
}

export default AssertionRecommendations;
