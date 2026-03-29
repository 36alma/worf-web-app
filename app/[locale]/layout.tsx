import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {Manrope, Sora} from 'next/font/google';
import {locales} from '@/i18n/config';
import AppProviders from '@/components/providers/AppProviders';
import AppShell from '@/components/layout/AppShell';

const bodyFont = Manrope({subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600', '700']});
const displayFont = Sora({subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700']});

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <div className={`${bodyFont.variable} ${displayFont.variable}`} lang={locale}>
      <NextIntlClientProvider locale={locale} messages={messages}>
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
