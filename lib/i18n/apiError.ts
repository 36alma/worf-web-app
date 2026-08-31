type MinimalTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has: (key: string) => boolean;
};

/**
 * Maps an axios error to a translated message. Status 409 is special-cased
 * per the backend spec (§1.5/§9.4): conflict messages are backend-authored
 * business-rule text ("Cannot move a folder into itself...", "...already
 * shared...") that is more useful shown verbatim than replaced by a generic
 * string — this mirrors the project's existing, documented acceptance of
 * untranslated backend error text (see FRONTEND.md §13).
 */
export function translateApiError(t: MinimalTranslator, error: unknown, fallbackKey: string): string {
  const response = (error as {response?: {status?: number; data?: {detail?: string}}} | undefined)?.response;
  const status = response?.status;

  if (status === 409 && response?.data?.detail) {
    return response.data.detail;
  }

  if (status && t.has(`errors.api.${status}`)) {
    return t(`errors.api.${status}`);
  }

  return t(fallbackKey);
}
