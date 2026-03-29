'use client';

import {useLocale} from 'next-intl';
import {useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';

export default function LoginForm() {
  const locale = useLocale();
  const t = useTranslations('auth');

  const redirectToOauthLogin = () => {
    window.location.href = `/api/auth/oauth/login?locale=${encodeURIComponent(locale)}`;
  };

  return (
    <form className="space-y-4">
      <Button type="button" onClick={redirectToOauthLogin} className="w-full">
        {t('login_worf')}
      </Button>
    </form>
  );
}
