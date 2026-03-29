import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import RegisterForm from '@/components/auth/RegisterForm';

export default async function RegisterPage({params}: {params: {locale: string}}) {
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto mt-16 max-w-md surface rounded-xl p-6">
      <h1 className="display-font mb-6 text-2xl">{t('register')}</h1>
      <RegisterForm />
      <p className="mt-4 text-sm text-slate-400">
        <Link href={`/${params.locale}/auth/login`}>{t('login')}</Link>
      </p>
    </div>
  );
}
