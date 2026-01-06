/**
 * AuthButton Component
 * Login/logout button for GitHub authentication
 */

import {
  GithubOutlined,
  LoadingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, message } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../../i18n';
import { githubAuth } from '../services/githubAuth';
import type { AuthState } from '../types';

interface AuthButtonProps {
  onAuthChange?: (state: AuthState) => void;
  showLogoutButton?: boolean;
  size?: 'small' | 'middle' | 'large';
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  onAuthChange,
  showLogoutButton = true,
  size = 'small',
}) => {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>(
    githubAuth.getAuthState(),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = githubAuth.subscribe((state) => {
      setAuthState(state);
      onAuthChange?.(state);
    });

    return () => {
      unsubscribe();
    };
  }, [onAuthChange]);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    try {
      const state = await githubAuth.login();
      if (state.isAuthenticated) {
        message.success(t('loginSuccess'));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (
        errorMessage.includes('cancelled') ||
        errorMessage.includes('closed')
      ) {
        message.info(t('loginCancelled'));
      } else {
        message.error(`${t('loginFailed')}: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleLogout = useCallback(async () => {
    await githubAuth.logout();
    message.success(t('logoutSuccess'));
  }, [t]);

  if (authState.isAuthenticated && authState.user) {
    if (!showLogoutButton) {
      return null;
    }

    return (
      <Tooltip title={t('logout')}>
        <Button size={size} icon={<LogoutOutlined />} onClick={handleLogout} />
      </Tooltip>
    );
  }

  return (
    <Button
      type="default"
      size={size}
      icon={loading ? <LoadingOutlined /> : <GithubOutlined />}
      onClick={handleLogin}
      disabled={loading}
    >
      {loading ? t('loggingIn') : t('loginWithGitHub')}
    </Button>
  );
};

export default AuthButton;
