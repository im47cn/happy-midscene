/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */

import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Typography } from 'antd';
import type React from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

const { Text, Paragraph } = Typography;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class MarketplaceErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console
    console.error('Marketplace Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <Card
          style={{
            margin: 16,
            textAlign: 'center',
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <WarningOutlined
              style={{ fontSize: 48, color: '#faad14' }}
            />
            <Text strong style={{ fontSize: 16 }}>
              Something went wrong
            </Text>
            <Paragraph type="secondary">
              An error occurred while loading the marketplace. Please try again.
            </Paragraph>

            {showDetails && error && (
              <Alert
                type="error"
                message={error.name}
                description={
                  <div style={{ textAlign: 'left' }}>
                    <Text code style={{ display: 'block', marginBottom: 8 }}>
                      {error.message}
                    </Text>
                    {errorInfo?.componentStack && (
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#8c8c8c' }}>
                          Component Stack
                        </summary>
                        <pre
                          style={{
                            fontSize: 11,
                            maxHeight: 150,
                            overflow: 'auto',
                            background: '#f5f5f5',
                            padding: 8,
                            borderRadius: 4,
                          }}
                        >
                          {errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                }
                style={{ marginTop: 8 }}
              />
            )}

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.handleRetry}
            >
              Try Again
            </Button>
          </Space>
        </Card>
      );
    }

    return children;
  }
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <MarketplaceErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </MarketplaceErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithErrorBoundary;
}

export default MarketplaceErrorBoundary;
