import createMiddleware from 'next-intl/middleware';
import {NextRequest, NextResponse} from 'next/server';
import {defaultLocale, locales, publicAuthRoutes} from './i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const intlResponse = intlMiddleware(request);
  const [, locale, ...rest] = pathname.split('/');

  if (!locales.includes(locale as (typeof locales)[number])) {
    return intlResponse;
  }

  const localPath = `/${rest.join('/')}`.replace(/\/$/, '') || '/';
  const isPublic = publicAuthRoutes.some((route) => localPath.startsWith(route));
  const hasToken = Boolean(request.cookies.get('worf_access_token')?.value);

  if (!isPublic && !hasToken) {
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && hasToken && (localPath === '/auth/login' || localPath === '/auth/register')) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)']
};
