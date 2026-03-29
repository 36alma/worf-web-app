import {getTranslations} from 'next-intl/server';
import LoginForm from '@/components/auth/LoginForm';

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto mt-16 max-w-md surface rounded-xl p-6">
      <h1 className="display-font mb-6 text-2xl">{t('login')}</h1>
      <LoginForm />
    </div>
  );
}
