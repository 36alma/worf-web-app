'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { AxiosError } from 'axios';
import { createAdminUser, deleteAdminUser, getAdminUserProfile, getAdminUsers, getAllSystemRoles, updateAdminUserProfile } from '@/lib/api/admin';
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
      const rawId = row.user_id ?? row.id;
      const id = typeof rawId === 'string' ? rawId.trim() : String(rawId ?? '').trim();
      if (!id) {
        return null;
      }
      const email = String(row.email ?? '').trim();

      return {
        id,
        username: String(row.username ?? (email.includes('@') ? email.split('@')[0] : '')),
        email,
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

const toProfile = (payload: unknown, fallback: AdminUserRow, roles: RoleItem[]): EditFormState => {
  const source = readData(payload);
  const objectValue = source && typeof source === 'object' ? (source as RawObject) : {};

  let role_id = String(objectValue.role_id ?? '');
  if (!role_id) {
    const roleName = String(objectValue.role_name ?? objectValue.role ?? '');
    const found = roleName ? roles.find((r) => r.name === roleName) : undefined;
    role_id = found?.id ?? '';
  }

  return {
    user_id: fallback.id,
    username: String(objectValue.username ?? fallback.username ?? ''),
    email: String(objectValue.email ?? fallback.email ?? ''),
    full_name: String(objectValue.full_name ?? objectValue.fullname ?? fallback.full_name ?? ''),
    role_id,
    is_active: Boolean(objectValue.is_active ?? fallback.is_active ?? true),
    email_verified: Boolean(objectValue.email_verified ?? fallback.email_verified ?? false),
    is_2fa_enable: Boolean(objectValue.is_2fa_enable ?? false),
    password: ''
  };
};

const getApiErrorMessage = (error: unknown): string | null => {
  const axiosError = error as AxiosError<{ detail?: Array<{ msg?: string }> | string; message?: string }>;
  const detail = axiosError?.response?.data?.detail;

  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item?.msg).filter(Boolean).join(', ');
  }

  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  if (typeof axiosError?.response?.data?.message === 'string') {
    return axiosError.response.data.message;
  }

  return null;
};

interface CreateFormState {
  email: string;
  full_name: string;
  password: string;
  role_id: string;
  is_active: boolean;
  email_verified: boolean;
}

const emptyCreateForm: CreateFormState = {
  email: '',
  full_name: '',
  password: '',
  role_id: '',
  is_active: true,
  email_verified: false
};

