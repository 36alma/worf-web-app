import {cookies} from 'next/headers';
import {ACCESS_COOKIE, REFRESH_COOKIE} from './constants';

export const getServerAccessToken = () => cookies().get(ACCESS_COOKIE)?.value;

export const getServerRefreshToken = () => cookies().get(REFRESH_COOKIE)?.value;
