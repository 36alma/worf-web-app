/**
 * There is no backend "my-capabilities" endpoint for files/folders (see
 * spec §1.4/§9.3): action buttons are shown optimistically and, on a 403
 * response, the specific (scope, action, id) combination is remembered for
 * the rest of the browser session so the UI stops offering — and the user
 * stops re-triggering — an action the backend has already refused.
 */
type EntryScope = 'file' | 'folder';

const forbiddenActions = new Set<string>();

const key = (scope: EntryScope, action: string, id: string) => `${scope}:${action}:${id}`;

export function markForbidden(scope: EntryScope, action: string, id: string): void {
  forbiddenActions.add(key(scope, action, id));
}

export function isForbidden(scope: EntryScope, action: string, id: string): boolean {
  return forbiddenActions.has(key(scope, action, id));
}

export function resetForbiddenCache(): void {
  forbiddenActions.clear();
}

export interface ShareFlagSet {
  can_view?: boolean;
  can_download?: boolean;
  can_upload?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_share?: boolean;
}

/**
 * Client-side mirror of the backend's anti-escalation rule (spec §1.4/§6):
 * a sharer can only grant flags they themselves hold. The backend is the
 * real enforcement point — this only drives which checkboxes the share UI
 * disables so a doomed request isn't attempted in the first place.
 */
export function canGrantShareFlags(myFlags: ShareFlagSet, requestedFlags: ShareFlagSet): boolean {
  return (Object.keys(requestedFlags) as Array<keyof ShareFlagSet>).every((flag) => {
    if (!requestedFlags[flag]) return true;
    return myFlags[flag] === true;
  });
}