export default function AdminUsersManager() {
  const t = useTranslations('admin');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm);
  const [limit, setLimit] = useState(200);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([getAdminUsers(undefined, limit), getAllSystemRoles()]);
      setRows(toUserRows(usersRes));
      setRoles(toRoles(rolesRes.data));
    } catch {
      toast.error(t('load_error'));
    } finally {
      setLoading(false);
    }
  }, [t, limit]);

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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className='p-2'
              onClick={async () => {
                try {
                  const detailRes = await getAdminUserProfile(row.id);
                  setForm(toProfile(detailRes.data, row, roles));
                  setOpenEdit(true);
                } catch {
                  toast.error(t('load_error'));
                }
              }}
            >
              {t('edit')}
            </Button>
            <Button
              variant="ghost"
              className='p-2 text-red-400 hover:text-red-300'
              onClick={() => setDeleteTarget(row)}
            >
              {t('delete')}
            </Button>
          </div>
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
      const axiosError = error as AxiosError;
      const isAuthFailure =
        axiosError?.response?.status === 401 || message?.toLowerCase().includes('authentication failed') === true;

      toast.error(isAuthFailure ? t('save_error') : message ? `${t('save_error')} (${message})` : t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      await deleteAdminUser(deleteTarget.id);
      toast.success(t('delete_success'));
      setDeleteTarget(null);
      await load();
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message ? `${t('delete_error')} (${message})` : t('delete_error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = async (row: AdminUserRow) => {
    try {
      const detailRes = await getAdminUserProfile(row.id);
      setForm(toProfile(detailRes.data, row));
      setOpenEdit(true);
    } catch {
      toast.error(t('load_error'));
    }
  };

  const onCreateUser = async () => {
    if (!createForm.email || !createForm.full_name || !createForm.password) {
      toast.error(t('create_error'));
      return;
    }

    try {
      setCreating(true);
      await createAdminUser({
        email: createForm.email,
        full_name: createForm.full_name,
        password: createForm.password,
        role_id: createForm.role_id || null,
        is_active: createForm.is_active,
        email_verified: createForm.email_verified
      });

      toast.success(t('create_success'));
      setOpenCreate(false);
      setCreateForm(emptyCreateForm);
      await load();
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message ? `${t('create_error')} (${message})` : t('create_error'));
    } finally {
      setCreating(false);
    }
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role?.name ?? '';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {/* Desktop skeleton */}
        <div className="hidden lg:block space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        {/* Mobile skeleton */}
        <div className="lg:hidden space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Create User Button & Limit Dropdown ── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Limit:</label>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-sm text-[var(--text-primary)]"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 50, 100, 150, 200].map((val) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>
        <Button
          className="p-2 px-4 flex items-center gap-2"
          onClick={() => {
            setCreateForm(emptyCreateForm);
            setOpenCreate(true);
          }}
        >
          <span className="text-lg leading-none">+</span>
          {t('create_user')}
        </Button>
      </div>

      {/* ── Desktop: DataTable ── */}
      <div className="hidden lg:block">
        <DataTable columns={columns} rows={rows} />
      </div>

      {/* ── Mobile/Tablet: Card list ── */}
      <div className="lg:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">{t('no_members')}</p>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-hover)]"
            >
              {/* Top row: avatar + name + status */}
              <div className="flex items-start gap-3">
                {/* Avatar circle */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-sm font-semibold text-[var(--accent)]">
                  {(row.full_name || row.username || row.email).charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Name */}
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {row.full_name || row.username || '—'}
                  </p>
                  {/* Email */}
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    {row.email || '—'}
                  </p>
                </div>

                {/* Active status badge */}
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    row.is_active === true
                      ? 'bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]'
                      : row.is_active === false
                        ? 'bg-[rgba(229,72,77,0.12)] text-[var(--error)]'
                        : 'bg-[var(--badge-gray-bg)] text-[var(--badge-gray-text)]'
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    row.is_active === true
                      ? 'bg-[var(--success)]'
                      : row.is_active === false
                        ? 'bg-[var(--error)]'
                        : 'bg-[var(--text-tertiary)]'
                  }`} />
                  {row.is_active === null ? '—' : row.is_active ? t('yes') : t('no')}
                </span>
              </div>

              {/* Info row: username + role */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
                {row.username && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[var(--text-tertiary)]">@</span>
                    {row.username}
                  </span>
                )}
                {getRoleName(row.role_id) && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    {getRoleName(row.role_id)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-active)]"
                  onClick={() => handleEditClick(row)}
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[rgba(229,72,77,0.25)] bg-[rgba(229,72,77,0.06)] px-3 py-2 text-xs font-medium text-[var(--error)] transition-colors hover:bg-[rgba(229,72,77,0.12)]"
                  onClick={() => setDeleteTarget(row)}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Edit Modal ── */}
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={Boolean(deleteTarget)}
        title={t('delete_user_title')}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              {t('delete_user_confirm', {
                name: deleteTarget.full_name || deleteTarget.username || deleteTarget.email
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button className='p-2' variant="ghost" onClick={() => setDeleteTarget(null)}>
                {t('cancel')}
              </Button>
              <Button
                className='p-2 bg-red-600 hover:bg-red-700 text-white'
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? t('deleting') : t('delete')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create User Modal ── */}
      <Modal open={openCreate} title={t('create_user_title')} onClose={() => setOpenCreate(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateUser();
          }}
        >
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.email')} *</label>
            <input
              type="email"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={createForm.email}
              required
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.full_name')} *</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={createForm.full_name}
              required
              onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.password')} *</label>
            <input
              type="password"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              autoComplete="new-password"
              value={createForm.password}
              required
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.role')}</label>
            <select
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={createForm.role_id}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, role_id: event.target.value }))}
            >
              <option value="">{t('none')}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              {t('columns.active')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={createForm.email_verified}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email_verified: event.target.checked }))}
              />
              {t('columns.email_verified')}
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button className='p-2' variant="ghost" type="button" onClick={() => setOpenCreate(false)}>
              {t('cancel')}
            </Button>
            <Button className='p-2' type="submit" disabled={creating}>
              {creating ? t('creating') : t('create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
