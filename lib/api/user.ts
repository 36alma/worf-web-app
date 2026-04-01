import apiClient from './client';

export const getCurrentUserProfile = () => apiClient.get('/v1/user/editprofile');

export const updateCurrentUserProfile = (payload: {
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
  newpassword?: string | null;
  newpassword_rep?: string | null;
}) => apiClient.post('/v1/user/editprofile', payload);
