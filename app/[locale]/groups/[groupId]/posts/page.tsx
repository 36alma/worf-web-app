import {getTranslations} from 'next-intl/server';

export default async function GroupPostsPage() {
  const t = await getTranslations('groups');
  return <div className="surface rounded-xl p-4">{t('group_posts')}</div>;
}
