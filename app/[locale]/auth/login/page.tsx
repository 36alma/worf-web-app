import Link from 'next/link';
import { Bot } from 'lucide-react';
import {redirect} from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import LoginForm from '@/components/auth/LoginForm';
import LoginError from '@/components/auth/LoginError';
import {getServerRefreshToken} from '@/lib/utils/cookies';

export default async function LoginPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string | string[]}>;
}) {
  const {locale} = await params;
  const {error} = await searchParams;
  const errorMessage = Array.isArray(error) ? error[0] : error;
  const t = await getTranslations('auth');

  // With an error to show, skip the silent refresh redirect — otherwise the
  // user is bounced to the dashboard and never sees why sign-in failed.
  const refreshToken = await getServerRefreshToken();
  if (refreshToken && !errorMessage) {
    const fallback = encodeURIComponent(`/${locale}/auth/login`);
    const destination = encodeURIComponent(`/${locale}/dashboard`);
    redirect(`/api/auth/token?redirect=${destination}&fallback=${fallback}`);
  }

  return (
    <div className="auth-page -m-4 md:-m-8">
      <div className="auth-bg">
        <div className="auth-bg-gradient" />
        <div className="auth-bg-grid" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Bot size={32} strokeWidth={1.75} />
          </div>
        </div>

        <h1 className="auth-title">{t('brand_title')}</h1>
        <p className="auth-subtitle">{t('subtitle')}</p>

        <div className="auth-divider" />

        {errorMessage ? <LoginError error={errorMessage} /> : null}

        <LoginForm />
      </div>

      <footer className="auth-footer">
        <span>{t('footer_copyright')}</span>
      </footer>
    </div>
  );
}
