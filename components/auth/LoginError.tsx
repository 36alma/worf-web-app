import {AlertTriangle} from 'lucide-react';
import {getTranslations} from 'next-intl/server';

const KNOWN_ERRORS = [
  'access_denied',
  'invalid_issuer',
  'invalid_state',
  'expired_request',
  'invalid_request',
  'token_exchange_failed',
  'temporarily_unavailable',
  'server_error'
] as const;

type KnownError = (typeof KNOWN_ERRORS)[number];

const isKnownError = (value: string): value is KnownError =>
  (KNOWN_ERRORS as readonly string[]).includes(value);

/**
 * Renders the error the OAuth routes hand back on the login redirect. Known
 * error codes get a translated message; anything else (an error_description
 * from the authorization server) is shown as-is.
 */
export default async function LoginError({error}: {error: string}) {
  const t = await getTranslations('auth');
  const message = isKnownError(error) ? t(`error_${error}`) : error;

  return (
    <div className="auth-error" role="alert">
      <AlertTriangle size={16} strokeWidth={1.75} />
      <div>
        <strong>{t('error_title')}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
