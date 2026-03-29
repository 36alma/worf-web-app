import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import {getTranslations} from 'next-intl/server';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto mt-16 max-w-md surface rounded-xl p-6">
      <h1 className="display-font mb-6 text-2xl">{t('forgot_password')}</h1>
      <ForgotPasswordForm />
    </div>
  );
}
