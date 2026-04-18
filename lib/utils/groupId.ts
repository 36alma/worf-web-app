/**
 * Normalise a group_id value so it is always in its raw, decoded form.
 *
 * group_id is an opaque Base64 string – NOT a URL.  It must never be
 * stored or compared in percent-encoded form (e.g. `%3D` instead of `=`).
 *
 * This helper:
 * 1. URL-decodes the value (recovers `=` from `%3D`).
 * 2. Strips known Next.js route segment names that may get incorrectly
 *    appended to the ID due to Base64 padding (`=`) confusing the URL
 *    parser (e.g. `...AJ4=calendar` → `...AJ4=`).
 * 3. Falls back to the original value on invalid percent-encoding.
 *
 * Usage:
 *   const safeId = normalizeGroupId(params.groupId);
 */
export type GroupId = string;

/**
 * Known child route segment names under /groups/[groupId]/...
 * If the URL parser merges a segment name into the groupId param,
 * we strip it here.
 */
const KNOWN_ROUTE_SEGMENTS = [
  'calendar',
  'tasks',
  'posts',
  'members',
  'roles',
  'permissions',
  'settings',
] as const;

/**
 * Pre-compiled regex that matches any known route segment name stuck
 * to the end of a group_id value (with or without a leading `/`).
 *
 * Examples it matches:
 *   "...AJ4=calendar"   → strips "calendar"
 *   "...AJ4=/calendar"  → strips "/calendar"
 */
const TRAILING_SEGMENT_RE = new RegExp(
  `[/]?(${KNOWN_ROUTE_SEGMENTS.join('|')})$`,
  'i'
);

export const normalizeGroupId = (value: string | null | undefined): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // If the value contains an invalid percent-encoding sequence, use as-is.
    decoded = trimmed;
  }

  // Strip trailing route segment names that may have been merged into the ID
  const cleaned = decoded.replace(TRAILING_SEGMENT_RE, '');

  // Remove any trailing slash that might remain
  return cleaned.replace(/\/+$/, '');
};
