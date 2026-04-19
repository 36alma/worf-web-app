import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {locales, type Locale} from '@/i18n/config';
import AppProviders from '@/components/providers/AppProviders';
import AppShell from '@/components/layout/AppShell';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!locales.includes(locale as Locale)) {
    notFound();
  }
  const resolvedLocale = locale as Locale;

  const messages = await getMessages();

  return (
    <div lang={resolvedLocale}>
      <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </NextIntlClientProvider>
    </div>
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({locale}));
}
