import {useTranslations} from 'next-intl';

export default function GroupCard() {
  const t = useTranslations('groups');
  return <div className="surface rounded-lg p-4">{t('card_title')}</div>;
}
