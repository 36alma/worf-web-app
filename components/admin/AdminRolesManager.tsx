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
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={rows} />
      <p className="text-xs text-slate-400">{t('roles_readonly_hint')}</p>
    </div>
  );
}
