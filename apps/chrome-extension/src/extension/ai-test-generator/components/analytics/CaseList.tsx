/**
 * Case List Component
 * Displays test case statistics with filtering and sorting
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Card,
  Empty,
  Input,
  Progress,
  Radio,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import type { CaseStats } from '../../types/analytics';

interface CaseListProps {
  data: CaseStats[];
  loading?: boolean;
  onCaseClick?: (caseId: string) => void;
}

type FilterType = 'all' | 'stable' | 'flaky' | 'unstable';

export function CaseList({
  data,
  loading = false,
  onCaseClick,
}: CaseListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    let result = data;

    // Apply filter
    switch (filter) {
      case 'stable':
        result = result.filter((c) => c.stabilityScore >= 80 && !c.isFlaky);
        break;
      case 'flaky':
        result = result.filter((c) => c.isFlaky);
        break;
      case 'unstable':
        result = result.filter((c) => c.stabilityScore < 50 && !c.isFlaky);
        break;
    }

    // Apply search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter((c) =>
        c.caseName.toLowerCase().includes(searchLower),
      );
    }

    return result;
  }, [data, filter, search]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} 分钟前`;
    }
    if (diffHours < 24) {
      return `${diffHours} 小时前`;
    }
    if (diffDays < 7) {
      return `${diffDays} 天前`;
    }
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStabilityTag = (stats: CaseStats) => {
    if (stats.isFlaky) {
      return (
        <Tag icon={<ExclamationCircleOutlined />} color="warning">
          Flaky
        </Tag>
      );
    }
    if (stats.stabilityScore >= 80) {
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          稳定
        </Tag>
      );
    }
    if (stats.stabilityScore >= 50) {
      return (
        <Tag icon={<QuestionCircleOutlined />} color="default">
          一般
        </Tag>
      );
    }
    return (
      <Tag icon={<CloseCircleOutlined />} color="error">
        不稳定
      </Tag>
    );
  };

  const columns: ColumnsType<CaseStats> = [
    {
      title: '用例名称',
      dataIndex: 'caseName',
      key: 'caseName',
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={name}>
          <a
            onClick={() => onCaseClick?.(record.caseId)}
            style={{ cursor: onCaseClick ? 'pointer' : 'default' }}
          >
            {name}
          </a>
        </Tooltip>
      ),
    },
    {
      title: '通过率',
      dataIndex: 'passRate',
      key: 'passRate',
      width: 120,
      sorter: (a, b) => a.passRate - b.passRate,
      render: (rate: number) => (
        <Progress
          percent={rate}
          size="small"
          format={(p) => `${p?.toFixed(0)}%`}
          status={rate >= 80 ? 'success' : rate >= 50 ? 'normal' : 'exception'}
        />
      ),
    },
    {
      title: '耗时',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 80,
      sorter: (a, b) => a.avgDuration - b.avgDuration,
      render: (duration: number) => formatDuration(duration),
    },
    {
      title: '稳定性',
      key: 'stability',
      width: 90,
      sorter: (a, b) => a.stabilityScore - b.stabilityScore,
      render: (_, record) => getStabilityTag(record),
    },
    {
      title: '最后执行',
      dataIndex: 'lastRun',
      key: 'lastRun',
      width: 100,
      sorter: (a, b) => a.lastRun - b.lastRun,
      defaultSortOrder: 'descend',
      render: (timestamp: number) => (
        <Tooltip title={new Date(timestamp).toLocaleString('zh-CN')}>
          {formatTime(timestamp)}
        </Tooltip>
      ),
    },
    {
      title: '最近结果',
      key: 'recentResults',
      width: 100,
      render: (_, record) => (
        <div className="recent-results">
          {record.recentResults.slice(0, 5).map((result, i) => (
            <span
              key={i}
              className={`result-dot ${result}`}
              title={result === 'passed' ? '通过' : '失败'}
            />
          ))}
        </div>
      ),
    },
  ];

  const filterCounts = useMemo(() => {
    return {
      all: data.length,
      stable: data.filter((c) => c.stabilityScore >= 80 && !c.isFlaky).length,
      flaky: data.filter((c) => c.isFlaky).length,
      unstable: data.filter((c) => c.stabilityScore < 50 && !c.isFlaky).length,
    };
  }, [data]);

  return (
    <Card className="case-list-card" size="small">
      <div className="case-list-header">
        <Space>
          <Input
            placeholder="搜索用例..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
        <Radio.Group
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          size="small"
        >
          <Radio.Button value="all">全部 ({filterCounts.all})</Radio.Button>
          <Radio.Button value="stable">
            稳定 ({filterCounts.stable})
          </Radio.Button>
          <Radio.Button value="flaky">
            Flaky ({filterCounts.flaky})
          </Radio.Button>
          <Radio.Button value="unstable">
            不稳定 ({filterCounts.unstable})
          </Radio.Button>
        </Radio.Group>
      </div>

      <Table
        className="case-list-table"
        columns={columns}
        dataSource={filteredData}
        rowKey="caseId"
        size="small"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
        locale={{
          emptyText: <Empty description="暂无数据" />,
        }}
      />
    </Card>
  );
}

/**
 * Compact Case Summary for dashboard
 */
interface CaseSummaryProps {
  totalCases: number;
  stableCases: number;
  flakyCases: number;
  unstableCases: number;
}

export function CaseSummary({
  totalCases,
  stableCases,
  flakyCases,
  unstableCases,
}: CaseSummaryProps) {
  const segments = [
    { label: '稳定', count: stableCases, color: '#52c41a' },
    { label: 'Flaky', count: flakyCases, color: '#faad14' },
    { label: '不稳定', count: unstableCases, color: '#ff4d4f' },
  ].filter((s) => s.count > 0);

  const otherCount = totalCases - stableCases - flakyCases - unstableCases;
  if (otherCount > 0) {
    segments.push({ label: '其他', count: otherCount, color: '#d9d9d9' });
  }

  return (
    <Card className="case-summary-card" title="用例概览" size="small">
      <div className="case-summary">
        <div className="summary-total">
          <span className="total-number">{totalCases}</span>
          <span className="total-label">测试用例</span>
        </div>
        <div className="summary-bar">
          {segments.map((seg) => (
            <Tooltip key={seg.label} title={`${seg.label}: ${seg.count}`}>
              <div
                className="bar-segment"
                style={{
                  width: `${(seg.count / totalCases) * 100}%`,
                  background: seg.color,
                }}
              />
            </Tooltip>
          ))}
        </div>
        <div className="summary-legend">
          {segments.map((seg) => (
            <div key={seg.label} className="legend-item">
              <span
                className="legend-color"
                style={{ background: seg.color }}
              />
              <span className="legend-label">{seg.label}</span>
              <span className="legend-count">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
