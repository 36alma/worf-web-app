import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {Inter, JetBrains_Mono} from 'next/font/google';
import {locales} from '@/i18n/config';
import AppProviders from '@/components/providers/AppProviders';
import AppShell from '@/components/layout/AppShell';

const bodyFont = Inter({subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600']});
const monoFont = JetBrains_Mono({subsets: ['latin'], variable: '--font-mono', weight: ['400', '500']});

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
    <div className={`${bodyFont.variable} ${monoFont.variable}`} lang={locale}>
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
