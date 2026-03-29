import {getTranslations} from 'next-intl/server';

export default async function PostsPage() {
  const t = await getTranslations('posts');
  return (
    <section className="space-y-4">
      <h1 className="display-font text-2xl">{t('title')}</h1>
      <div className="surface rounded-xl p-4 text-sm text-slate-300">{t('placeholder')}</div>
    </section>
  );
}
