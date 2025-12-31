/**
 * GitLab Configuration Component
 * Allows users to configure GitLab connection
 */

import {
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  Alert,
  Divider,
} from 'antd';
import { useEffect, useState } from 'react';
import { gitlabClient, type GitLabConfig } from '../services/gitlabClient';
import { useGeneratorStore } from '../store';

const { Text, Title, Link } = Typography;

interface GitLabConfigProps {
  visible: boolean;
  onClose: () => void;
}

export function GitLabConfigModal({ visible, onClose }: GitLabConfigProps) {
  const [form] = Form.useForm();
  const { checkGitLabConfig } = useGeneratorStore();

  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (visible && !configLoaded) {
      loadExistingConfig();
    }
  }, [visible]);

  const loadExistingConfig = async () => {
    const config = await gitlabClient.loadConfig();
    if (config) {
      form.setFieldsValue({
        baseUrl: config.baseUrl,
        privateToken: config.privateToken,
      });
      setConfigLoaded(true);
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setTestResult(null);

      // Save config temporarily
      await gitlabClient.saveConfig({
        baseUrl: values.baseUrl,
        privateToken: values.privateToken,
      });

      // Test connection
      const result = await gitlabClient.testConnection();
      setTestResult(result);

      if (result.success) {
        await checkGitLabConfig();
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await gitlabClient.saveConfig({
        baseUrl: values.baseUrl,
        privateToken: values.privateToken,
      });

      await checkGitLabConfig();
      onClose();
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Save failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await gitlabClient.clearConfig();
    form.resetFields();
    setTestResult(null);
    setConfigLoaded(false);
    await checkGitLabConfig();
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>GitLab 配置</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="clear" onClick={handleClear} danger>
          清除配置
        </Button>,
        <Button key="test" onClick={handleTest} loading={loading}>
          测试连接
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={loading}
          disabled={!testResult?.success}
        >
          保存
        </Button>,
      ]}
      width={500}
    >
      <div className="gitlab-config-content">
        <Alert
          message="安全提示"
          description="您的 GitLab Token 将加密存储在本地浏览器中，不会上传至任何服务器。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item
            name="baseUrl"
            label="GitLab 服务器地址"
            rules={[
              { required: true, message: '请输入 GitLab 地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input placeholder="https://gitlab.example.com" />
          </Form.Item>

          <Form.Item
            name="privateToken"
            label="Private Access Token"
            rules={[{ required: true, message: '请输入 Token' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                需要 <code>api</code> 和 <code>write_repository</code> 权限。
                <Link
                  href="https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html"
                  target="_blank"
                >
                  {' '}
                  如何创建 Token?
                </Link>
              </Text>
            }
          >
            <Input.Password
              placeholder="glpat-xxxxxxxxxxxx"
              iconRender={(visible) =>
                visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>
        </Form>

        {testResult && (
          <Alert
            message={testResult.success ? '连接成功' : '连接失败'}
            description={testResult.message}
            type={testResult.success ? 'success' : 'error'}
            showIcon
            icon={
              testResult.success ? (
                <CheckCircleOutlined />
              ) : (
                <CloseCircleOutlined />
              )
            }
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    </Modal>
  );
}

// Compact status display for main view
export function GitLabStatus() {
  const { gitlabConfigured, checkGitLabConfig } = useGeneratorStore();
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    checkGitLabConfig();
  }, []);

  return (
    <>
      <div className="gitlab-status" onClick={() => setModalVisible(true)}>
        {gitlabConfigured ? (
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text type="secondary">GitLab 已配置</Text>
          </Space>
        ) : (
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <Text type="secondary">GitLab 未配置</Text>
          </Space>
        )}
        <Button type="link" size="small">
          设置
        </Button>
      </div>

      <GitLabConfigModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}
