import {useTranslations} from 'next-intl';

export default function PostCard() {
  const t = useTranslations('posts');
  return <div className="surface rounded-lg p-3">{t('card_title')}</div>;
}
