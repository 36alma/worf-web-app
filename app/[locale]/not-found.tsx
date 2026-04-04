import ErrorPage from '@/components/error/ErrorPage';
import {getErrorMessages, resolveErrorLocale} from '@/lib/i18n/errorMessages';

export default async function LocaleNotFound({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const normalized = resolveErrorLocale(locale);

  return <ErrorPage code={404} locale={normalized} messages={getErrorMessages(normalized)} />;
}
