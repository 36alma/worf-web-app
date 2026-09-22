import {MINUTES_TAG_MAX_LENGTH, MINUTES_TAGS_PER_MINUTES} from './types';

/** The server's normalisation: trimmed, inner whitespace runs collapsed to one space. */
export function normalizeTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Case-insensitive identity of a tag (`"Pénzügy"` and `"pénzügy"` are the same tag). */
export function tagKey(tag: string): string {
  return normalizeTag(tag).toLowerCase();
}

export type TagProblem = 'invalid' | 'limit';

/**
 * What the input box hands over (`"a, b ,,c"`): comma / semicolon separated, normalised, blanks dropped, duplicates
 * (also of `existing`) removed. First spelling wins, like on the server.
 */
export function parseTagInput(raw: string, existing: readonly string[] = []): string[] {
  const seen = new Set(existing.map(tagKey));
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tagKey(tag))) continue;
    seen.add(tagKey(tag));
    out.push(tag);
  }
  return out;
}

/** `null` when the tag would be accepted (non-empty, ≤ 50 chars, no control characters). */
export function validateTag(tag: string): 'invalid' | null {
  if (!tag || tag.length > MINUTES_TAG_MAX_LENGTH || tag.toLowerCase().length > MINUTES_TAG_MAX_LENGTH) return 'invalid';
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f-\u009f]/.test(tag) ? 'invalid' : null;
}

/** Why `additions` cannot be added on top of `existing`, or `null` when the whole request would go through. */
export function checkTagAdditions(existing: readonly string[], additions: readonly string[]): TagProblem | null {
  if (additions.some((tag) => validateTag(tag))) return 'invalid';
  return existing.length + additions.length > MINUTES_TAGS_PER_MINUTES ? 'limit' : null;
}

/** Tags in the UI language's alphabetical order — the server sorts by code point, which is wrong for Hungarian. */
export function sortTags(tags: readonly string[], locale: string): string[] {
  return [...tags].sort((a, b) => a.localeCompare(b, locale, {sensitivity: 'base'}));
}
