/**
 * Markdown Input Component
 * Allows users to paste or upload markdown requirements
 */

import { UploadOutlined, FileTextOutlined, ClearOutlined } from '@ant-design/icons';
import { Button, Input, Upload, Space, Typography, Alert, message } from 'antd';
import type { UploadProps } from 'antd';
import { useGeneratorStore } from '../store';

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
    message.success('示例已加载');
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
        message.success(`已加载文件: ${file.name}`);
      };
      reader.readAsText(file);
      return false; // Prevent auto upload
    },
  };

  return (
    <div className="markdown-input-container">
      <div className="input-header">
        <Title level={5} style={{ margin: 0 }}>
          <FileTextOutlined /> 输入测试需求
        </Title>
        <Space>
          <Button size="small" onClick={handleLoadExample}>
            加载示例
          </Button>
          <Upload {...uploadProps}>
            <Button size="small" icon={<UploadOutlined />}>
              上传文件
            </Button>
          </Upload>
          {markdownInput && (
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
              清空
            </Button>
          )}
        </Space>
      </div>

      <div className="input-hint">
        <Text type="secondary">
          使用 Markdown 格式描述测试用例：# 或 ## 作为用例名称，数字列表作为测试步骤
        </Text>
      </div>

      <TextArea
        value={markdownInput}
        onChange={handleChange}
        placeholder={`示例格式：

## 登录测试

1. 点击登录按钮
2. 输入用户名 "admin"
3. 输入密码
4. 点击提交
5. 验证登录成功`}
        rows={12}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />

      {error && (
        <Alert
          message="解析提示"
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
          解析需求
        </Button>
      </div>
    </div>
  );
}
