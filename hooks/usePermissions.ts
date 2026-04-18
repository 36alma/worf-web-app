'use client';

import {useEffect, useState, useCallback, useMemo} from 'react';
import type {PermissionMap} from '@/lib/api/permissions';

// ─── Token / IP reading utilities ────────────────────────────────────
// Mirrors the exact same lookup logic used in worfCalendarClient.ts
// so every WORF call behaves identically.

const TOKEN_KEYS = ['worf_access_token', 'access_token', 'token'];
const FORWARDED_FOR_KEYS = ['worf_client_ip', 'client_ip', 'x_forwarded_for'];

const parseCookie = (key: string) => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : '';
};

const readClientToken = () => {
  if (typeof window === 'undefined') return '';

  for (const key of TOKEN_KEYS) {
    const v = window.sessionStorage.getItem(key);
    if (v?.trim()) return v.trim();
  }
  for (const key of TOKEN_KEYS) {
    const v = window.localStorage.getItem(key);
    if (v?.trim()) return v.trim();
  }
  for (const key of TOKEN_KEYS) {
    const v = parseCookie(key);
    if (v.trim()) return v.trim();
  }

  return '';
};

const readForwardedFor = () => {
  if (typeof window === 'undefined') return '127.0.0.1';

  for (const key of FORWARDED_FOR_KEYS) {
    const v = window.sessionStorage.getItem(key);
    if (v?.trim()) return v.trim();
  }
  for (const key of FORWARDED_FOR_KEYS) {
    const v = parseCookie(key);
    if (v.trim()) return v.trim();
  }
  if (window.location.hostname?.trim()) return window.location.hostname;

  return '127.0.0.1';
};

// ─── Payload normalisation ───────────────────────────────────────────

const parseJsonIfString = (payload: unknown): unknown => {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
};

const toBooleanPermissionValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    if (n === 'true' || n === '1') return true;
    if (n === 'false' || n === '0') return false;
  }
  return null;
};

/**
 * Walks through a possibly-nested API response and extracts the first
 * object whose keys look like permission names (contain dots) and whose
 * values are boolean-coercible.
 */
const extractPermissionMap = (payload: unknown): PermissionMap => {
  const queue: unknown[] = [parseJsonIfString(payload)];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((entry) => queue.push(parseJsonIfString(entry)));
      continue;
    }

    const record = current as Record<string, unknown>;
    const entries = Object.entries(record)
      .map(([key, v]) => {
        const bool = toBooleanPermissionValue(v);
        return bool === null ? null : ([key, bool] as const);
      })
      .filter((e): e is readonly [string, boolean] => e !== null);

    if (entries.length > 0 && entries.some(([k]) => k.includes('.'))) {
      return Object.fromEntries(entries);
    }

    Object.values(record).forEach((v) => queue.push(parseJsonIfString(v)));
  }

  return {};
};

// ─── Silent fetch wrapper ────────────────────────────────────────────

const silentFetch = async (
  path: string,
  body: Record<string, unknown>
): Promise<PermissionMap> => {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-forwarded-for': readForwardedFor(),
    };

    const response = await fetch(`/api/proxy${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      // Silent Policy: non-OK → empty permissions, no UI error.
      return {};
    }

    const text = await response.text();
    if (!text.trim()) return {};

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {};
    }

    return extractPermissionMap(parsed);
  } catch {
    // Silent Policy: network error → empty permissions, no UI error.
    return {};
  }
};

// ─── Hook state ──────────────────────────────────────────────────────

interface UsePermissionsOptions {
  /** If provided, group-level permissions are fetched for this group. */
  groupId?: string;
  /** Set to false to skip fetching entirely (e.g. on auth pages). */
  enabled?: boolean;
}

interface UsePermissionsReturn {
  /** True while either permission request is in flight. */
  isLoadingPermissions: boolean;
  /** Raw global permission map. */
  globalPermissions: PermissionMap;
  /** Raw group permission map (empty when no groupId). */
  groupPermissions: PermissionMap;
  /** Check a single global permission name. */
  hasGlobalPermission: (permissionName: string) => boolean;
  /** Check a single group permission name. */
  hasGroupPermission: (permissionName: string) => boolean;
}

// ─── The hook ────────────────────────────────────────────────────────

/**
 * Universal permission hook for the WORF frontend.
 *
 * ## Features
 * - Fetches global (`/v1/user/permission`) and group (`/v1/group/permission`)
 *   permissions in parallel.
 * - Bearer token goes in the **JSON body**, not in the Authorization header.
 * - `x-forwarded-for` header is attached to every call.
 * - **Silent Policy**: on any error (401, 403, network) the hook returns
 *   empty permission maps — every check returns `false`. No toasts, no UI
 *   error messages.
 * - Exposes `isLoadingPermissions` so consumers can show a Skeleton loader
 *   instead of flashing a "no permission" state.
 *
 * ## Usage
 * ```tsx
 * const { hasGroupPermission, isLoadingPermissions } = usePermissions({ groupId });
 *
 * if (isLoadingPermissions) return <Skeleton />;
 *
 * return (
 *   <>
 *     {hasGroupPermission('group.calendar.event.write') && <Button>Létrehozás</Button>}
 *   </>
 * );
 * ```
 */
export function usePermissions({
  groupId,
  enabled = true,
}: UsePermissionsOptions = {}): UsePermissionsReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [globalPermissions, setGlobalPermissions] = useState<PermissionMap>({});
  const [groupPermissions, setGroupPermissions] = useState<PermissionMap>({});

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setGlobalPermissions({});
      setGroupPermissions({});
      return;
    }

    let mounted = true;
    setIsLoading(true);

    const load = async () => {
      const token = readClientToken();

      // Build the list of fetches to run in parallel
      const globalFetch = silentFetch('/v1/user/permission', {
        Bearer: token,
      });

      const groupFetch = groupId
        ? silentFetch('/v1/group/permission', {
            Bearer: token,
            group_id: groupId,
          })
        : Promise.resolve({} as PermissionMap);

      const [globalResult, groupResult] = await Promise.all([
        globalFetch,
        groupFetch,
      ]);

      if (!mounted) return;

      setGlobalPermissions(globalResult);
      setGroupPermissions(groupResult);
      setIsLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [enabled, groupId]);

  const hasGlobalPermission = useCallback(
    (permissionName: string): boolean =>
      globalPermissions[permissionName] === true,
    [globalPermissions]
  );

  const hasGroupPermission = useCallback(
    (permissionName: string): boolean =>
      groupPermissions[permissionName] === true,
    [groupPermissions]
  );

  return useMemo(
    () => ({
      isLoadingPermissions: isLoading,
      globalPermissions,
      groupPermissions,
      hasGlobalPermission,
      hasGroupPermission,
    }),
    [isLoading, globalPermissions, groupPermissions, hasGlobalPermission, hasGroupPermission]
  );
}
