import {getTranslations} from 'next-intl/server';

export default async function GroupDetailPage({params}: {params: Promise<{groupId: string}>}) {
  const {groupId} = await params;
  const t = await getTranslations('groups');
  return (
    <div className="surface rounded-xl p-4">
      {t('detail_label')}: {groupId}
    </div>
  );
}
