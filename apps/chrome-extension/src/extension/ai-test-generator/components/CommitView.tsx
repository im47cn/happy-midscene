/**
 * Commit View Component
 * Shows generated YAML and allows committing to GitLab
 */

import {
  BranchesOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  GitlabOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Result,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  type GitLabBranch,
  type GitLabProject,
  gitlabClient,
} from '../services/gitlabClient';
import { useGeneratorStore } from '../store';
import { GitLabConfigModal } from './GitLabConfig';

const { Text, Title, Paragraph, Link } = Typography;
const { TextArea } = Input;

export function CommitView() {
  const {
    generatedYaml,
    updateYaml,
    yamlEdited,
    gitlabConfigured,
    selectedProject,
    setSelectedProject,
    selectedBranch,
    setSelectedBranch,
    newBranchName,
    setNewBranchName,
    commitPath,
    setCommitPath,
    commitMessage,
    setCommitMessage,
    setCurrentView,
    parseResult,
  } = useGeneratorStore();

  const { t } = useI18n();
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [branches, setBranches] = useState<GitLabBranch[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    success: boolean;
    url?: string;
    error?: string;
  } | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [createNewBranch, setCreateNewBranch] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  // Load projects on mount
  useEffect(() => {
    if (gitlabConfigured) {
      loadProjects();
    }
  }, [gitlabConfigured]);

  // Load branches when project changes
  useEffect(() => {
    if (selectedProject) {
      loadBranches(selectedProject.id);
    }
  }, [selectedProject]);

  // Generate default commit message
  useEffect(() => {
    if (parseResult && !commitMessage) {
      const caseNames = parseResult.cases.map((c) => c.name).join(', ');
      setCommitMessage(
        `feat(test): add AI-generated test cases\n\nCases: ${caseNames}`,
      );
    }
  }, [parseResult]);

  // Generate default file path
  useEffect(() => {
    if (parseResult && commitPath === 'tests/ai-generated/') {
      const firstCase = parseResult.cases[0];
      if (firstCase) {
        const fileName = firstCase.name
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '');
        setCommitPath(`tests/ai-generated/${fileName}.yaml`);
      }
    }
  }, [parseResult]);

  const loadProjects = async (search?: string) => {
    setLoadingProjects(true);
    try {
      const result = await gitlabClient.searchProjects(search);
      setProjects(result);
    } catch (error) {
      message.error(t('loadProjectsFailed'));
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadBranches = async (projectId: number) => {
    setLoadingBranches(true);
    try {
      const result = await gitlabClient.getBranches(projectId);
      setBranches(result);
    } catch (error) {
      message.error(t('loadBranchesFailed'));
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(generatedYaml);
    message.success(t('copiedToClipboard'));
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([generatedYaml], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'test-case.yaml';
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('fileDownloaded'));
  };

  const handleCommit = async () => {
    if (!selectedProject) {
      message.error(t('pleaseSelectProject'));
      return;
    }

    const targetBranch = createNewBranch ? newBranchName : selectedBranch;
    if (!targetBranch) {
      message.error(t('pleaseSelectOrCreateBranch'));
      return;
    }

    if (!commitPath.endsWith('.yaml') && !commitPath.endsWith('.yml')) {
      message.error(t('filePathMustEndWithYaml'));
      return;
    }

    setCommitting(true);
    setCommitResult(null);

    try {
      // Create new branch if needed
      if (createNewBranch && newBranchName) {
        await gitlabClient.createBranch(
          selectedProject.id,
          newBranchName,
          selectedProject.default_branch,
        );
      }

      // Commit file
      const result = await gitlabClient.commitFile(
        selectedProject.id,
        commitPath,
        generatedYaml,
        targetBranch,
        commitMessage,
      );

      setCommitResult({
        success: true,
        url: result.web_url,
      });

      message.success(t('commitSuccess') + '!');
    } catch (error) {
      setCommitResult({
        success: false,
        error: error instanceof Error ? error.message : t('commitFailed'),
      });
      message.error(t('commitFailed'));
    } finally {
      setCommitting(false);
    }
  };

  const handleBack = () => {
    setCurrentView('preview');
  };

  const handleNewTest = () => {
    useGeneratorStore.getState().reset();
    setCurrentView('input');
  };

  // Show success result
  if (commitResult?.success) {
    return (
      <Result
        status="success"
        title={t('scriptCommitSuccess') + '!'}
        subTitle={t('scriptCommitSuccessDesc')}
        extra={[
          <Button
            type="primary"
            key="view"
            icon={<LinkOutlined />}
            onClick={() => window.open(commitResult.url, '_blank')}
          >
            {t('viewFile')}
          </Button>,
          <Button key="new" onClick={handleNewTest}>
            {t('createNewTest')}
          </Button>,
        ]}
      />
    );
  }

  return (
    <div className="commit-view-container">
      <div className="commit-header">
        <Title level={5} style={{ margin: 0 }}>
          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
          {t('scriptGenerationComplete')}
        </Title>
      </div>

      {/* YAML Preview/Editor */}
      <Card
        size="small"
        title={t('generatedYamlScript')}
        extra={
          <Space>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={handleCopyYaml}
            >
              {t('copy')}
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownloadYaml}
            >
              {t('download')}
            </Button>
          </Space>
        }
        className="yaml-preview-card"
      >
        <TextArea
          value={generatedYaml}
          onChange={(e) => updateYaml(e.target.value)}
          rows={10}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        {yamlEdited && (
          <Alert
            message={t('scriptManuallyModified')}
            type="info"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </Card>

      <Divider />

      {/* GitLab Commit Section */}
      <Card
        size="small"
        title={
          <>
            <GitlabOutlined /> {t('commitToGitLab')}
          </>
        }
      >
        {!gitlabConfigured ? (
          <div className="gitlab-not-configured">
            <Alert
              message={t('gitlabNotConfigured')}
              description={t('gitlabNotConfiguredDesc')}
              type="warning"
              showIcon
              action={
                <Button
                  size="small"
                  onClick={() => setConfigModalVisible(true)}
                >
                  {t('configureNow')}
                </Button>
              }
            />
          </div>
        ) : (
          <Form layout="vertical" size="small">
            {/* Project Select */}
            <Form.Item label={t('targetProject')}>
              <Select
                showSearch
                placeholder={t('searchAndSelectProject')}
                loading={loadingProjects}
                value={selectedProject?.id}
                onChange={(value) => {
                  const project = projects.find((p) => p.id === value);
                  setSelectedProject(project || null);
                }}
                onSearch={(value) => {
                  setProjectSearch(value);
                  loadProjects(value);
                }}
                filterOption={false}
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.path_with_namespace,
                }))}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {/* Branch Select */}
            <Form.Item label={t('targetBranch')}>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  placeholder={t('selectBranch')}
                  loading={loadingBranches}
                  value={createNewBranch ? undefined : selectedBranch}
                  onChange={(value) => {
                    setSelectedBranch(value);
                    setCreateNewBranch(false);
                  }}
                  disabled={createNewBranch}
                  options={branches.map((b) => ({
                    value: b.name,
                    label: (
                      <Space>
                        <BranchesOutlined />
                        {b.name}
                        {b.default && (
                          <Text type="secondary">({t('default')})</Text>
                        )}
                      </Space>
                    ),
                  }))}
                  style={{ flex: 1 }}
                />
                <Button
                  type={createNewBranch ? 'primary' : 'default'}
                  onClick={() => setCreateNewBranch(!createNewBranch)}
                >
                  {t('createNewBranch')}
                </Button>
              </Space.Compact>

              {createNewBranch && (
                <Input
                  placeholder={t('newBranchNamePlaceholder')}
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  prefix={<BranchesOutlined />}
                  style={{ marginTop: 8 }}
                />
              )}
            </Form.Item>

            {/* File Path */}
            <Form.Item label={t('filePath')}>
              <Input
                placeholder={t('filePathPlaceholder')}
                value={commitPath}
                onChange={(e) => setCommitPath(e.target.value)}
                prefix={<FolderOutlined />}
              />
            </Form.Item>

            {/* Commit Message */}
            <Form.Item label={t('commitMessage')}>
              <TextArea
                placeholder={t('commitMessagePlaceholder')}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
              />
            </Form.Item>

            {commitResult?.error && (
              <Alert
                message={t('commitFailed')}
                description={commitResult.error}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item>
              <Space>
                <Button onClick={handleBack}>{t('backToEdit')}</Button>
                <Button
                  type="primary"
                  icon={<GitlabOutlined />}
                  onClick={handleCommit}
                  loading={committing}
                  disabled={!selectedProject}
                >
                  {t('commitToGitLabBtn')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>

      <GitLabConfigModal
        visible={configModalVisible}
        onClose={() => setConfigModalVisible(false)}
      />
    </div>
  );
}
