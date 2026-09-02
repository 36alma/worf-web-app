export const locales = ['hu', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale =
  (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale) || 'hu';

// Despite the name (kept to avoid a wider rename), this list also gates
// proxy.ts's auth redirect for the one other route that must be reachable
// by a logged-out visitor: the public share-link landing page
// (app/[locale]/shared/[token]/page.tsx). Without '/shared/' here, an
// anonymous share-link recipient hitting /{locale}/shared/{token} would be
// redirected straight to /auth/login by proxy.ts's `!isPublic && !hasToken`
// check before the page ever renders — defeating the entire point of an
// unauthenticated, public-facing share link. Trailing slash matches only
// the real route (which always has a required [token] segment after
// "shared"), not a hypothetical unrelated future route that merely starts
// with the same letters.
export const publicAuthRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/mfa',
  '/shared/'
] as const;
