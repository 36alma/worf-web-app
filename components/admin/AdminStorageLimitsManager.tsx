'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import { getAdminUsers } from '@/lib/api/admin';
import { getAllGroups } from '@/lib/api/groups';
import { setUserStorageLimit, setGroupStorageLimit } from '@/lib/api/files';

type RawObject = Record<string, unknown>;

interface SelectableEntity {
  id: string;
  label: string;
}

const readArray = (payload: unknown, knownKeys: string[]): unknown[] => {
  const source =
    payload && typeof payload === 'object' && 'data' in (payload as RawObject) ? (payload as RawObject).data : payload;
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== 'object') return [];
  const found = knownKeys.map((key) => (source as RawObject)[key]).find((value) => Array.isArray(value));
  return Array.isArray(found) ? found : [];
};

const toUsers = (payload: unknown): SelectableEntity[] =>
  readArray(payload, ['users', 'items', 'rows'])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as RawObject;
      const id = String(row.user_id ?? row.id ?? '').trim();
      if (!id) return null;
      const username = String(row.username ?? '').trim();
      const email = String(row.email ?? '').trim();
      return { id, label: username || email || id };
    })
    .filter((value): value is SelectableEntity => value !== null);

const toGroups = (payload: unknown): SelectableEntity[] =>
  readArray(payload, ['groups', 'items', 'rows', 'result'])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as RawObject;
      const id = String(row.group_id ?? row.id ?? '').trim();
      if (!id) return null;
      return { id, label: String(row.group_name ?? row.name ?? id) };
    })
    .filter((value): value is SelectableEntity => value !== null);

interface LimitFormState {
  targetId: string;
  limitMb: string;
  noLimit: boolean;
}

const emptyForm: LimitFormState = { targetId: '', limitMb: '', noLimit: false };

export default function AdminStorageLimitsManager() {
  const t = useTranslations('files');

  const [users, setUsers] = useState<SelectableEntity[]>([]);
  const [groups, setGroups] = useState<SelectableEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [userForm, setUserForm] = useState<LimitFormState>(emptyForm);
  const [groupForm, setGroupForm] = useState<LimitFormState>(emptyForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [usersResponse, groupsResponse] = await Promise.all([getAdminUsers(undefined, 200), getAllGroups()]);
        if (!mounted) return;
        setUsers(toUsers(usersResponse));
        setGroups(toGroups(groupsResponse));
      } catch {
        if (mounted) {
          toast.error(t('errors.default'));
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

  const submitLimit = async (
    kind: 'user' | 'group',
    form: LimitFormState,
    setSaving: (value: boolean) => void,
    resetForm: () => void
  ) => {
    if (!form.targetId) return;
    const limitBytes = form.noLimit ? null : Math.round(Number(form.limitMb) * 1024 * 1024);
    if (!form.noLimit && (!form.limitMb || Number.isNaN(limitBytes) || (limitBytes ?? 0) <= 0)) {
      return;
    }

    setSaving(true);
    try {
      if (kind === 'user') {
        await setUserStorageLimit(form.targetId, limitBytes);
      } else {
        await setGroupStorageLimit(form.targetId, limitBytes);
      }
      toast.success(t('admin.saveSuccess'));
      resetForm();
    } catch {
      toast.error(t('admin.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const targetOptions = useMemo(() => ({ users, groups }), [users, groups]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('admin.title')}</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('admin.userLimitLabel')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('admin.targetIdLabel')}
            </label>
            <select
              className="min-w-[200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              value={userForm.targetId}
              onChange={(event) => setUserForm((prev) => ({ ...prev, targetId: event.target.value }))}
            >
              <option value="">-</option>
              {targetOptions.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('admin.limitMbLabel')}
            </label>
            <input
              type="number"
              min={1}
              disabled={userForm.noLimit}
              value={userForm.limitMb}
              onChange={(event) => setUserForm((prev) => ({ ...prev, limitMb: event.target.value }))}
              className="w-32 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50"
            />
          </div>
          <label className="mb-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={userForm.noLimit}
              onChange={(event) => setUserForm((prev) => ({ ...prev, noLimit: event.target.checked }))}
            />
            {t('admin.noLimitLabel')}
          </label>
          <Button
            type="button"
            variant="primary"
            loading={isSavingUser}
            disabled={!userForm.targetId}
            onClick={() => submitLimit('user', userForm, setIsSavingUser, () => setUserForm(emptyForm))}
          >
            {t('admin.save')}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('admin.groupLimitLabel')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('admin.targetIdLabel')}
            </label>
            <select
              className="min-w-[200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              value={groupForm.targetId}
              onChange={(event) => setGroupForm((prev) => ({ ...prev, targetId: event.target.value }))}
            >
              <option value="">-</option>
              {targetOptions.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('admin.limitMbLabel')}
            </label>
            <input
              type="number"
              min={1}
              disabled={groupForm.noLimit}
              value={groupForm.limitMb}
              onChange={(event) => setGroupForm((prev) => ({ ...prev, limitMb: event.target.value }))}
              className="w-32 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50"
            />
          </div>
          <label className="mb-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={groupForm.noLimit}
              onChange={(event) => setGroupForm((prev) => ({ ...prev, noLimit: event.target.checked }))}
            />
            {t('admin.noLimitLabel')}
          </label>
          <Button
            type="button"
            variant="primary"
            loading={isSavingGroup}
            disabled={!groupForm.targetId}
            onClick={() => submitLimit('group', groupForm, setIsSavingGroup, () => setGroupForm(emptyForm))}
          >
            {t('admin.save')}
          </Button>
        </div>
      </section>
    </div>
  );
}
