import axios from 'axios';

export const register = (data: {fullname: string; email: string; password: string}) =>
  axios.post('/api/auth/register', data, {withCredentials: true});

export const verifyMfa = (data: {
  multi_factor_type: 'totp' | 'email';
  totp_number?: string;
  email_code?: string;
}) => axios.post('/api/auth/mfa', data, {withCredentials: true});

export const forgetPassword = (data: {email: string}) =>
  axios.post('/api/auth/forget-password', data, {withCredentials: true});

export const resetPassword = (data: {
  reset_token: string;
  newpassword: string;
  newpassword_rep: string;
}) => axios.post('/api/auth/reset-password', data, {withCredentials: true});

export const verifyEmail = (token: string) =>
  axios.post('/api/auth/verify-email', {token}, {withCredentials: true});

export const sendEmailVerification = () =>
  axios.post('/api/auth/send-verification', {}, {withCredentials: true});

export const logout = () => axios.post('/api/auth/logout', {}, {withCredentials: true});
