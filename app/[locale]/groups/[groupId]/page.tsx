import {getTranslations} from 'next-intl/server';

export default async function GroupDetailPage({params}: {params: {groupId: string}}) {
  const t = await getTranslations('groups');
  return (
    <div className="surface rounded-xl p-4">
      {t('detail_label')}: {params.groupId}
    </div>
  );
}
