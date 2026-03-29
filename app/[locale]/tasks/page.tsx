import {getTranslations} from 'next-intl/server';

export default async function TasksPage() {
  const t = await getTranslations('tasks');
  return (
    <section className="space-y-4">
      <h1 className="display-font text-2xl">{t('title')}</h1>
      <div className="surface rounded-xl p-4 text-sm text-slate-300">{t('placeholder')}</div>
    </section>
  );
}
