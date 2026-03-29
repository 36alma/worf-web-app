import {getTranslations} from 'next-intl/server';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default async function ResetPasswordPage({searchParams}: {searchParams: {token?: string}}) {
  const t = await getTranslations('auth');
  const token = searchParams.token ?? '';

  return (
    <div className="mx-auto mt-16 max-w-md surface rounded-xl p-6">
      <h1 className="display-font mb-6 text-2xl">{t('reset_password')}</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}
