import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {ACCESS_COOKIE, AUTH_COOKIE_OPTIONS, MFA_COOKIE, REFRESH_COOKIE} from '@/lib/utils/constants';

type Tokens = {
  access_token?: string;
  refresh_token?: string;
  multi_factor_token?: string;
};

export async function setAuthCookies(tokens: Tokens) {
  const jar = await cookies();

  if (tokens.access_token) {
    jar.set(ACCESS_COOKIE, tokens.access_token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 60 * 60
    });
  }

  if (tokens.refresh_token) {
    jar.set(REFRESH_COOKIE, tokens.refresh_token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30
    });
  }

  if (tokens.multi_factor_token) {
    jar.set(MFA_COOKIE, tokens.multi_factor_token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 60 * 10
    });
  } else {
    jar.delete(MFA_COOKIE);
  }
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(MFA_COOKIE);
}

export function jsonWithStatus(payload: unknown, status: number) {
  return NextResponse.json(payload, {status});
}
