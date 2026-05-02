'use client';

import {useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {useTranslations} from 'next-intl';
import {getAllSystemRoles} from '@/lib/api/admin';
import DataTable from '@/components/ui/DataTable';
import Skeleton from '@/components/ui/Skeleton';

type RawObject = Record<string, unknown>;

interface RoleRow {
  id: string;
  name: string;
  description: string;
}

const readData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const candidate = payload as RawObject;
  if ('data' in candidate) {
    return candidate.data;
  }

  return payload;
};

const toRoleRows = (payload: unknown): RoleRow[] => {
  const source = readData(payload);
  const arrayValue = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['roles', 'items', 'rows', 'result']
          .map((key) => (source as RawObject)[key])
          .find((value) => Array.isArray(value))
      : null;

  if (!Array.isArray(arrayValue)) {
    return [];
  }

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const id = String(row.role_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.name ?? row.role_name ?? id),
        description: String(row.description ?? row.role_description ?? '')
      };
    })
    .filter((row): row is RoleRow => Boolean(row));
};

export default function AdminRolesManager() {
  const t = useTranslations('admin');
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await getAllSystemRoles();
        if (mounted) {
          setRows(toRoleRows(response.data));
        }
      } catch {
        if (mounted) {
          toast.error(t('load_error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [t]);

  const columns = useMemo(
    () => [
      {key: 'name' as const, label: t('columns.role')},
      {key: 'description' as const, label: t('columns.description')},
      {key: 'id' as const, label: t('columns.id')}
    ],
    [t]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="hidden lg:block space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="lg:hidden space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Desktop: DataTable ── */}
      <div className="hidden lg:block">
        <DataTable columns={columns} rows={rows} />
      </div>

      {/* ── Mobile/Tablet: Card list ── */}
      <div className="lg:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">—</p>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-hover)]"
            >
              <div className="flex items-start gap-3">
                {/* Role icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--badge-blue-bg)] text-sm font-bold text-[var(--badge-blue-text)]">
                  {row.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {row.name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {row.description || '—'}
                  </p>
                </div>
              </div>

              {/* ID row */}
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--badge-gray-bg)] px-2 py-0.5 text-[11px] font-mono text-[var(--badge-gray-text)]">
                  ID: {row.id.length > 16 ? `${row.id.slice(0, 16)}…` : row.id}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-slate-400">{t('roles_readonly_hint')}</p>
    </div>
  );
}
