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
import { useI18n } from '../../../../i18n';

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
  text,
  size = 'default',
  rows = 3,
  fullScreen = false,
}) => {
  const { t } = useI18n();
  const loadingText = text || t('loading');

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
            <Text type="secondary">{loadingText}</Text>
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
              tip={loadingText}
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
            {loadingText && <Text type="secondary">{loadingText}</Text>}
          </div>
        );
    }
  }, [type, loadingText, spinnerSize, rows, fullScreen]);

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
  const { t } = useI18n();

  const errorConfig = useMemo(() => {
    switch (type) {
      case 'network':
        return {
          icon: <WifiOutlined style={{ fontSize: 48, color: '#faad14' }} />,
          defaultTitle: t('networkError'),
          defaultMessage: t('networkErrorMessage'),
        };
      case 'notFound':
        return {
          icon: <SearchOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />,
          defaultTitle: t('notFound'),
          defaultMessage: t('notFoundMessage'),
        };
      case 'permission':
        return {
          icon: <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />,
          defaultTitle: t('accessDenied'),
          defaultMessage: t('accessDeniedMessage'),
        };
      case 'server':
        return {
          icon: <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />,
          defaultTitle: t('serverError'),
          defaultMessage: t('serverErrorMessage'),
        };
      case 'unknown':
      default:
        return {
          icon: <ExclamationCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />,
          defaultTitle: t('somethingWentWrong'),
          defaultMessage: t('unexpectedError'),
        };
    }
  }, [type, t]);

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
            {t('tryAgain')}
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
  const { t } = useI18n();

  const emptyConfig = useMemo(() => {
    switch (type) {
      case 'search':
        return {
          icon: <SearchOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: t('noResultsFound'),
          defaultDescription: t('tryAdjustingFilters'),
        };
      case 'favorites':
        return {
          icon: <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: t('noFavoritesYet'),
          defaultDescription: t('addTemplatesToFavorites'),
        };
      case 'history':
        return {
          icon: <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: t('noHistory'),
          defaultDescription: t('templatesWillAppearHere'),
        };
      case 'templates':
        return {
          icon: <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />,
          defaultTitle: t('noTemplates'),
          defaultDescription: t('noTemplatesInCategory'),
        };
      case 'default':
      default:
        return {
          icon: null,
          defaultTitle: t('noData'),
          defaultDescription: t('nothingToShow'),
        };
    }
  }, [type, t]);

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
