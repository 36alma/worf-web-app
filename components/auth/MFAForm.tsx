'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import {verifyMfa} from '@/lib/api/auth';
import Button from '@/components/ui/Button';

export default function MFAForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'totp' | 'email'>('totp');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;

    try {
      setLoading(true);
      await verifyMfa(
        type === 'totp' ? {multi_factor_type: 'totp', totp_number: code} : {multi_factor_type: 'email', email_code: code}
      );
      toast.success(t('mfa_success'));
      router.push(`/${locale}/dashboard`);
    } catch {
      toast.error(t('mfa_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType('totp')}
          className={`rounded-md border px-3 py-2 text-sm ${type === 'totp' ? 'border-indigo-400 bg-indigo-500/20' : 'border-[var(--border)]'}`}
        >
          {t('mfa_method_totp')}
        </button>
        <button
          type="button"
          onClick={() => setType('email')}
          className={`rounded-md border px-3 py-2 text-sm ${type === 'email' ? 'border-indigo-400 bg-indigo-500/20' : 'border-[var(--border)]'}`}
        >
          {t('email')}
        </button>
      </div>

      <input
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2 text-center text-2xl tracking-[0.45em]"
      />

      <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
        {t('verify')}
      </Button>
    </form>
  );
}
