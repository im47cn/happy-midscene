/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */

import { BugOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Collapse, Result, Space, Typography } from 'antd';
import { Component, type ReactNode } from 'react';

const { Text, Paragraph } = Typography;

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('AI Test Generator Error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleCopyError = (): void => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
    `.trim();

    navigator.clipboard.writeText(errorText);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const { fallbackTitle = 'AI Test Generator 发生错误' } = this.props;

      return (
        <div className="error-boundary-container">
          <Result
            status="error"
            icon={<BugOutlined />}
            title={fallbackTitle}
            subTitle="组件遇到了意外错误，请尝试刷新或重置"
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={this.handleReset}
                >
                  重置组件
                </Button>
                <Button icon={<CopyOutlined />} onClick={this.handleCopyError}>
                  复制错误信息
                </Button>
              </Space>
            }
          >
            <Collapse
              size="small"
              items={[
                {
                  key: 'error',
                  label: <Text type="secondary">查看错误详情</Text>,
                  children: (
                    <div className="error-details">
                      <Paragraph>
                        <Text strong>错误信息:</Text>
                        <br />
                        <Text code>{error?.message || 'Unknown error'}</Text>
                      </Paragraph>

                      {error?.stack && (
                        <Paragraph>
                          <Text strong>调用栈:</Text>
                          <pre className="error-stack">{error.stack}</pre>
                        </Paragraph>
                      )}

                      {errorInfo?.componentStack && (
                        <Paragraph>
                          <Text strong>组件栈:</Text>
                          <pre className="error-stack">
                            {errorInfo.componentStack}
                          </pre>
                        </Paragraph>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Simpler functional wrapper for common use cases
 */
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  return (
    <Result
      status="error"
      title="发生错误"
      subTitle={error.message}
      extra={
        <Button type="primary" onClick={resetErrorBoundary}>
          重试
        </Button>
      }
    />
  );
}
