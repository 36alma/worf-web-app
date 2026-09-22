import {useTranslations} from 'next-intl';

export type MinutesTranslations = ReturnType<typeof useTranslations<'group_minutes'>>;

/**
 * `t` is expected to already be scoped to the `group_minutes` namespace
 * (e.g. `useTranslations('group_minutes')`), mirroring lib/i18n/tasks.ts's
 * `TaskTranslations` convention — keys below are relative, not prefixed.
 */
export function translateMinutesStatus(t: MinutesTranslations, status: string): string {
  const key = `status_enum.${status}`;
  return t.has(key as any) ? t(key as any) : status;
}

export function translateParticipantRole(t: MinutesTranslations, role: string): string {
  const key = `role_enum.${role}`;
  return t.has(key as any) ? t(key as any) : role;
}

/**
 * The stable, machine-readable `detail` codes the minutes service answers 422 with.
 * Everything else stays a generic `Validation failed.` — there the status code and the UI's own state decide.
 */
export const MINUTES_ERROR_CODES = [
  'minute_taker_required',
  'minute_taker_not_eligible',
  'minute_taker_is_witness',
  'witness_required',
  'witness_requires_registered_user',
  'witness_not_eligible',
  'witness_is_minute_taker',
  'recall_invalid_state',
  'restore_not_archived',
  'restore_version_in_progress',
  'archive_invalid_state',
  'not_archived',
  'archived_read_only',
  'delete_invalid_state',
  'trash_restore_expired',
  'tag_invalid',
  'tag_limit_reached'
] as const;

export type MinutesErrorCode = (typeof MINUTES_ERROR_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set<string>(MINUTES_ERROR_CODES);

/** The `detail` of a FastAPI validation error — a list, not a string. */
interface ValidationDetailItem {
  loc?: unknown;
  msg?: unknown;
  type?: unknown;
}

function responseDetail(error: unknown): unknown {
  return (error as {response?: {data?: {detail?: unknown}}} | undefined)?.response?.data?.detail;
}

/**
 * A raw `minutes.*` code (`minutes.witness_not_eligible`) as one of the known {@link MinutesErrorCode}s
 * (`witness_not_eligible`); `null` for anything else. Also fits `eligibility_issue` and `warnings[].code`.
 */
export function parseMinutesCode(raw: unknown): MinutesErrorCode | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const code = trimmed.startsWith('minutes.') ? trimmed.slice('minutes.'.length) : '';
  return CODE_SET.has(code) ? (code as MinutesErrorCode) : null;
}

/**
 * The `minutes.*` code out of a 422, without the prefix (`minutes.witness_not_eligible` → `witness_not_eligible`).
 * `detail` is a string for most rules and an object (`{code, issues}`) for a finalize refused over its witnesses;
 * a FastAPI validation list means a missing/ill-typed body field instead (see {@link hasMissingField}), and
 * anything unknown yields `null`.
 */
export function extractMinutesErrorCode(error: unknown): MinutesErrorCode | null {
  const detail = responseDetail(error);
  if (typeof detail === 'string') return parseMinutesCode(detail);
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return parseMinutesCode((detail as {code?: unknown}).code);
  }
  return null;
}

/** One witness a finalize was refused over: `participant_id` is `get`'s `participants[].id`. */
export interface MinutesIssue {
  participantId: string;
  /** `null` for a code this client does not know (a newer server). */
  code: MinutesErrorCode | null;
}

/**
 * The per-witness `issues[]` of an object `detail` — every witness that broke a rule, so the UI can mark them
 * exactly instead of guessing. Empty for a string / list detail.
 */
export function extractMinutesErrorIssues(error: unknown): MinutesIssue[] {
  const detail = responseDetail(error);
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return [];
  const issues = (detail as {issues?: unknown}).issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((item): MinutesIssue[] => {
    const raw = item as {participant_id?: unknown; code?: unknown} | null;
    const participantId = typeof raw?.participant_id === 'string' ? raw.participant_id : '';
    return participantId ? [{participantId, code: parseMinutesCode(raw?.code)}] : [];
  });
}

/** True when the 422 is a FastAPI validation list that names `field` (e.g. a missing `minute_taker_id`). */
export function hasMissingField(error: unknown, field: string): boolean {
  const detail = responseDetail(error);
  if (!Array.isArray(detail)) return false;
  return (detail as ValidationDetailItem[]).some(
    (item) => Array.isArray(item?.loc) && (item.loc as unknown[]).some((part) => part === field)
  );
}

/** The user-facing text of a `minutes.*` code, or `null` when the key is not translated. */
export function translateMinutesErrorCode(t: MinutesTranslations, code: MinutesErrorCode | null): string | null {
  if (!code) return null;
  const key = `errors.code.${code}`;
  return t.has(key as any) ? t(key as any) : null;
}

/**
 * The message to show for a failed minutes call. Most specific first:
 * a stable `minutes.*` code → a missing mandatory body field → the HTTP status → the caller's fallback.
 */
export function translateMinutesApiError(
  t: MinutesTranslations,
  error: unknown,
  fallbackKey: Parameters<MinutesTranslations>[0]
): string {
  const byCode = translateMinutesErrorCode(t, extractMinutesErrorCode(error));
  if (byCode) return byCode;

  // `create` / `import/confirm` without a minute taker: FastAPI answers with a validation list, not a code.
  if (hasMissingField(error, 'minute_taker_id')) {
    const key = 'errors.code.minute_taker_required';
    if (t.has(key as any)) return t(key as any);
  }

  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  const key = status ? `errors.api.${status}` : null;
  if (key && t.has(key as any)) {
    return t(key as any);
  }
  return t(fallbackKey);
}
