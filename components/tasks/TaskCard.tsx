import {useTranslations} from 'next-intl';

export default function TaskCard() {
  const t = useTranslations('tasks');
  return <div className="surface rounded-lg p-3">{t('card_title')}</div>;
}
