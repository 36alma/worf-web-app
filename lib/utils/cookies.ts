import {cookies} from 'next/headers';
import {ACCESS_COOKIE, REFRESH_COOKIE} from './constants';

export const getServerAccessToken = async () => (await cookies()).get(ACCESS_COOKIE)?.value;

export const getServerRefreshToken = async () => (await cookies()).get(REFRESH_COOKIE)?.value;
