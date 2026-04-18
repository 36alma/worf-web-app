import ErrorPage from '@/components/error/ErrorPage';
import {getErrorMessages, resolveErrorLocale} from '@/lib/i18n/errorMessages';

export default async function LocaleNotFound({
  params
}: {
  params?: Promise<{locale?: string}>;
}) {
  try {
    const locale = (await params)?.locale;
    const normalized = resolveErrorLocale(locale);
    return <ErrorPage code={404} locale={normalized} messages={getErrorMessages(normalized)} />;
  } catch {
    // Fallback if params cannot be accessed
    const normalized = resolveErrorLocale(undefined);
    return <ErrorPage code={404} locale={normalized} messages={getErrorMessages(normalized)} />;
  }
}
