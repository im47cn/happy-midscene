/**
 * Assertion Card Component
 * Displays a single assertion recommendation
 */

import { useState } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Tooltip,
  Typography,
  Spin,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SaveOutlined,
  CheckOutlined,
  CloseOutlined,
  QuestionCircleOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import type { AssertionRecommendation, ValidationResult } from '../../types/assertion';
import { ASSERTION_TYPE_LABELS } from '../../types/assertion';

const { Text, Paragraph } = Typography;

interface AssertionCardProps {
  recommendation: AssertionRecommendation;
  validationResult?: ValidationResult;
  isValidating?: boolean;
  onAccept?: (recommendation: AssertionRecommendation) => void;
  onReject?: (recommendation: AssertionRecommendation) => void;
  onEdit?: (recommendation: AssertionRecommendation) => void;
  onSaveAsTemplate?: (recommendation: AssertionRecommendation) => void;
  onValidate?: (recommendation: AssertionRecommendation) => void;
  showPreview?: boolean;
  selected?: boolean;
}

/**
 * Get confidence color based on value
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#52c41a';
  if (confidence >= 60) return '#faad14';
  return '#ff4d4f';
}

/**
 * Get source tag color
 */
function getSourceColor(source: 'ai' | 'rule' | 'template'): string {
  switch (source) {
    case 'ai':
      return 'purple';
    case 'rule':
      return 'blue';
    case 'template':
      return 'green';
    default:
      return 'default';
  }
}

/**
 * Get source display text
 */
function getSourceText(source: 'ai' | 'rule' | 'template'): string {
  switch (source) {
    case 'ai':
      return 'AI';
    case 'rule':
      return '规则';
    case 'template':
      return '模板';
    default:
      return source;
  }
}

export function AssertionCard({
  recommendation,
  validationResult,
  isValidating,
  onAccept,
  onReject,
  onEdit,
  onSaveAsTemplate,
  onValidate,
  showPreview = true,
  selected = false,
}: AssertionCardProps) {
  const [showYaml, setShowYaml] = useState(false);

  const typeLabel = ASSERTION_TYPE_LABELS[recommendation.type] || recommendation.type;
  const confidenceColor = getConfidenceColor(recommendation.confidence);

  return (
    <Card
      size="small"
      className={`assertion-card ${selected ? 'selected' : ''}`}
      style={{
        marginBottom: 8,
        borderColor: selected ? '#1890ff' : undefined,
        backgroundColor: selected ? '#e6f7ff' : undefined,
      }}
    >
      {/* Header */}
      <div className="assertion-card-header">
        <Space size="small" wrap>
          <Tag color={getSourceColor(recommendation.source)}>
            {getSourceText(recommendation.source)}
          </Tag>
          <Tag>{typeLabel}</Tag>
          <Tooltip title="推荐置信度">
            <Tag
              style={{
                color: confidenceColor,
                borderColor: confidenceColor,
                backgroundColor: 'transparent',
              }}
            >
              {Math.round(recommendation.confidence)}%
            </Tag>
          </Tooltip>
        </Space>

        {/* Validation status */}
        {showPreview && (
          <div className="validation-status">
            {isValidating ? (
              <Spin size="small" />
            ) : validationResult ? (
              validationResult.success ? (
                <Tooltip title="验证通过">
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                </Tooltip>
              ) : (
                <Tooltip title={validationResult.error || '验证失败'}>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                </Tooltip>
              )
            ) : (
              <Tooltip title="点击验证">
                <QuestionCircleOutlined
                  style={{ color: '#999', cursor: 'pointer' }}
                  onClick={() => onValidate?.(recommendation)}
                />
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <Paragraph
        className="assertion-description"
        style={{ marginTop: 8, marginBottom: 4 }}
      >
        {recommendation.description}
      </Paragraph>

      {/* Reason */}
      <Text type="secondary" style={{ fontSize: 12 }}>
        {recommendation.reason}
      </Text>

      {/* YAML preview */}
      {showYaml && (
        <div
          className="yaml-preview"
          style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          <code>{recommendation.yamlOutput}</code>
        </div>
      )}

      {/* Validation error details */}
      {validationResult && !validationResult.success && validationResult.error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: '#fff2f0',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          <Text type="danger">{validationResult.error}</Text>
        </div>
      )}

      {/* Actions */}
      <div className="assertion-actions" style={{ marginTop: 12 }}>
        <Space size="small">
          <Tooltip title="采用 (Enter)">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => onAccept?.(recommendation)}
            >
              采用
            </Button>
          </Tooltip>

          <Tooltip title="跳过 (Esc)">
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={() => onReject?.(recommendation)}
            >
              跳过
            </Button>
          </Tooltip>

          <Tooltip title="编辑 (E)">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit?.(recommendation)}
            />
          </Tooltip>

          <Tooltip title="显示 YAML">
            <Button
              size="small"
              icon={<CodeOutlined />}
              onClick={() => setShowYaml(!showYaml)}
              type={showYaml ? 'primary' : 'default'}
              ghost={showYaml}
            />
          </Tooltip>

          {recommendation.source !== 'template' && (
            <Tooltip title="保存为模板 (S)">
              <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={() => onSaveAsTemplate?.(recommendation)}
              />
            </Tooltip>
          )}
        </Space>
      </div>
    </Card>
  );
}

export default AssertionCard;
