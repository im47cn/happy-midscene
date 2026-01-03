/**
 * GitLab Configuration Component
 * Allows users to configure GitLab connection
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LoadingOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n';
import { type GitLabConfig, gitlabClient } from '../services/gitlabClient';
import { useGeneratorStore } from '../store';

const { Text, Title, Link } = Typography;

interface GitLabConfigProps {
  visible: boolean;
  onClose: () => void;
}

export function GitLabConfigModal({ visible, onClose }: GitLabConfigProps) {
  const { t } = useI18n();
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
        message: error instanceof Error ? error.message : t('validationFailed'),
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
        message: error instanceof Error ? error.message : t('saveFailed'),
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
          <span>{t('gitlabConfig')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="clear" onClick={handleClear} danger>
          {t('clearConfig')}
        </Button>,
        <Button key="test" onClick={handleTest} loading={loading}>
          {t('testConnection')}
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={loading}
          disabled={!testResult?.success}
        >
          {t('save')}
        </Button>,
      ]}
      width={500}
    >
      <div className="gitlab-config-content">
        <Alert
          message={t('securityTip')}
          description={t('gitlabTokenSecurityDesc')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item
            name="baseUrl"
            label={t('gitlabServerUrl')}
            rules={[
              { required: true, message: t('pleaseEnterGitlabUrl') },
              { type: 'url', message: t('pleaseEnterValidUrl') },
            ]}
          >
            <Input placeholder="https://gitlab.example.com" />
          </Form.Item>

          <Form.Item
            name="privateToken"
            label={t('privateAccessToken')}
            rules={[{ required: true, message: t('pleaseEnterToken') }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('tokenPermissionsRequired')}{' '}
                <Link
                  href="https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html"
                  target="_blank"
                >
                  {t('howToCreateToken')}
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
            message={testResult.success ? t('connectionSuccess') : t('connectionFailed')}
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
  const { t } = useI18n();
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
            <Text type="secondary">{t('gitlabConfigured')}</Text>
          </Space>
        ) : (
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <Text type="secondary">{t('gitlabNotConfigured')}</Text>
          </Space>
        )}
        <Button type="link" size="small">
          {t('settings')}
        </Button>
      </div>

      <GitLabConfigModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}
