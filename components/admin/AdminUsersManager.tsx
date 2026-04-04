'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { AxiosError } from 'axios';
import { getAdminUserProfile, getAdminUsers, getAllSystemRoles, updateAdminUserProfile } from '@/lib/api/admin';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';

type RawObject = Record<string, unknown>;

interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean | null;
  email_verified: boolean | null;
  role_id: string;
}

interface RoleItem {
  id: string;
  name: string;
}

interface EditFormState {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  role_id: string;
  is_active: boolean;
  email_verified: boolean;
  is_2fa_enable: boolean;
  password: string;
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

const toUserRows = (payload: unknown): AdminUserRow[] => {
  const source = readData(payload);
  const arrayValue = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['users', 'items', 'rows', 'result']
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
      const id = String(row.user_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        username: String(row.username ?? ''),
        email: String(row.email ?? ''),
        full_name: String(row.full_name ?? row.fullname ?? ''),
        is_active: typeof row.is_active === 'boolean' ? row.is_active : null,
        email_verified: typeof row.email_verified === 'boolean' ? row.email_verified : null,
        role_id: String(row.role_id ?? '')
      };
    })
    .filter((row): row is AdminUserRow => Boolean(row));
};

const toRoles = (payload: unknown): RoleItem[] => {
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

      const role = item as RawObject;
      const id = String(role.role_id ?? role.id ?? '');
      if (!id) {
        return null;
      }

      return { id, name: String(role.name ?? role.role_name ?? id) };
    })
    .filter((item): item is RoleItem => Boolean(item));
};

const toProfile = (payload: unknown, fallback: AdminUserRow): EditFormState => {
  const source = readData(payload);
  const objectValue = source && typeof source === 'object' ? (source as RawObject) : {};

  return {
    user_id: fallback.id,
    username: String(objectValue.username ?? fallback.username ?? ''),
    email: String(objectValue.email ?? fallback.email ?? ''),
    full_name: String(objectValue.full_name ?? objectValue.fullname ?? fallback.full_name ?? ''),
    role_id: String(objectValue.role_id ?? fallback.role_id ?? ''),
    is_active: Boolean(objectValue.is_active ?? fallback.is_active ?? true),
    email_verified: Boolean(objectValue.email_verified ?? fallback.email_verified ?? false),
    is_2fa_enable: Boolean(objectValue.is_2fa_enable ?? false),
    password: ''
  };
};

const getApiErrorMessage = (error: unknown): string | null => {
  const axiosError = error as AxiosError<{ detail?: Array<{ msg?: string }>; message?: string }>;
  const detail = axiosError?.response?.data?.detail;

  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item?.msg).filter(Boolean).join(', ');
  }

  if (typeof axiosError?.response?.data?.message === 'string') {
    return axiosError.response.data.message;
  }

  return null;
};

export default function AdminUsersManager() {
  const t = useTranslations('admin');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditFormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([getAdminUsers(), getAllSystemRoles()]);
      setRows(toUserRows(usersRes.data));
      setRoles(toRoles(rolesRes.data));
    } catch {
      toast.error(t('load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () => [
      { key: 'username' as const, label: t('columns.username') },
      { key: 'email' as const, label: t('columns.email') },
      { key: 'full_name' as const, label: t('columns.full_name') },
      {
        key: 'is_active' as const,
        label: t('columns.active'),
        render: (value: any) => (value === null ? '-' : value ? t('yes') : t('no'))
      },
      {
        key: 'id' as const,
        label: t('columns.actions'),
        render: (value: any, row: AdminUserRow) => (
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                const detailRes = await getAdminUserProfile(row.id);
                setForm(toProfile(detailRes.data, row));
                setOpenEdit(true);
              } catch {
                toast.error(t('load_error'));
              }
            }}
          >
            {t('edit')}
          </Button>
        )
      }
    ],
    [t]
  );

  const onSave = async () => {
    if (!form) {
      return;
    }

    if (!form.user_id) {
      toast.error(t('save_error'));
      return;
    }

    try {
      setSaving(true);

      await updateAdminUserProfile({
        user_id: form.user_id,
        username: form.username || null,
        email: form.email || null,
        full_name: form.full_name || null,
        role_id: form.role_id || null,
        is_active: form.is_active,
        email_verified: form.email_verified,
        is_2fa_enable: form.is_2fa_enable,
        password: form.password || null
      });

      toast.success(t('save_success'));
      setOpenEdit(false);
      setForm(null);
      await load();
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message ? `${t('save_error')} (${message})` : t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={rows} />

      <Modal open={openEdit && Boolean(form)} title={t('edit_user_title')} onClose={() => setOpenEdit(false)}>
        {form && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div>
              <label className="mb-1 block text-sm text-slate-300">{t('columns.username')}</label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
                value={form.username}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, username: event.target.value } : prev))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{t('columns.email')}</label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
                value={form.email}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{t('columns.full_name')}</label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
                value={form.full_name}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, full_name: event.target.value } : prev))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{t('columns.role')}</label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
                value={form.role_id}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, role_id: event.target.value } : prev))}
              >
                <option value="">{t('none')}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, is_active: event.target.checked } : prev))}
                />
                {t('columns.active')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.email_verified}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, email_verified: event.target.checked } : prev))
                  }
                />
                {t('columns.email_verified')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_2fa_enable}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, is_2fa_enable: event.target.checked } : prev))
                  }
                />
                {t('columns.two_fa')}
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">{t('columns.password')}</label>
              <input
                type="password"
                className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, password: event.target.value } : prev))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button className='p-2' variant="ghost" type="button" onClick={() => setOpenEdit(false)}>
                {t('cancel')}
              </Button>
              <Button className='p-2' type="submit" disabled={saving}>
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
