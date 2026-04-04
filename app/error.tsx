'use client';

import {usePathname} from 'next/navigation';
import ErrorPage from '@/components/error/ErrorPage';
import {getErrorMessages, resolveErrorLocale} from '@/lib/i18n/errorMessages';

interface RootErrorProps {
  error: Error & {digest?: string};
  reset: () => void;
}

export default function RootError({error, reset}: RootErrorProps) {
  console.error('Root error boundary:', error);

  const pathname = usePathname();
  const localeSegment = pathname.split('/')[1] ?? 'hu';
  const locale = resolveErrorLocale(localeSegment);

  return (
    <ErrorPage
      code={500}
      locale={locale}
      messages={getErrorMessages(locale)}
      showRefresh
      onRefresh={reset}
    />
  );
}