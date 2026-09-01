'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

export default function SharedLinkPage() {
  const t = useTranslations('sharedLink');
  const params = useParams();
  const token = String(params.token ?? '');

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const handleOpen = async () => {
    setIsSubmitting(true);
    setError(false);
    try {
      const response = await fetch(`/api/files/shared/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: password || undefined}),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      const data = (await response.json()) as {redirectUrl?: string};
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-root)] px-4">
      <div className="w-full max-w-sm space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-tertiary)]">{t('description')}</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('passwordPlaceholder')}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        {error && <p className="text-sm text-[var(--danger)]">{t('invalidOrExpired')}</p>}
        <Button type="button" variant="primary" loading={isSubmitting} onClick={() => void handleOpen()} className="w-full">
          {t('open')}
        </Button>
      </div>
    </div>
  );
}
