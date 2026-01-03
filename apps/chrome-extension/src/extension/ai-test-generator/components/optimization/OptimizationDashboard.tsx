/**
 * Optimization Dashboard Component
 * Main dashboard for test optimization insights
 */

import {
  DownloadOutlined,
  ReloadOutlined,
  RocketOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import type {
  OptimizationReport,
  Priority,
  Recommendation,
  RecommendationType,
} from '../../types/optimization';
import {
  PRIORITY_LABELS,
  RECOMMENDATION_TYPE_LABELS,
} from '../../types/optimization';
import { optimizationReport } from '../../services/optimization';
import { RecommendationCard } from './RecommendationCard';
import { AnalysisOverview } from './AnalysisOverview';

const priorityColors: Record<Priority, string> = {
  critical: '#ff4d4f',
  high: '#fa8c16',
  medium: '#faad14',
  low: '#52c41a',
};

export function OptimizationDashboard() {
  const [report, setReport] = useState<OptimizationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const newReport = await optimizationReport.generate([]);
      setReport(newReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportHTML = useCallback(() => {
    if (!report) return;
    const html = optimizationReport.exportHTML(report);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimization-report-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  const handleExportMarkdown = useCallback(() => {
    if (!report) return;
    const md = optimizationReport.exportMarkdown(report);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimization-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  if (loading && !report) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>正在分析测试数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="分析失败"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={loadReport}>
            重试
          </Button>
        }
      />
    );
  }

  if (!report) {
    return <Empty description="没有可用的分析数据" />;
  }

  const criticalCount = report.summary.byPriority.critical || 0;
  const highCount = report.summary.byPriority.high || 0;

  return (
    <div className="optimization-dashboard">
      <div className="dashboard-header" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <RocketOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <span style={{ fontSize: 18, fontWeight: 600 }}>测试优化建议</span>
              {(criticalCount > 0 || highCount > 0) && (
                <Tag color="red" icon={<WarningOutlined />}>
                  {criticalCount + highCount} 个高优先问题
                </Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportHTML}
              >
                导出 HTML
              </Button>
              <Button onClick={handleExportMarkdown}>导出 Markdown</Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={loadReport}
                loading={loading}
              >
                刷新分析
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="优化建议"
              value={report.summary.totalRecommendations}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="预计节省时间"
              value={Math.round(report.summary.estimatedTotalSavings.time / 1000)}
              suffix="秒"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Tooltip title="稳定性评分">
              <Progress
                type="circle"
                percent={report.stabilityAnalysis.overallScore}
                width={60}
                status={
                  report.stabilityAnalysis.overallScore >= 80
                    ? 'success'
                    : report.stabilityAnalysis.overallScore >= 60
                      ? 'normal'
                      : 'exception'
                }
              />
            </Tooltip>
            <div style={{ marginTop: 8, color: '#666' }}>稳定性</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Tooltip title="维护性评分">
              <Progress
                type="circle"
                percent={report.maintainabilityAnalysis.overallScore}
                width={60}
                status={
                  report.maintainabilityAnalysis.overallScore >= 80
                    ? 'success'
                    : report.maintainabilityAnalysis.overallScore >= 60
                      ? 'normal'
                      : 'exception'
                }
              />
            </Tooltip>
            <div style={{ marginTop: 8, color: '#666' }}>维护性</div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '概览',
              children: <AnalysisOverview report={report} />,
            },
            {
              key: 'recommendations',
              label: `建议 (${report.recommendations.length})`,
              children: (
                <RecommendationList recommendations={report.recommendations} />
              ),
            },
            {
              key: 'efficiency',
              label: '效率分析',
              children: (
                <EfficiencyDetails analysis={report.efficiencyAnalysis} />
              ),
            },
            {
              key: 'stability',
              label: '稳定性分析',
              children: (
                <StabilityDetails analysis={report.stabilityAnalysis} />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

function RecommendationList({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const [filter, setFilter] = useState<Priority | 'all'>('all');

  const filtered =
    filter === 'all'
      ? recommendations
      : recommendations.filter((r) => r.priority === filter);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <span>筛选：</span>
        <Button
          size="small"
          type={filter === 'all' ? 'primary' : 'default'}
          onClick={() => setFilter('all')}
        >
          全部
        </Button>
        {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => (
          <Button
            key={p}
            size="small"
            type={filter === p ? 'primary' : 'default'}
            onClick={() => setFilter(p)}
            style={{ borderColor: priorityColors[p] }}
          >
            {PRIORITY_LABELS[p]}
          </Button>
        ))}
      </Space>

      {filtered.length === 0 ? (
        <Empty description="没有符合条件的建议" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {filtered.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </Space>
      )}
    </div>
  );
}

function EfficiencyDetails({
  analysis,
}: {
  analysis: OptimizationReport['efficiencyAnalysis'];
}) {
  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="执行时间统计" size="small">
            <Statistic
              title="总执行时间"
              value={Math.round(analysis.totalDuration / 1000)}
              suffix="秒"
            />
            <Statistic
              title="平均执行时间"
              value={Math.round(analysis.averageDuration / 1000)}
              suffix="秒"
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="并行化机会" size="small">
            <Statistic
              title="当前并行度"
              value={analysis.parallelizationOpportunity.currentParallel}
            />
            <Statistic
              title="建议并行度"
              value={analysis.parallelizationOpportunity.recommendedParallel}
              style={{ marginTop: 16 }}
            />
            <Statistic
              title="预计节省"
              value={analysis.parallelizationOpportunity.estimatedSaving}
              suffix="%"
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
      </Row>

      {analysis.slowestCases.length > 0 && (
        <Card title="慢速用例" size="small" style={{ marginTop: 16 }}>
          {analysis.slowestCases.map((c) => (
            <div
              key={c.caseId}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ fontWeight: 500 }}>{c.caseName}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                平均 {Math.round(c.averageDuration / 1000)} 秒 | 比 {c.percentile}% 的测试慢
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function StabilityDetails({
  analysis,
}: {
  analysis: OptimizationReport['stabilityAnalysis'];
}) {
  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="整体稳定性"
              value={analysis.overallScore}
              suffix="/ 100"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="不稳定测试"
              value={analysis.flakyTests.length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="失败模式"
              value={analysis.failurePatterns.length}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {analysis.flakyTests.length > 0 && (
        <Card title="不稳定测试列表" size="small" style={{ marginTop: 16 }}>
          {analysis.flakyTests.map((test) => (
            <div
              key={test.caseId}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ fontWeight: 500 }}>{test.caseName}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                Flaky 率: {Math.round(test.flakyRate * 100)}% | 执行 {test.totalRuns} 次
              </div>
              <div style={{ marginTop: 4 }}>
                {test.recommendations.slice(0, 2).map((rec, idx) => (
                  <Tag key={idx} color="blue" style={{ fontSize: 11 }}>
                    {rec}
                  </Tag>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
