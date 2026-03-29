import MFAForm from '@/components/auth/MFAForm';
import {getTranslations} from 'next-intl/server';

export default async function MfaPage() {
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto mt-16 max-w-md surface rounded-xl p-6">
      <h1 className="display-font mb-2 text-2xl">{t('mfa_title')}</h1>
      <p className="mb-6 text-sm text-slate-400">{t('mfa_enter_code')}</p>
      <MFAForm />
    </div>
  );
}
