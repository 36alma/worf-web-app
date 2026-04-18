'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export type PermissionMap = Record<string, boolean>;

interface GroupPermissionContextValue {
  /** The clean, decoded group ID (original encrypted format with `=`). */
  groupId: string;
  /** True while the permission request is in flight. */
  isLoading: boolean;
  /** Raw group permission map. */
  permissions: PermissionMap;
  /** Check a single group permission by name. */
  hasPermission: (name: string) => boolean;
}

const GroupPermissionContext = createContext<GroupPermissionContextValue>({
  groupId: '',
  isLoading: true,
  permissions: {},
  hasPermission: () => false,
});

// ─── Token / IP utilities ────────────────────────────────────────────
// Mirrors worfCalendarClient.ts so every WORF call behaves identically.

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

// ─── Permission payload parsing ──────────────────────────────────────

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

const parseJsonIfString = (payload: unknown): unknown => {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
};

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

// ─── Silent fetch ────────────────────────────────────────────────────

const silentFetchPermissions = async (groupId: string): Promise<PermissionMap> => {
  try {
    const token = readClientToken();

    const response = await fetch('/api/proxy/v1/group/permission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': readForwardedFor(),
      },
      body: JSON.stringify({
        Bearer: token,
        group_id: groupId,
      }),
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      // Silent Policy: non-OK → empty permissions.
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
    // Silent Policy: network error → empty permissions.
    return {};
  }
};

// ─── Provider ────────────────────────────────────────────────────────

interface GroupPermissionProviderProps {
  groupId: string;
  children: ReactNode;
}

export function GroupPermissionProvider({groupId, children}: GroupPermissionProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionMap>({});

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setPermissions({});

    if (!groupId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      const result = await silentFetchPermissions(groupId);
      if (!mounted) return;
      setPermissions(result);
      setIsLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  const value = useMemo<GroupPermissionContextValue>(
    () => ({
      groupId,
      isLoading,
      permissions,
      hasPermission: (name: string) => permissions[name] === true,
    }),
    [groupId, isLoading, permissions]
  );

  return (
    <GroupPermissionContext.Provider value={value}>
      {children}
    </GroupPermissionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useGroupPermission() {
  return useContext(GroupPermissionContext);
}
