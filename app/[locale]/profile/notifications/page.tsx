import {getTranslations} from 'next-intl/server';
import NotificationPreferencesClient from '@/components/profile/NotificationPreferencesClient';

export default async function ProfileNotificationsPage() {
  const t = await getTranslations('notifications.preferences');

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="display-font text-2xl text-[var(--text-primary)]">{t('page_title')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('page_subtitle')}</p>
      </div>

      <NotificationPreferencesClient />
    </section>
  );
}
