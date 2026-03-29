'use client';

import {useEffect} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {verifyEmail} from '@/lib/api/auth';

export default function VerifyEmailClient({token}: {token?: string}) {
  const t = useTranslations('auth');

  useEffect(() => {
    if (!token) return;

    verifyEmail(token)
      .then(() => toast.success(t('verify_success')))
      .catch(() => toast.error(t('verify_error')));
  }, [token, t]);

  return <p className="text-sm text-slate-300">{token ? t('verifying') : t('verify_missing_token')}</p>;
}
