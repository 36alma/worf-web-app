import apiClient from './client';

// GET: Fetch all users with optional filtering by user_id
// Per API docs, uses GET with body parameters (UserPre model)
export const getAdminUsers = async (user_id?: string) => {
  const body: {user_id?: string; limit?: number} = {
    limit: 1000 // Get all users
  };
  
  if (user_id) {
    body.user_id = user_id;
  }
  
  try {
    const response = await apiClient.get('/v1/user/prealluser', { params: body });
    const data = response.data;
    
    // Handle response wrapper if present (API returns { message: [...] })
    if (data?.message) {
      if (Array.isArray(data.message)) {
        return data.message;
      }
      if (data.message.users && Array.isArray(data.message.users)) {
        return data.message.users;
      }
    }
    
    // Return response data if wrapped in data property
    if (data && !data?.message) {
      if (Array.isArray(data)) {
        return data;
      }
      if (data.users && Array.isArray(data.users)) {
        return data.users;
      }
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

// GET: Fetch user profile for editing
// Per API docs, GET accepts user_id as query param
export const getAdminUserProfile = async (user_id: string) => {
  try {
    const response = await apiClient.get('/v1/user/admin/editprofile', {
      params: { user_id }
    });
    const data = response.data;
    
    // Handle response wrapper if present (API returns { message: {...userData} })
    if (data?.message && typeof data.message === 'object') {
      return data.message;
    }
    
    // Return response data if wrapped in data property
    if (data) {
      return data;
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

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

export const deleteAdminUser = (user_id: string) =>
  apiClient.post('/v1/user/admin/delete', { user_id });

export const getAllSystemRoles = () => apiClient.get('/v1/role/allroles');

export const getAdminGroupMembers = (group_id: string) =>
  apiClient.post('/v1/group/admin/getusers', {group_id});

export const getAdminUsersNotInGroup = async (data: {
  group_id: string;
  page_number?: number;
  load_user_number?: number;
}) => {
  const response = await apiClient.post('/v1/group/admin/getusers/notingroup', data);
  
  // Handle response wrapper if present
  if (response?.data) {
    return response.data;
  }
  
  // Return raw response if it already contains the paginated data
  return response;
};
