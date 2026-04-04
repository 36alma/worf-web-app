'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {CSSProperties, ReactNode} from 'react';
import {AlertTriangle, ArrowLeft, Bot, FileQuestion, Home, RefreshCw, ShieldOff, Wifi} from 'lucide-react';
import styles from './ErrorPage.module.css';
import type {ErrorMessages} from '@/lib/i18n/errorMessages';

interface ErrorPageProps {
  code: 404 | 500 | 403 | 503 | number;
  locale: 'hu' | 'en';
  messages: ErrorMessages;
  showRefresh?: boolean;
  onRefresh?: () => void;
}

interface ErrorConfigItem {
  icon: ReactNode;
  color: string;
  defaultTitle: string;
  defaultMessage: string;
  showRefresh: boolean;
}

export default function ErrorPage({
  code,
  locale,
  messages,
  showRefresh = false,
  onRefresh
}: ErrorPageProps) {
  const router = useRouter();

  const config: Record<number, ErrorConfigItem> = {
    404: {
      icon: <FileQuestion size={48} />,
      color: '#FF6B2C',
      defaultTitle: messages['404'].title,
      defaultMessage: messages['404'].message,
      showRefresh: false
    },
    403: {
      icon: <ShieldOff size={48} />,
      color: '#E5484D',
      defaultTitle: messages['403'].title,
      defaultMessage: messages['403'].message,
      showRefresh: false
    },
    500: {
      icon: <AlertTriangle size={48} />,
      color: '#E5A000',
      defaultTitle: messages['500'].title,
      defaultMessage: messages['500'].message,
      showRefresh: true
    },
    503: {
      icon: <Wifi size={48} />,
      color: '#3B82F6',
      defaultTitle: messages['503'].title,
      defaultMessage: messages['503'].message,
      showRefresh: true
    }
  };

  const current =
    config[code] ??
    ({
      icon: <AlertTriangle size={48} />,
      color: '#FF6B2C',
      defaultTitle: messages.generic.title,
      defaultMessage: messages.generic.message,
      showRefresh: false
    } as ErrorConfigItem);

  const shouldShowRefresh = showRefresh || current.showRefresh;
  const dashboardPath = `/${locale}/dashboard`;

  const iconStyle = {'--error-color': current.color} as CSSProperties;
  const glowStyle = {
    background: `radial-gradient(ellipse 40% 30% at 50% 50%, ${current.color}12 0%, transparent 70%)`
  } as CSSProperties;

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(dashboardPath);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    window.location.reload();
  };

  return (
    <div className={styles.page}>
      <div className={styles.background}>
        <div className={styles.glow} style={glowStyle} />
        <div className={styles.grid} />
      </div>

      <div className={styles.content}>
        <Link href={dashboardPath} className={styles.logo}>
          <div className={styles.logoIcon}>
            <Bot size={22} />
          </div>
          <span className={styles.logoText}>WORF</span>
        </Link>

        <div className={styles.iconWrap} style={iconStyle}>
          {current.icon}
        </div>

        <div className={styles.code} style={{color: current.color}}>
          {code}
        </div>

        <h1 className={styles.title}>{current.defaultTitle}</h1>
        <p className={styles.message}>{current.defaultMessage}</p>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={handleBack}>
            <ArrowLeft size={16} />
            {messages.actions.goBack}
          </button>

          <Link href={dashboardPath} className={styles.primaryBtn}>
            <Home size={16} />
            {messages.actions.goHome}
          </Link>

          {shouldShowRefresh ? (
            <button type="button" className={styles.secondaryBtn} onClick={handleRefresh}>
              <RefreshCw size={16} />
              {messages.actions.refresh}
            </button>
          ) : null}
        </div>

        <p className={styles.helpText}>
          {messages.help.prefix}{' '}
          <a href="mailto:support@worf.app" className={styles.helpLink}>
            {messages.help.contact}
          </a>
        </p>
      </div>
    </div>
  );
}