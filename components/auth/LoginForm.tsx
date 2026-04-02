'use client';

import {ArrowRight, LogIn, Shield} from 'lucide-react';
import {useLocale} from 'next-intl';
import {useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';

export default function LoginForm() {
  const locale = useLocale();
  const t = useTranslations('auth');

  const redirectToOauthLogin = () => {
    window.location.href = `/api/auth/oauth/login?locale=${encodeURIComponent(locale)}`;
  };

  return (
    <div className="w-full">
      <Button
        type="button"
        onClick={redirectToOauthLogin}
        className="auth-login-btn w-full"
        startIcon={<LogIn size={18} strokeWidth={1.75} />}
      >
        <span>{t('login')}</span>
        <ArrowRight size={16} strokeWidth={1.75} className="auth-btn-arrow" />
      </Button>
      <p className="auth-info">{t('redirect_info')}</p>
      <div className="auth-security">
        <Shield size={13} strokeWidth={1.75} />
        <span>{t('secure_connection')}</span>
      </div>
    </div>
  );
}
