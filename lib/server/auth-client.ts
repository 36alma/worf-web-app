type GrantType = 'password' | 'refresh_token';

export const MISSING_AUTH_CLIENT_MESSAGE = 'WORF_CLIENT_ID and WORF_CLIENT_SECRET are required';

export const getAuthClientPayload = (grantType: GrantType = 'password') => {
  const clientId = process.env.WORF_CLIENT_ID;
  const clientSecret = process.env.WORF_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    grant_type: grantType,
    client_id: clientId,
    client_secret: clientSecret
  };
};
