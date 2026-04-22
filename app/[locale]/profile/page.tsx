import {getTranslations} from 'next-intl/server';
import ProfileClient from '@/components/profile/ProfileClient';

export default async function ProfilePage() {
  const t = await getTranslations('profile');

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="display-font text-2xl text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>
      <ProfileClient />
    </section>
  );
}
