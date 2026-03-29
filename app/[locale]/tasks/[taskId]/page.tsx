import {getTranslations} from 'next-intl/server';

export default async function TaskDetailPage({params}: {params: Promise<{taskId: string}>}) {
  const {taskId} = await params;
  const t = await getTranslations('tasks');
  return (
    <div className="surface rounded-xl p-4">
      {t('detail_label')}: {taskId}
    </div>
  );
}
