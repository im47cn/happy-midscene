/**
 * Adaptive Path Analyzer Component
 * 自适应路径分析器组件 - 分析执行历史和路径覆盖
 */

import {
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  HeatMapOutlined,
  InfoCircleOutlined,
  RightCircleOutlined,
} from '@ant-design/icons';
import {
  Card,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo } from 'react';

const { Text, Title } = Typography;

// Path entry interface
export interface PathEntry {
  stepId: string;
  branch?: 'then' | 'else' | 'loop';
  timestamp: number;
  condition?: string;
  iteration?: number;
  depth?: number;
}

// Path statistics interface
export interface PathStatistics {
  totalPaths: number;
  executedPaths: number;
  branchCoverage: number;
  loopIterations: number;
  maxDepth: number;
  uniquePaths: string[];
  criticalPath?: string[];
}

// Execution result interface
export interface ExecutionResult {
  stepId: string;
  success: boolean;
  branch?: 'then' | 'else' | 'loop';
  iterations?: number;
  duration?: number;
}

interface AdaptivePathAnalyzerProps {
  /** Path entries from execution */
  pathEntries: PathEntry[];
  /** Execution results for statistics */
  executionResults?: ExecutionResult[];
  /** Show detailed timeline */
  showTimeline?: boolean;
  /** Show coverage statistics */
  showCoverage?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Calculate path statistics
 */
export function calculatePathStatistics(
  pathEntries: PathEntry[],
  executionResults?: ExecutionResult[],
): PathStatistics {
  // Count branches
  const branchCounts = pathEntries.reduce(
    (acc, entry) => {
      if (entry.branch) {
        const key = `${entry.stepId}:${entry.branch}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Calculate unique paths
  const pathStrings = pathEntries.map((e) =>
    e.branch ? `${e.stepId}:${e.branch}` : e.stepId,
  );
  const uniquePaths = Array.from(new Set(pathStrings));

  // Count iterations
  const totalIterations = pathEntries.reduce(
    (sum, entry) => sum + (entry.iteration || 0),
    0,
  );

  // Calculate max depth
  const maxDepth = Math.max(...pathEntries.map((e) => e.depth || 0), 0);

  // Calculate branch coverage (if execution results provided)
  let branchCoverage = 0;
  if (executionResults) {
    const stepsWithBranches = executionResults.filter(
      (r) => r.branch === 'then' || r.branch === 'else',
    ).length;
    const totalBranches = executionResults.length;
    branchCoverage =
      totalBranches > 0 ? (stepsWithBranches / totalBranches) * 100 : 0;
  }

  // Find critical path (longest executed path)
  const criticalPath: string[] = [];
  let currentPath: string[] = [];
  for (const entry of pathEntries) {
    currentPath.push(
      entry.branch ? `${entry.stepId}:${entry.branch}` : entry.stepId,
    );
    if (entry.branch === 'loop' || entry.branch === 'else') {
      // Path might end here
      if (currentPath.length > criticalPath.length) {
        criticalPath.splice(0, criticalPath.length, ...currentPath);
      }
      currentPath = [];
    }
  }
  if (currentPath.length > criticalPath.length) {
    criticalPath.splice(0, criticalPath.length, ...currentPath);
  }

  return {
    totalPaths: pathEntries.length,
    executedPaths: uniquePaths.length,
    branchCoverage: Math.round(branchCoverage),
    loopIterations: totalIterations,
    maxDepth,
    uniquePaths,
    criticalPath: criticalPath.length > 0 ? criticalPath : undefined,
  };
}

/**
 * Path timeline component
 */
function PathTimeline({ entries }: { entries: PathEntry[] }) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return (
      date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + `.${String(date.getMilliseconds()).padStart(3, '0')}`
    );
  };

  const getBranchIcon = (branch?: string) => {
    switch (branch) {
      case 'then':
        return <RightCircleOutlined style={{ color: '#22c55e' }} />;
      case 'else':
        return <RightCircleOutlined style={{ color: '#f59e0b' }} />;
      case 'loop':
        return <BranchesOutlined style={{ color: '#3b82f6' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#6b7280' }} />;
    }
  };

  const getBranchColor = (branch?: string) => {
    switch (branch) {
      case 'then':
        return 'green';
      case 'else':
        return 'orange';
      case 'loop':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Timeline
      items={entries.map((entry) => ({
        color: getBranchColor(entry.branch),
        dot: getBranchIcon(entry.branch),
        children: (
          <div>
            <Space size={4}>
              <Text code style={{ fontSize: 11 }}>
                {entry.stepId}
              </Text>
              {entry.branch && (
                <Tag
                  color={getBranchColor(entry.branch)}
                  style={{ fontSize: 10, margin: 0 }}
                >
                  {entry.branch}
                </Tag>
              )}
              {entry.iteration && (
                <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                  iter: {entry.iteration}
                </Tag>
              )}
              {entry.depth !== undefined && entry.depth > 0 && (
                <Tag style={{ fontSize: 10, margin: 0 }}>
                  depth: {entry.depth}
                </Tag>
              )}
            </Space>
            {entry.condition && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Condition: <Text code>{entry.condition}</Text>
                </Text>
              </div>
            )}
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatTime(entry.timestamp)}
              </Text>
            </div>
          </div>
        ),
      }))}
    />
  );
}

/**
 * Coverage statistics table
 */
function CoverageTable({
  stats,
  entries,
}: {
  stats: PathStatistics;
  entries: PathEntry[];
}) {
  // Build branch data
  const branchData = useMemo(() => {
    const branchMap = new Map<
      string,
      { then: number; else: number; total: number }
    >();

    for (const entry of entries) {
      if (!entry.branch) continue;

      if (!branchMap.has(entry.stepId)) {
        branchMap.set(entry.stepId, { then: 0, else: 0, total: 0 });
      }

      const data = branchMap.get(entry.stepId)!;
      if (entry.branch === 'then') data.then++;
      if (entry.branch === 'else') data.else++;
      data.total++;
    }

    return Array.from(branchMap.entries()).map(([stepId, data]) => ({
      stepId,
      then: data.then,
      else: data.else,
      total: data.total,
      coverage:
        data.then > 0 && data.else > 0
          ? 100
          : Math.round(((data.then + data.else) / 2) * 100),
    }));
  }, [entries]);

  const columns: ColumnsType<(typeof branchData)[0]> = [
    {
      title: 'Step ID',
      dataIndex: 'stepId',
      key: 'stepId',
      width: 150,
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: 'Then',
      dataIndex: 'then',
      key: 'then',
      width: 80,
      align: 'center',
      render: (count) => (
        <Tag color={count > 0 ? 'green' : 'default'}>{count}</Tag>
      ),
    },
    {
      title: 'Else',
      dataIndex: 'else',
      key: 'else',
      width: 80,
      align: 'center',
      render: (count) => (
        <Tag color={count > 0 ? 'orange' : 'default'}>{count}</Tag>
      ),
    },
    {
      title: 'Coverage',
      dataIndex: 'coverage',
      key: 'coverage',
      width: 150,
      render: (coverage) => (
        <Progress
          percent={coverage}
          size="small"
          status={coverage === 100 ? 'success' : 'normal'}
          showInfo={false}
        />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={branchData}
      size="small"
      pagination={false}
      rowKey="stepId"
    />
  );
}

/**
 * Main path analyzer component
 */
export function AdaptivePathAnalyzer({
  pathEntries,
  executionResults,
  showTimeline = true,
  showCoverage = true,
  className = '',
}: AdaptivePathAnalyzerProps) {
  const stats = useMemo(
    () => calculatePathStatistics(pathEntries, executionResults),
    [pathEntries, executionResults],
  );

  // Get critical path visualization
  const criticalPathVisualization = useMemo(() => {
    if (!stats.criticalPath || stats.criticalPath.length === 0) return null;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {stats.criticalPath.map((path, idx) => (
          <React.Fragment key={`${path}-${idx}`}>
            <Tag color="blue" style={{ margin: 0 }}>
              {path}
            </Tag>
            {idx < stats.criticalPath!.length - 1 && (
              <RightCircleOutlined style={{ color: '#d1d5db', fontSize: 12 }} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }, [stats.criticalPath]);

  // Calculate execution duration
  const executionDuration = useMemo(() => {
    if (pathEntries.length < 2) return 0;
    const start = pathEntries[0].timestamp;
    const end = pathEntries[pathEntries.length - 1].timestamp;
    return Math.round(end - start);
  }, [pathEntries]);

  return (
    <div className={`adaptive-path-analyzer ${className}`}>
      {/* Statistics Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="Total Paths"
              value={stats.totalPaths}
              prefix={<BranchesOutlined />}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="Unique Paths"
              value={stats.executedPaths}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="Branch Coverage"
              value={stats.branchCoverage}
              suffix="%"
              prefix={<HeatMapOutlined />}
              valueStyle={{
                fontSize: 20,
                color:
                  stats.branchCoverage >= 80
                    ? '#22c55e'
                    : stats.branchCoverage >= 50
                      ? '#f59e0b'
                      : '#ef4444',
              }}
              precision={0}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="Loop Iterations"
              value={stats.loopIterations}
              prefix={<BranchesOutlined />}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Additional statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="Max Depth"
              value={stats.maxDepth}
              suffix="levels"
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="Duration"
              value={executionDuration}
              suffix="ms"
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="Success Rate"
              value={
                executionResults && executionResults.length > 0
                  ? Math.round(
                      (executionResults.filter((r) => r.success).length /
                        executionResults.length) *
                        100,
                    )
                  : 0
              }
              suffix="%"
              prefix={
                executionResults &&
                executionResults.filter((r) => r.success).length ===
                  executionResults.length ? (
                  <CheckCircleOutlined />
                ) : (
                  <InfoCircleOutlined />
                )
              }
              valueStyle={{
                fontSize: 18,
                color:
                  executionResults &&
                  executionResults.filter((r) => r.success).length ===
                    executionResults.length
                    ? '#22c55e'
                    : '#f59e0b',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Critical Path */}
      {stats.criticalPath && stats.criticalPath.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <HeatMapOutlined />
              <Text>Critical Path</Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {criticalPathVisualization}
        </Card>
      )}

      {/* Coverage Table */}
      {showCoverage && executionResults && executionResults.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <BranchesOutlined />
              <Text>Branch Coverage</Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <CoverageTable stats={stats} entries={pathEntries} />
        </Card>
      )}

      {/* Execution Timeline */}
      {showTimeline && pathEntries.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <ClockCircleOutlined />
              <Text>Execution Timeline</Text>
            </Space>
          }
          style={{ maxHeight: 400, overflowY: 'auto' }}
        >
          <PathTimeline entries={pathEntries} />
        </Card>
      )}
    </div>
  );
}

/**
 * Mini path analyzer widget
 */
export function MiniPathAnalyzer({
  stats,
  className = '',
}: {
  stats: PathStatistics;
  className?: string;
}) {
  return (
    <div className={`mini-path-analyzer ${className}`}>
      <Space size="large" wrap>
        <Tooltip title="Total execution paths">
          <Space size={4}>
            <BranchesOutlined style={{ color: '#6b7280' }} />
            <Text>{stats.totalPaths} paths</Text>
          </Space>
        </Tooltip>
        <Tooltip title="Branch coverage percentage">
          <Space size={4}>
            <HeatMapOutlined style={{ color: '#3b82f6' }} />
            <Text>{stats.branchCoverage}% coverage</Text>
          </Space>
        </Tooltip>
        {stats.loopIterations > 0 && (
          <Tooltip title="Total loop iterations">
            <Space size={4}>
              <BranchesOutlined style={{ color: '#10b981' }} />
              <Text>{stats.loopIterations} iterations</Text>
            </Space>
          </Tooltip>
        )}
        {stats.maxDepth > 0 && (
          <Tooltip title="Maximum nesting depth">
            <Space size={4}>
              <InfoCircleOutlined style={{ color: '#f59e0b' }} />
              <Text>depth: {stats.maxDepth}</Text>
            </Space>
          </Tooltip>
        )}
      </Space>
    </div>
  );
}

export default AdaptivePathAnalyzer;
