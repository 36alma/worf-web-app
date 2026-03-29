import {getTranslations} from 'next-intl/server';

export default async function TaskDetailPage({params}: {params: {taskId: string}}) {
  const t = await getTranslations('tasks');
  return (
    <div className="surface rounded-xl p-4">
      {t('detail_label')}: {params.taskId}
    </div>
  );
}
