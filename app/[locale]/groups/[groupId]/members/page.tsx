import {getTranslations} from 'next-intl/server';

export default async function GroupMembersPage() {
  const t = await getTranslations('groups');
  return <div className="surface rounded-xl p-4">{t('group_members')}</div>;
}
