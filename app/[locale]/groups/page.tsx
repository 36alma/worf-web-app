import {getTranslations} from 'next-intl/server';

export default async function GroupsPage() {
  const t = await getTranslations('groups');
  return (
    <section className="space-y-4">
      <h1 className="text-title text-fg">{t('title')}</h1>
      <div className="rounded-lg border border-border bg-surface-1 p-4 text-sm text-fg-secondary">{t('placeholder')}</div>
    </section>
  );
}
