import {isCommandName, listPaletteCommands, type PaletteCommand} from '@/lib/api/palette';

interface Entry {
  promise: Promise<PaletteCommand[]>;
  at: number;
  failed: boolean;
}

const entries = new Map<string, Entry>();
const loggedFailures = new Set<string>();

// Editors mounted together (one per agenda item, strict-mode remounts) share one request.
const FRESH_MS = 5000;

/**
 * Permission-filtered `/` catalog for a group. Concurrent and near-simultaneous callers share a single
 * request (failures included, so a 4xx is not hammered); a later editor open, group change or `force`
 * reload (action 403) fetches again, so a fixed backend is picked up without a stale cached error.
 */
export function loadPaletteCatalog(groupId: string, force = false): Promise<PaletteCommand[]> {
  const existing = entries.get(groupId);
  // A failure is shared only within the same window (simultaneous mounts); the next editor open retries.
  if (existing && !force && Date.now() - existing.at < FRESH_MS) return existing.promise;

  const entry: Entry = {at: Date.now(), failed: false, promise: Promise.resolve([])};
  entry.promise = listPaletteCommands(groupId)
    .then(({data}) => {
      loggedFailures.delete(groupId);
      // Only the new-style catalog counts: known names with an `actions` list.
      return (data?.commands ?? []).filter(
        (c) => isCommandName(c.name) && Array.isArray(c.actions) && c.actions.length > 0
      );
    })
    .catch((error) => {
      entry.failed = true;
      const status = (error as {response?: {status?: number}})?.response?.status;
      // 403 = not a group member (normal, no menu); anything else is worth one log line.
      if (status !== 403 && !loggedFailures.has(groupId)) {
        loggedFailures.add(groupId);
        console.error('palette/list-commands failed', status ?? error);
      }
      return [] as PaletteCommand[];
    });
  entries.set(groupId, entry);
  return entry.promise;
}
