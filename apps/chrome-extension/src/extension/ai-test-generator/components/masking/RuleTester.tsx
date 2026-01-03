/**
 * Rule Tester Component
 * Test detection rules against sample text with live preview
 */

import {
  CheckCircleOutlined,
  CopyOutlined,
  ExperimentOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { detectorEngine, maskerEngine } from '../../services/masking';
import type {
  DetectionResult,
  DetectionRule,
  MaskingMatch,
  SensitiveCategory,
  TextMaskingResult,
} from '../../types/masking';

const { TextArea } = Input;
const { Text } = Typography;

/**
 * Category display configuration
 */
const CATEGORY_CONFIG: Record<SensitiveCategory, { color: string; label: string }> = {
  credential: { color: 'red', label: '凭证' },
  pii: { color: 'orange', label: '个人信息' },
  financial: { color: 'gold', label: '金融' },
  health: { color: 'green', label: '健康' },
  custom: { color: 'blue', label: '自定义' },
};

/**
 * Sample test data
 */
const SAMPLE_DATA = [
  {
    label: '混合敏感数据',
    value: `用户登录信息:
username=admin
password=Abc123!@#
API Key: sk-1234567890abcdef

联系方式:
手机: 13812345678
邮箱: test@example.com
身份证: 110101199001011234

银行信息:
卡号: 6222021234567890123
CVV: 123`,
  },
  {
    label: '日志格式',
    value: `[2024-01-15 10:30:45] INFO User logged in with token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
[2024-01-15 10:30:46] DEBUG Request headers: Authorization: Bearer abc123def456
[2024-01-15 10:30:47] ERROR Failed login for user admin@company.com from IP 192.168.1.100`,
  },
  {
    label: 'YAML 配置',
    value: `config:
  database:
    host: localhost
    username: root
    password: "mysql@123"
  api:
    key: "AKIAIOSFODNN7EXAMPLE"
    secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"`,
  },
];

interface RuleTesterProps {
  onClose?: () => void;
}

/**
 * RuleTester component
 */
export const RuleTester: React.FC<RuleTesterProps> = ({ onClose }) => {
  const [testInput, setTestInput] = useState('');
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [maskingResult, setMaskingResult] = useState<TextMaskingResult | null>(null);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const rules = detectorEngine.getRules();
  const enabledRules = rules.filter((r) => r.enabled);

  // Load sample data
  const handleLoadSample = useCallback((value: string) => {
    setTestInput(value);
    setDetectionResults([]);
    setMaskingResult(null);
  }, []);

  // Run detection
  const handleDetect = useCallback(async () => {
    if (!testInput.trim()) {
      message.warning('请输入测试文本');
      return;
    }

    setIsLoading(true);
    try {
      const results = await detectorEngine.detect(testInput, 'text');
      setDetectionResults(results);

      if (results.length > 0) {
        message.success(`检测到 ${results.length} 处敏感数据`);
      } else {
        message.info('未检测到敏感数据');
      }
    } catch (error) {
      console.error('Detection failed:', error);
      message.error('检测失败');
    } finally {
      setIsLoading(false);
    }
  }, [testInput]);

  // Run masking
  const handleMask = useCallback(async () => {
    if (!testInput.trim()) {
      message.warning('请输入测试文本');
      return;
    }

    setIsLoading(true);
    try {
      const result = await maskerEngine.maskText(testInput, 'text');
      setMaskingResult(result);

      if (result.matches.length > 0) {
        message.success(`脱敏 ${result.matches.length} 处敏感数据`);
      } else {
        message.info('未检测到需要脱敏的数据');
      }
    } catch (error) {
      console.error('Masking failed:', error);
      message.error('脱敏失败');
    } finally {
      setIsLoading(false);
    }
  }, [testInput]);

  // Copy masked result
  const handleCopyResult = useCallback(() => {
    if (maskingResult?.masked) {
      navigator.clipboard.writeText(maskingResult.masked);
      message.success('已复制到剪贴板');
    }
  }, [maskingResult]);

  // Clear all
  const handleClear = useCallback(() => {
    setTestInput('');
    setDetectionResults([]);
    setMaskingResult(null);
  }, []);

  // Detection results table columns
  const detectionColumns = [
    {
      title: '规则',
      dataIndex: 'ruleName',
      key: 'ruleName',
      width: 150,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: SensitiveCategory) => (
        <Tag color={CATEGORY_CONFIG[category]?.color || 'default'}>
          {CATEGORY_CONFIG[category]?.label || category}
        </Tag>
      ),
    },
    {
      title: '匹配值',
      dataIndex: 'value',
      key: 'value',
      render: (value: string) => (
        <Text code style={{ wordBreak: 'break-all' }}>
          {value.length > 50 ? `${value.substring(0, 50)}...` : value}
        </Text>
      ),
    },
    {
      title: '位置',
      key: 'position',
      width: 100,
      render: (_: unknown, record: DetectionResult) => (
        <Text type="secondary">
          {record.position.start}-{record.position.end}
        </Text>
      ),
    },
  ];

  // Masking results table columns
  const maskingColumns = [
    {
      title: '规则',
      dataIndex: 'ruleName',
      key: 'ruleName',
      width: 150,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: SensitiveCategory) => (
        <Tag color={CATEGORY_CONFIG[category]?.color || 'default'}>
          {CATEGORY_CONFIG[category]?.label || category}
        </Tag>
      ),
    },
    {
      title: '原始值',
      dataIndex: 'originalValue',
      key: 'originalValue',
      render: (value: string) => (
        <Text code delete style={{ wordBreak: 'break-all' }}>
          {value.length > 30 ? `${value.substring(0, 30)}...` : value}
        </Text>
      ),
    },
    {
      title: '脱敏值',
      dataIndex: 'maskedValue',
      key: 'maskedValue',
      render: (value: string) => (
        <Text code type="success" style={{ wordBreak: 'break-all' }}>
          {value.length > 30 ? `${value.substring(0, 30)}...` : value}
        </Text>
      ),
    },
  ];

  return (
    <div className="rule-tester" style={{ padding: 16 }}>
      <Card
        title={
          <Space>
            <ExperimentOutlined />
            <span>规则测试器</span>
          </Space>
        }
        size="small"
        extra={
          onClose && (
            <Button size="small" onClick={onClose}>
              关闭
            </Button>
          )
        }
      >
        {/* Input Section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>测试文本</span>
            <Space>
              <Select
                size="small"
                placeholder="加载示例"
                style={{ width: 150 }}
                onChange={handleLoadSample}
                options={SAMPLE_DATA.map((s) => ({ value: s.value, label: s.label }))}
              />
              <Button size="small" onClick={handleClear}>
                清空
              </Button>
            </Space>
          </div>
          <TextArea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="输入需要测试的文本..."
            rows={6}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        {/* Action Buttons */}
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={handleDetect} loading={isLoading}>
            检测敏感数据
          </Button>
          <Button onClick={handleMask} loading={isLoading}>
            执行脱敏
          </Button>
        </Space>

        {/* Statistics */}
        {(detectionResults.length > 0 || maskingResult) && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic
                title="启用规则"
                value={enabledRules.length}
                suffix={`/ ${rules.length}`}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="检测命中"
                value={detectionResults.length}
                prefix={detectionResults.length > 0 ? <WarningOutlined style={{ color: '#faad14' }} /> : null}
                valueStyle={{ fontSize: 20, color: detectionResults.length > 0 ? '#faad14' : undefined }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="脱敏处理"
                value={maskingResult?.matches.length || 0}
                prefix={maskingResult?.matches.length ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null}
                valueStyle={{ fontSize: 20, color: maskingResult?.matches.length ? '#52c41a' : undefined }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="处理耗时"
                value={maskingResult?.processingTime || 0}
                suffix="ms"
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
          </Row>
        )}

        {/* Detection Results */}
        {detectionResults.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>
              检测结果
            </Divider>
            <Table
              size="small"
              dataSource={detectionResults.map((r, i) => ({ ...r, key: i }))}
              columns={detectionColumns}
              pagination={false}
              scroll={{ y: 200 }}
            />
          </>
        )}

        {/* Masking Results */}
        {maskingResult && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>
              脱敏结果
            </Divider>

            {maskingResult.matches.length > 0 ? (
              <>
                <Table
                  size="small"
                  dataSource={maskingResult.matches.map((m, i) => ({ ...m, key: i }))}
                  columns={maskingColumns}
                  pagination={false}
                  scroll={{ y: 200 }}
                  style={{ marginBottom: 16 }}
                />

                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>脱敏后文本</span>
                  <Button size="small" icon={<CopyOutlined />} onClick={handleCopyResult}>
                    复制
                  </Button>
                </div>
                <TextArea
                  value={maskingResult.masked}
                  readOnly
                  rows={6}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    background: '#f6ffed',
                    borderColor: '#b7eb8f',
                  }}
                />
              </>
            ) : (
              <Alert
                type="info"
                message="未检测到敏感数据"
                description="当前输入文本中没有匹配任何启用的检测规则"
                showIcon
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default RuleTester;
