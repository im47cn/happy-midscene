/**
 * Masking Settings Component
 * Simple UI for configuring data masking rules
 */

import {
  EditOutlined,
  ExperimentOutlined,
  EyeInvisibleOutlined,
  OrderedListOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Input,
  List,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { detectorEngine, maskerEngine } from '../../services/masking';
import type {
  DetectionRule,
  MaskingConfig,
  ScreenshotMaskingLevel,
} from '../../types/masking';
import { DEFAULT_MASKING_CONFIG } from '../../types/masking';
import { RuleEditor } from './RuleEditor';
import { RuleTester } from './RuleTester';
import { WhitelistManagerUI } from './WhitelistManager';

/**
 * Category display configuration
 */
const CATEGORY_CONFIG: Record<string, { color: string; label: string }> = {
  credential: { color: 'red', label: '凭证' },
  pii: { color: 'orange', label: '个人信息' },
  financial: { color: 'gold', label: '金融' },
  health: { color: 'green', label: '健康' },
  custom: { color: 'blue', label: '自定义' },
};

/**
 * Screenshot masking level options
 */
const SCREENSHOT_LEVEL_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'standard', label: '标准' },
  { value: 'strict', label: '严格' },
];

interface MaskingSettingsProps {
  onConfigChange?: (config: MaskingConfig) => void;
}

/**
 * MaskingSettings component
 */
