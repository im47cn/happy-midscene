/**
 * State Display Components
 * Unified loading, error, and empty state components
 */

import {
  ExclamationCircleOutlined,
  InboxOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Result, Skeleton, Space, Spin, Typography } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';

const { Text, Paragraph } = Typography;

/**
 * Loading state types
 */
export type LoadingType = 'spinner' | 'skeleton' | 'inline' | 'overlay';

interface LoadingStateProps {
  type?: LoadingType;
  text?: string;
  size?: 'small' | 'default' | 'large';
  rows?: number;
  fullScreen?: boolean;
}

/**
 * Unified Loading State Component
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'spinner',
  text = 'Loading...',
  size = 'default',
  rows = 3,
  fullScreen = false,
}) => {
  const spinnerSize = useMemo(() => {
    switch (size) {
      case 'small':
        return 24;
      case 'large':
        return 48;
      default:
        return 32;
    }
  }, [size]);

  const content = useMemo(() => {
    switch (type) {
      case 'skeleton':
        return (
          <div style={{ padding: 16 }}>
            <Skeleton active paragraph={{ rows }} />
          </div>
        );

      case 'inline':
        return (
          <Space>
            <LoadingOutlined style={{ fontSize: spinnerSize / 2 }} />
            <Text type="secondary">{text}</Text>
          </Space>
        );

      case 'overlay':
        return (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: spinnerSize }} spin />}
              tip={text}
            />
          </div>
        );

      case 'spinner':
      default:
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: fullScreen ? '20vh 0' : 48,
              gap: 16,
            }}
          >
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: spinnerSize }} spin />}
            />
            {text && <Text type="secondary">{text}</Text>}
          </div>
        );
    }
  }, [type, text, spinnerSize, rows, fullScreen]);

  if (fullScreen && type === 'spinner') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

/**
 * Error state types
 */
export type ErrorType = 'network' | 'notFound' | 'permission' | 'server' | 'unknown';

interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
  showDetails?: boolean;
}

/**
 * Unified Error State Component
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'unknown',
  title,
  message,
  error,
  onRetry,
  showDetails = false,
}) => {
  const errorConfig = useMemo(() => {
    switch (type) {
      case 'network':
        return {
          icon: <WifiOutlined style={{ fontSize: 48, color: '#faad14' }} />,
          defaultTitle: 'Network Error',
          defaultMessage: 'Unable to connect. Please check your internet connection.',
        };
      case 'notFound':
        return {
          icon: <SearchOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />,
          defaultTitle: 'Not Found',
          defaultMessage: 'The requested resource could not be found.',
        };
      case 'permission':
        return {
          icon: <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />,
          defaultTitle: 'Access Denied',
          defaultMessage: 'You do not have permission to access this resource.',
        };
      case 'server':
        return {
          icon: <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />,
          defaultTitle: 'Server Error',
          defaultMessage: 'Something went wrong on our end. Please try again later.',
        };
      case 'unknown':
      default:
        return {
          icon: <ExclamationCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />,
          defaultTitle: 'Something Went Wrong',
          defaultMessage: 'An unexpected error occurred. Please try again.',
        };
    }
  }, [type]);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 48,
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {errorConfig.icon}
        <Text strong style={{ fontSize: 16 }}>
          {title || errorConfig.defaultTitle}
        </Text>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {message || errorConfig.defaultMessage}
        </Paragraph>

        {showDetails && error && (
          <Alert
            type="error"
            message={error.name}
            description={error.message}
            style={{ textAlign: 'left', marginTop: 8 }}
          />
        )}

        {onRetry && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRetry}
          >
            Try Again
          </Button>
        )}
      </Space>
    </div>
  );
};

/**
 * Empty state types
 */
export type EmptyType = 'default' | 'search' | 'favorites' | 'history' | 'templates';

interface EmptyStateProps {
  type?: EmptyType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Unified Empty State Component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  description,
  action,
  icon,
}) => {
  const emptyConfig = useMemo(() => {
    switch (type) {
      case 'search':
        return {
          icon: <SearchOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: 'No Results Found',
          defaultDescription: 'Try adjusting your search or filters.',
        };
      case 'favorites':
        return {
          icon: <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: 'No Favorites Yet',
          defaultDescription: 'Add templates to your favorites to see them here.',
        };
      case 'history':
        return {
          icon: <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: 'No History',
          defaultDescription: 'Templates you use will appear here.',
        };
      case 'templates':
        return {
          icon: <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: 'No Templates',
          defaultDescription: 'No templates available in this category.',
        };
      case 'default':
      default:
        return {
          icon: null,
          defaultTitle: 'No Data',
          defaultDescription: 'There is nothing to show here.',
        };
    }
  }, [type]);

  return (
    <Empty
      image={icon || emptyConfig.icon || Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size="small">
          <Text strong>{title || emptyConfig.defaultTitle}</Text>
          <Text type="secondary">
            {description || emptyConfig.defaultDescription}
          </Text>
        </Space>
      }
      style={{ padding: 48 }}
    >
      {action}
    </Empty>
  );
};

/**
 * Combined State Display Props
 */
interface StateDisplayProps {
  loading?: boolean;
  loadingType?: LoadingType;
  loadingText?: string;
  error?: Error | null;
  errorType?: ErrorType;
  onRetry?: () => void;
  empty?: boolean;
  emptyType?: EmptyType;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Combined State Display Component
 * Handles loading, error, and empty states in one component
 */
export const StateDisplay: React.FC<StateDisplayProps> = ({
  loading = false,
  loadingType = 'spinner',
  loadingText,
  error = null,
  errorType = 'unknown',
  onRetry,
  empty = false,
  emptyType = 'default',
  emptyAction,
  children,
}) => {
  if (loading) {
    return <LoadingState type={loadingType} text={loadingText} />;
  }

  if (error) {
    return (
      <ErrorState
        type={errorType}
        error={error}
        onRetry={onRetry}
        showDetails={process.env.NODE_ENV === 'development'}
      />
    );
  }

  if (empty) {
    return <EmptyState type={emptyType} action={emptyAction} />;
  }

  return <>{children}</>;
};

export default StateDisplay;
