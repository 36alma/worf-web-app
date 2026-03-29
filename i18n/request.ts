import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {defaultLocale, locales} from './config';

export default getRequestConfig(async (params) => {
  console.log('GET_REQUEST_CONFIG_PARAMS:', Object.keys(params), params);
  const locale = (params as any).locale ?? (await (params as any).requestLocale);
  const resolvedLocale = locale ?? defaultLocale;

  if (!locales.includes(resolvedLocale as (typeof locales)[number])) {
    notFound();
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default
  };
});
