import {cookies} from 'next/headers';
import ErrorPage from '@/components/error/ErrorPage';
import {getErrorMessages, resolveErrorLocale} from '@/lib/i18n/errorMessages';

export default async function NotFound() {
  const locale = resolveErrorLocale((await cookies()).get('NEXT_LOCALE')?.value);
  return <ErrorPage code={404} locale={locale} messages={getErrorMessages(locale)} />;
}