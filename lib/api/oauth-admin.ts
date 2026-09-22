import apiClient from './client';

export interface OAuthClientAdminEntry {
  client_id: string;
  name: string;
  client_type: string | null;
  token_endpoint_auth_method: string | null;
  grant_types: string[];
  scopes: string[];
  redirect_uris: string[];
  revoked: boolean;
  is_dynamically_registered: boolean;
  created_at: string | null;
  client_id_issued_at: number | null;
}

export interface OAuthClientListResponse {
  items: OAuthClientAdminEntry[];
  total: number;
  offset: number;
  limit: number;
}

export const listOAuthClients = async (
  offset: number,
  limit: number,
  includeRevoked: boolean
): Promise<OAuthClientListResponse> => {
  const response = await apiClient.get('/v1/oauth/admin/clients', {
    params: { offset, limit, include_revoked: includeRevoked }
  });
  return response.data;
};

export const revokeOAuthClient = (client_id: string) =>
  apiClient.post('/v1/oauth/admin/clients/revoke', { client_id });

export const denyCimdClient = (client_id_url: string) =>
  apiClient.post('/v1/oauth/admin/cimd-clients/deny', { client_id_url });

export const undenyCimdClient = (client_id_url: string) =>
  apiClient.post('/v1/oauth/admin/cimd-clients/undeny', { client_id_url });
