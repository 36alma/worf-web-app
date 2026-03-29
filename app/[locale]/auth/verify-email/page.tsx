import {getTranslations} from 'next-intl/server';
import VerifyEmailClient from '@/components/auth/VerifyEmailClient';

export default async function VerifyEmailPage({searchParams}: {searchParams: {token?: string}}) {
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto mt-16 max-w-md surface rounded-xl p-6 text-center">
      <h1 className="display-font mb-4 text-2xl">{t('verify_email')}</h1>
      <VerifyEmailClient token={searchParams.token} />
    </div>
  );
}
