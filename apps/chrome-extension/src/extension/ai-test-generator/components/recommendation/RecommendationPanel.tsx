/**
 * Recommendation Panel Component
 * Displays intelligent test case recommendations
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Badge, Button, Card, List, Space, Tag, Tooltip, Progress } from 'antd';
import type { ReactNode } from 'react';
import { useState, useEffect, useMemo } from 'react';
import type {
  Recommendation,
  RecommendCategory,
  Priority,
  RecommendOptions,
  Feedback,
} from '../../types/recommendation';
import { recommendEngine, feedbackTracker } from '../../services/recommendation';
import { CATEGORY_LABELS, PRIORITY_LABELS, REASON_TYPE_LABELS } from '../../types/recommendation';

interface RecommendationPanelProps {
  onSelect?: (caseIds: string[]) => void;
  onFeedback?: (feedback: Omit<Feedback, 'timestamp'>) => void;
  timeLimit?: number; // minutes
  initialLimit?: number;
  showCategories?: RecommendCategory[];
  minScore?: number;
}

export function RecommendationPanel({
  onSelect,
  onFeedback,
  timeLimit,
  initialLimit = 10,
  showCategories,
  minScore,
}: RecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<RecommendCategory | 'all'>('all');

  useEffect(() => {
    loadRecommendations();
  }, [timeLimit, showCategories, minScore]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const options: RecommendOptions = {
        limit: initialLimit,
        timeLimit,
        categories: showCategories,
        minScore,
      };

      const results = await recommendEngine.getRecommendations(options);
      setRecommendations(results);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    const filtered = filterByCategory(recommendations, selectedCategory);
    const newIds = new Set(filtered.map((r) => r.caseId));
    setSelectedIds(newIds);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (caseId: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(caseId)) {
      newIds.delete(caseId);
    } else {
      newIds.add(caseId);
    }
    setSelectedIds(newIds);
  };

  const handleExecuteSelected = () => {
    if (onSelect && selectedIds.size > 0) {
      onSelect(Array.from(selectedIds));
    }
  };

  const handleFeedback = async (recommendation: Recommendation, accepted: boolean) => {
    if (onFeedback) {
      await onFeedback({
        recommendationId: recommendation.id,
        caseId: recommendation.caseId,
        accepted,
      });
    }
    await feedbackTracker.recordFeedback({
      recommendationId: recommendation.id,
      caseId: recommendation.caseId,
      accepted,
      timestamp: Date.now(),
    });
  };

  const filterByCategory = (recs: Recommendation[], category: RecommendCategory | 'all') => {
    if (category === 'all') return recs;
    return recs.filter((r) => r.category === category);
  };

  const filteredRecommendations = useMemo(
    () => filterByCategory(recommendations, selectedCategory),
    [recommendations, selectedCategory],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<RecommendCategory | 'all', number> = {
      all: recommendations.length,
      must_run: 0,
      should_run: 0,
      could_run: 0,
      low_priority: 0,
    };
    for (const rec of recommendations) {
      counts[rec.category]++;
    }
    return counts;
  }, [recommendations]);

  const selectedFiltered = Array.from(selectedIds).filter((id) =>
    filteredRecommendations.some((r) => r.caseId === id),
  );

  const getTotalEstimatedTime = () => {
    return filteredRecommendations.reduce((sum, r) => sum + r.estimatedDuration, 0);
  };

  const getSelectedEstimatedTime = () => {
    return filteredRecommendations
      .filter((r) => selectedIds.has(r.caseId))
      .reduce((sum, r) => sum + r.estimatedDuration, 0);
  };

  const getCategoryColor = (category: RecommendCategory): string => {
    switch (category) {
      case 'must_run':
        return 'red';
      case 'should_run':
        return 'orange';
      case 'could_run':
        return 'blue';
      case 'low_priority':
        return 'default';
    }
  };

  const getPriorityIcon = (priority: Priority): ReactNode => {
    switch (priority) {
      case 'critical':
        return <FireOutlined style={{ color: '#ff4d4f' }} />;
      case 'high':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'medium':
        return <ThunderboltOutlined style={{ color: '#1890ff' }} />;
      case 'low':
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  return (
    <Card
      title="智能推荐测试用例"
      loading={loading}
      extra={
        <Space>
          <Button size="small" onClick={loadRecommendations}>
            刷新
          </Button>
          {selectedIds.size > 0 && (
            <Button type="primary" size="small" onClick={handleExecuteSelected}>
              执行选中 ({selectedFiltered.length})
            </Button>
          )}
        </Space>
      }
      className="recommendation-panel"
    >
      {/* Category tabs */}
      <div className="category-tabs">
        <Space wrap>
          <Badge count={categoryCounts.all} showZero>
            <Tag
              color={selectedCategory === 'all' ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedCategory('all')}
            >
              全部
            </Tag>
          </Badge>
          <Badge count={categoryCounts.must_run} showZero>
            <Tag
              color={selectedCategory === 'must_run' ? 'red' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedCategory('must_run')}
            >
              必须执行
            </Tag>
          </Badge>
          <Badge count={categoryCounts.should_run} showZero>
            <Tag
              color={selectedCategory === 'should_run' ? 'orange' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedCategory('should_run')}
            >
              建议执行
            </Tag>
          </Badge>
          <Badge count={categoryCounts.could_run} showZero>
            <Tag
              color={selectedCategory === 'could_run' ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedCategory('could_run')}
            >
              可选执行
            </Tag>
          </Badge>
        </Space>
      </div>

      {/* Selection actions */}
      {filteredRecommendations.length > 0 && (
        <div className="selection-actions" style={{ marginTop: 12, marginBottom: 12 }}>
          <Space>
            <Button size="small" onClick={handleSelectAll}>
              全选当前
            </Button>
            <Button size="small" onClick={handleClearSelection}>
              清空选择
            </Button>
            <span style={{ color: '#8c8c8c' }}>
              已选 {selectedFiltered.length} / {filteredRecommendations.length}
            </span>
            {selectedIds.size > 0 && (
              <span style={{ color: '#8c8c8c' }}>
                预计耗时: {formatDuration(getSelectedEstimatedTime())}
              </span>
            )}
          </Space>
        </div>
      )}

      {/* Recommendations list */}
      {filteredRecommendations.length === 0 ? (
        <Alert
          message="暂无推荐"
          description={
            loading
              ? '正在分析数据...'
              : '当前条件下没有推荐的测试用例。尝试调整筛选条件或等待更多测试执行数据。'
          }
          type="info"
          showIcon
        />
      ) : (
        <List
          dataSource={filteredRecommendations}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              className={`recommendation-item priority-${item.priority} ${
                selectedIds.has(item.caseId) ? 'selected' : ''
              }`}
              style={{
                padding: '12px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: selectedIds.has(item.caseId) ? '#e6f7ff' : undefined,
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.caseId)}
                    onChange={() => handleToggleSelect(item.caseId)}
                    style={{ marginTop: 4 }}
                  />

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {getPriorityIcon(item.priority)}
                      <strong>{item.caseName}</strong>
                      <Tag color={getCategoryColor(item.category)} style={{ margin: 0 }}>
                        {CATEGORY_LABELS[item.category]}
                      </Tag>
                      <Tag style={{ margin: 0 }}>
                        {PRIORITY_LABELS[item.priority]}
                      </Tag>
                      <span style={{ marginLeft: 'auto', color: '#8c8c8c', fontSize: 12 }}>
                        评分: {item.score}
                      </span>
                    </div>

                    {/* Score bar */}
                    <Progress
                      percent={item.score}
                      size="small"
                      strokeColor={item.score >= 80 ? '#52c41a' : item.score >= 60 ? '#faad14' : '#ff4d4f'}
                      showInfo={false}
                      style={{ marginBottom: 8 }}
                    />

                    {/* Reasons */}
                    <div style={{ marginBottom: 8 }}>
                      {item.reasons.map((reason, idx) => (
                        <Tag key={idx} color="blue" style={{ fontSize: 11, marginBottom: 2 }}>
                          {REASON_TYPE_LABELS[reason.type]}: {reason.description}
                        </Tag>
                      ))}
                    </div>

                    {/* Metadata */}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8c8c8c' }}>
                      <span>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        预计: {formatDuration(item.estimatedDuration)}
                      </span>
                      {item.lastExecuted && (
                        <span>
                          上次执行: {new Date(item.lastExecuted).toLocaleDateString()}
                        </span>
                      )}
                      {item.lastResult && (
                        <span>
                          {item.lastResult === 'passed' ? (
                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                          ) : (
                            <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                          )}
                          {item.lastResult === 'passed' ? '通过' : '失败'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Feedback buttons */}
                  <Space direction="vertical" size={4}>
                    <Tooltip title="这个推荐有用">
                      <Button
                        size="small"
                        type="text"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleFeedback(item, true)}
                      />
                    </Tooltip>
                    <Tooltip title="这个推荐没帮助">
                      <Button
                        size="small"
                        type="text"
                        icon={<CloseCircleOutlined />}
                        onClick={() => handleFeedback(item, false)}
                      />
                    </Tooltip>
                  </Space>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}

      {/* Summary footer */}
      {filteredRecommendations.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 4 }}>
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
            <span>
              总用例数: <strong>{filteredRecommendations.length}</strong>
            </span>
            <span>
              预计总耗时: <strong>{formatDuration(getTotalEstimatedTime())}</strong>
            </span>
            <span>
              平均评分: <strong>
                {Math.round(
                  filteredRecommendations.reduce((sum, r) => sum + r.score, 0) /
                    filteredRecommendations.length,
                )}
              </strong>
            </span>
          </Space>
        </div>
      )}
    </Card>
  );
}

export default RecommendationPanel;
