import {cookies} from 'next/headers';
import {ACCESS_COOKIE, AUTH_ORIGIN_COOKIE, MFA_COOKIE, REFRESH_COOKIE} from './constants';

export const getServerAccessToken = async () => (await cookies()).get(ACCESS_COOKIE)?.value;

export const getServerRefreshToken = async () => (await cookies()).get(REFRESH_COOKIE)?.value;

export const getServerMfaToken = async () => (await cookies()).get(MFA_COOKIE)?.value;

export const getServerAuthOrigin = async () => (await cookies()).get(AUTH_ORIGIN_COOKIE)?.value;
