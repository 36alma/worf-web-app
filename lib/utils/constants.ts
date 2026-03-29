export const ACCESS_COOKIE = 'worf_access_token';
export const REFRESH_COOKIE = 'worf_refresh_token';
export const MFA_COOKIE = 'worf_mfa_token';

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/'
};

export const WORF_DEVICE_TYPE = process.env.WORF_DEVICE_TYPE ?? 'web';