export const MaskingSettings: React.FC<MaskingSettingsProps> = ({
  onConfigChange,
}) => {
  const [config, setConfig] = useState<MaskingConfig>(DEFAULT_MASKING_CONFIG);
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [searchText, setSearchText] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<DetectionRule | null>(null);
  const [showRuleTester, setShowRuleTester] = useState(false);
  const [showWhitelist, setShowWhitelist] = useState(false);

  // Load rules on mount
  useEffect(() => {
    setRules(detectorEngine.getRules());
    setConfig(maskerEngine.getConfig());
  }, []);

  // Update config and notify parent
  const updateConfig = useCallback(
    (updates: Partial<MaskingConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      maskerEngine.setConfig(updates);
      onConfigChange?.(newConfig);
    },
    [config, onConfigChange],
  );

  // Toggle rule enabled state
  const toggleRule = useCallback((ruleId: string, enabled: boolean) => {
    if (enabled) {
      detectorEngine.enableRule(ruleId);
    } else {
      detectorEngine.disableRule(ruleId);
    }
    setRules([...detectorEngine.getRules()]);
  }, []);

  // Open rule editor for new rule
  const handleAddRule = useCallback(() => {
    setEditingRule(null);
    setShowRuleEditor(true);
  }, []);

  // Open rule editor for existing rule
  const handleEditRule = useCallback((rule: DetectionRule) => {
    setEditingRule(rule);
    setShowRuleEditor(true);
  }, []);

  // Save rule (create or update)
  const handleSaveRule = useCallback(
    (rule: DetectionRule) => {
      if (editingRule) {
        // Update existing rule
        detectorEngine.removeRule(rule.id);
      }
      detectorEngine.addRule(rule);
      setRules([...detectorEngine.getRules()]);
      setShowRuleEditor(false);
      setEditingRule(null);
    },
    [editingRule],
  );

  // Delete rule
  const handleDeleteRule = useCallback((ruleId: string) => {
    detectorEngine.removeRule(ruleId);
    setRules([...detectorEngine.getRules()]);
    setShowRuleEditor(false);
    setEditingRule(null);
  }, []);

  // Test masking
  const handleTest = useCallback(async () => {
    if (!testInput.trim()) {
      message.warning('请输入测试文本');
      return;
    }

    try {
      const result = await maskerEngine.maskText(testInput, 'text');
      setTestResult(result.masked);

      if (result.matches.length > 0) {
        message.success(`检测到 ${result.matches.length} 处敏感数据`);
      } else {
        message.info('未检测到敏感数据');
      }
    } catch (error) {
      message.error('测试失败');
      console.error(error);
    }
  }, [testInput]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    const defaultConfig = { ...DEFAULT_MASKING_CONFIG };
    setConfig(defaultConfig);
    maskerEngine.setConfig(defaultConfig);

    // Reset all rules to built-in defaults
    for (const rule of detectorEngine.getRules()) {
      if (rule.builtIn) {
        detectorEngine.enableRule(rule.id);
      }
    }
    setRules([...detectorEngine.getRules()]);

    message.success('已恢复默认设置');
    onConfigChange?.(defaultConfig);
  }, [onConfigChange]);

  // Filter rules by search text
  const filteredRules = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchText.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <div className="masking-settings" style={{ padding: '16px' }}>
      {/* Global Settings */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>脱敏设置</span>
          </Space>
        }
        size="small"
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>启用脱敏</span>
            <Switch
              checked={config.enabled}
              onChange={(checked) => updateConfig({ enabled: checked })}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>文本脱敏</span>
            <Switch
              checked={config.textMasking}
              disabled={!config.enabled}
              onChange={(checked) => updateConfig({ textMasking: checked })}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>日志脱敏</span>
            <Switch
              checked={config.logMasking}
              disabled={!config.enabled}
              onChange={(checked) => updateConfig({ logMasking: checked })}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>YAML 脱敏</span>
            <Switch
              checked={config.yamlMasking}
              disabled={!config.enabled}
              onChange={(checked) => updateConfig({ yamlMasking: checked })}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>截图脱敏级别</span>
            <Select
              size="small"
              value={config.screenshotMasking}
              disabled={!config.enabled}
              onChange={(value: ScreenshotMaskingLevel) =>
                updateConfig({ screenshotMasking: value })
              }
              options={SCREENSHOT_LEVEL_OPTIONS}
              style={{ width: 100 }}
            />
          </div>
        </div>
      </Card>

      {/* Test Panel */}
      <Card
        title={
          <Space>
            <EyeInvisibleOutlined />
            <span>测试脱敏</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            placeholder="输入测试文本，例如：password=abc123, 手机号13812345678"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            rows={2}
          />
          <Button type="primary" size="small" onClick={handleTest}>
            测试
          </Button>
          {testResult && (
            <div
              style={{
                padding: 8,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {testResult}
            </div>
          )}
        </Space>
      </Card>

      {/* Rules List */}
      <Card
        title="检测规则"
        size="small"
        extra={
          <Space>
            <Input
              size="small"
              placeholder="搜索规则"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 120 }}
              allowClear
            />
            <Tooltip title="添加规则">
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddRule}
              />
            </Tooltip>
            <Tooltip title="规则测试器">
              <Button
                size="small"
                icon={<ExperimentOutlined />}
                onClick={() => setShowRuleTester(true)}
              />
            </Tooltip>
            <Tooltip title="白名单管理">
              <Button
                size="small"
                icon={<OrderedListOutlined />}
                onClick={() => setShowWhitelist(true)}
              />
            </Tooltip>
          </Space>
        }
      >
        <List
          size="small"
          dataSource={filteredRules}
          renderItem={(rule) => (
            <List.Item
              key={rule.id}
              actions={[
                <Tooltip key="edit" title="编辑">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEditRule(rule)}
                  />
                </Tooltip>,
                <Switch
                  key="switch"
                  size="small"
                  checked={rule.enabled}
                  onChange={(checked) => toggleRule(rule.id, checked)}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4}>
                    <span style={{ fontSize: 13 }}>{rule.name}</span>
                    <Tag
                      color={CATEGORY_CONFIG[rule.category]?.color || 'default'}
                      style={{
                        fontSize: 10,
                        lineHeight: '16px',
                        padding: '0 4px',
                      }}
                    >
                      {CATEGORY_CONFIG[rule.category]?.label || rule.category}
                    </Tag>
                    {rule.builtIn && (
                      <Tag
                        color="geekblue"
                        style={{
                          fontSize: 10,
                          lineHeight: '16px',
                          padding: '0 4px',
                        }}
                      >
                        内置
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Tooltip title={rule.description}>
                    <span style={{ fontSize: 11, color: '#999' }}>
                      {rule.description.length > 40
                        ? rule.description.substring(0, 40) + '...'
                        : rule.description}
                    </span>
                  </Tooltip>
                }
              />
            </List.Item>
          )}
          style={{ maxHeight: 300, overflow: 'auto' }}
        />
      </Card>

      {/* Rule Editor Modal */}
      <RuleEditor
        visible={showRuleEditor}
        rule={editingRule}
        onSave={handleSaveRule}
        onCancel={() => {
          setShowRuleEditor(false);
          setEditingRule(null);
        }}
        onDelete={handleDeleteRule}
        existingRuleIds={rules.map((r) => r.id)}
      />

      {/* Rule Tester Modal */}
      {showRuleTester && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRuleTester(false);
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              maxWidth: 800,
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <RuleTester onClose={() => setShowRuleTester(false)} />
          </div>
        </div>
      )}

      {/* Whitelist Manager Modal */}
      {showWhitelist && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowWhitelist(false);
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              maxWidth: 600,
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <WhitelistManagerUI onClose={() => setShowWhitelist(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MaskingSettings;
