import apiClient from './client';

export const getAdminUsers = (limit = 100) =>
  apiClient.get('/v1/user/prealluser', {
    params: {limit}
  });

export const getAdminUserProfile = (user_id: string) =>
  apiClient.get('/v1/user/admin/editprofile', {
    params: {user_id}
  });

export const updateAdminUserProfile = (data: {
  user_id: string;
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
  is_active?: boolean | null;
  email_verified?: boolean | null;
  is_2fa_enable?: boolean | null;
  role_id?: string | null;
  password?: string | null;
}) => apiClient.post('/v1/user/admin/editprofile', data);

export const getAllSystemRoles = () => apiClient.get('/v1/role/allroles');
