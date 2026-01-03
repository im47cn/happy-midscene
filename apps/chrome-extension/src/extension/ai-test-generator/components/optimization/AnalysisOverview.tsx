/**
 * Analysis Overview Component
 * Displays overview of all optimization analyses
 */

import {
  AimOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  SafetyOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Card, Col, Empty, List, Progress, Row, Space, Tag, Tooltip } from 'antd';

import type { OptimizationReport, Priority } from '../../types/optimization';
import { PRIORITY_LABELS, RECOMMENDATION_TYPE_LABELS } from '../../types/optimization';

const priorityColors: Record<Priority, string> = {
  critical: '#ff4d4f',
  high: '#fa8c16',
  medium: '#faad14',
  low: '#52c41a',
};

interface AnalysisOverviewProps {
  report: OptimizationReport;
}

export function AnalysisOverview({ report }: AnalysisOverviewProps) {
  return (
    <div className="analysis-overview">
      <Row gutter={[16, 16]}>
        {/* Priority Distribution */}
        <Col span={12}>
          <Card title="优先级分布" size="small">
            <Row gutter={[8, 8]}>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => {
                const count = report.summary.byPriority[p] || 0;
                const total = report.summary.totalRecommendations || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <Col span={12} key={p}>
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: priorityColors[p],
                            display: 'inline-block',
                          }}
                        />
                        <span>{PRIORITY_LABELS[p]}</span>
                        <Tag>{count}</Tag>
                      </Space>
                      <Progress
                        percent={percent}
                        size="small"
                        showInfo={false}
                        strokeColor={priorityColors[p]}
                      />
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>

        {/* Type Distribution */}
        <Col span={12}>
          <Card title="类型分布" size="small">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(report.summary.byType).map(([type, count]) => {
                if (count === 0) return null;
                return (
                  <Tag key={type} color="blue">
                    {RECOMMENDATION_TYPE_LABELS[type as keyof typeof RECOMMENDATION_TYPE_LABELS]} ({count})
                  </Tag>
                );
              })}
            </div>
          </Card>
        </Col>

        {/* Efficiency Summary */}
        <Col span={8}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                效率分析
              </Space>
            }
            size="small"
          >
            <List
              size="small"
              dataSource={[
                {
                  label: '总执行时间',
                  value: `${Math.round(report.efficiencyAnalysis.totalDuration / 1000)}秒`,
                },
                {
                  label: '慢速用例',
                  value: `${report.efficiencyAnalysis.slowestCases.length}个`,
                },
                {
                  label: '瓶颈数量',
                  value: `${report.efficiencyAnalysis.bottlenecks.length}个`,
                },
                {
                  label: '建议并行度',
                  value: `${report.efficiencyAnalysis.parallelizationOpportunity.recommendedParallel}`,
                },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.label}</span>
                  <span style={{ fontWeight: 500 }}>{item.value}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Redundancy Summary */}
        <Col span={8}>
          <Card
            title={
              <Space>
                <ExperimentOutlined />
                冗余分析
              </Space>
            }
            size="small"
          >
            <List
              size="small"
              dataSource={[
                {
                  label: '冗余组',
                  value: `${report.redundancyReport.redundantGroups.length}组`,
                },
                {
                  label: '重复步骤',
                  value: `${report.redundancyReport.duplicateSteps.length}个`,
                },
                {
                  label: '重叠度',
                  value: `${report.redundancyReport.overlapScore}%`,
                },
                {
                  label: '潜在节省',
                  value: `${Math.round(report.redundancyReport.potentialSavings / 1000)}秒`,
                },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.label}</span>
                  <span style={{ fontWeight: 500 }}>{item.value}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Coverage Gaps */}
        <Col span={8}>
          <Card
            title={
              <Space>
                <AimOutlined />
                覆盖率缺口
              </Space>
            }
            size="small"
          >
            {report.coverageGaps.length === 0 ? (
              <Empty description="没有覆盖率缺口" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={report.coverageGaps.slice(0, 4)}
                renderItem={(gap) => (
                  <List.Item>
                    <Tooltip title={`当前 ${gap.currentCoverage}%, 建议 ${gap.recommendedCoverage}%`}>
                      <Space>
                        <Tag color={priorityColors[gap.riskLevel]}>{gap.riskLevel}</Tag>
                        <span>{gap.feature}</span>
                      </Space>
                    </Tooltip>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Stability Issues */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <SafetyOutlined />
                稳定性问题
              </Space>
            }
            size="small"
          >
            {report.stabilityAnalysis.flakyTests.length === 0 ? (
              <Empty description="没有不稳定测试" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={report.stabilityAnalysis.flakyTests.slice(0, 4)}
                renderItem={(test) => (
                  <List.Item
                    extra={
                      <Tag color={test.flakyRate > 0.3 ? 'red' : 'orange'}>
                        {Math.round(test.flakyRate * 100)}%
                      </Tag>
                    }
                  >
                    <List.Item.Meta
                      title={test.caseName}
                      description={
                        test.rootCauses[0]?.description || '原因待分析'
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Maintainability Issues */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <ToolOutlined />
                维护性问题
              </Space>
            }
            size="small"
          >
            {report.maintainabilityAnalysis.issues.length === 0 ? (
              <Empty description="没有维护性问题" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={report.maintainabilityAnalysis.issues.slice(0, 4)}
                renderItem={(issue) => (
                  <List.Item
                    extra={
                      <Tag color={priorityColors[issue.severity]}>
                        {PRIORITY_LABELS[issue.severity]}
                      </Tag>
                    }
                  >
                    <List.Item.Meta
                      title={issue.caseName}
                      description={issue.description}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Top Issues */}
        {report.summary.topIssues.length > 0 && (
          <Col span={24}>
            <Card title="主要问题" size="small">
              <Space wrap>
                {report.summary.topIssues.map((issue, idx) => (
                  <Tag key={idx} color="volcano" style={{ fontSize: 13 }}>
                    {idx + 1}. {issue}
                  </Tag>
                ))}
              </Space>
            </Card>
          </Col>
        )}

        {/* Resource Optimizations */}
        {report.resourceOptimizations.length > 0 && (
          <Col span={24}>
            <Card title="资源优化建议" size="small">
              <List
                size="small"
                grid={{ gutter: 16, column: 3 }}
                dataSource={report.resourceOptimizations}
                renderItem={(opt) => (
                  <List.Item>
                    <Card size="small">
                      <div style={{ fontWeight: 500 }}>{opt.type}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        {opt.suggestion}
                      </div>
                      <Tag color="green" style={{ marginTop: 8 }}>
                        节省 {opt.estimatedSaving.value} {opt.estimatedSaving.unit}
                      </Tag>
                    </Card>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
