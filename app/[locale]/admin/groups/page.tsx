import {getTranslations} from 'next-intl/server';

export default async function AdminGroupsPage() {
  const t = await getTranslations('admin');

  return (
    <div className="surface rounded-xl p-4 text-sm text-slate-300">
      <h2 className="mb-2 text-lg text-slate-100">{t('sections.groups')}</h2>
      <p>{t('groups_placeholder')}</p>
    </div>
  );
}
