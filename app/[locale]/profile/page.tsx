import {getTranslations} from 'next-intl/server';
import ProfileForm from '@/components/profile/ProfileForm';
import ProfilePreferences from '@/components/profile/ProfilePreferences';

export default async function ProfilePage() {
  const t = await getTranslations('profile');

  return (
    <section className="space-y-4">
      <h1 className="display-font text-2xl text-[var(--text-primary)]">{t('title')}</h1>
      <p className="text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      <ProfilePreferences />
      <ProfileForm />
    </section>
  );
}
