/**
 * Markdown Input Component
 * Allows users to paste or upload markdown requirements
 */

import {
  ClearOutlined,
  FileTextOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Space, Typography, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useGeneratorStore } from '../store';
import { useI18n } from '../../../i18n';

const { TextArea } = Input;
const { Text, Title } = Typography;

const EXAMPLE_MARKDOWN = `## 用户登录流程

1. 点击页面右上角的"登录"按钮
2. 在用户名输入框中输入 "admin"
3. 在密码输入框中输入 "123456"
4. 点击"提交"按钮
5. 验证页面跳转到首页

## 搜索商品流程

1. 在搜索框中输入 "iPhone 15"
2. 点击搜索按钮
3. 等待 2 秒
4. 验证搜索结果中包含 "iPhone" 相关商品
`;

export function MarkdownInput() {
  const {
    markdownInput,
    setMarkdownInput,
    parseInput,
    parseResult,
    error,
    setCurrentView,
  } = useGeneratorStore();

  const { t } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdownInput(e.target.value);
  };

  const handleParse = () => {
    parseInput();
    if (useGeneratorStore.getState().parseResult?.cases.length) {
      setCurrentView('preview');
    }
  };

  const handleLoadExample = () => {
    setMarkdownInput(EXAMPLE_MARKDOWN);
    message.success(t('exampleLoaded'));
  };

  const handleClear = () => {
    setMarkdownInput('');
  };

  const uploadProps: UploadProps = {
    accept: '.md,.markdown,.txt',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setMarkdownInput(content);
        message.success(`${t('fileLoaded')}: ${file.name}`);
      };
      reader.readAsText(file);
      return false; // Prevent auto upload
    },
  };

  return (
    <div className="markdown-input-container">
      <div className="input-header">
        <Title level={5} style={{ margin: 0 }}>
          <FileTextOutlined /> {t('inputTestRequirements')}
        </Title>
        <Space>
          <Button size="small" onClick={handleLoadExample}>
            {t('loadExample')}
          </Button>
          <Upload {...uploadProps}>
            <Button size="small" icon={<UploadOutlined />}>
              {t('uploadFile')}
            </Button>
          </Upload>
          {markdownInput && (
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
              {t('clear')}
            </Button>
          )}
        </Space>
      </div>

      <div className="input-hint">
        <Text type="secondary">
          {t('inputPlaceholder').split('\n')[0]}
        </Text>
      </div>

      <TextArea
        value={markdownInput}
        onChange={handleChange}
        placeholder={t('inputPlaceholder')}
        rows={12}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />

      {error && (
        <Alert
          message={t('parseFailed')}
          description={error}
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
        />
      )}

      <div className="input-actions">
        <Button
          type="primary"
          onClick={handleParse}
          disabled={!markdownInput.trim()}
          block
        >
          {t('parseAndPreview')}
        </Button>
      </div>
    </div>
  );
}
