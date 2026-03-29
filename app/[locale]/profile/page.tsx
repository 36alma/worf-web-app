import {getTranslations} from 'next-intl/server';
import ProfileForm from '@/components/profile/ProfileForm';

export default async function ProfilePage() {
  const t = await getTranslations('profile');

  return (
    <section className="space-y-4">
      <h1 className="display-font text-2xl">{t('title')}</h1>
      <p className="text-sm text-slate-300">{t('subtitle')}</p>
      <ProfileForm />
    </section>
  );
}
