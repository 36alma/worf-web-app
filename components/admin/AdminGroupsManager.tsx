'use client';

import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import {useLocale, useTranslations} from 'next-intl';
import {createGroup, deleteGroup, getAllGroups, modifyGroupBase} from '@/lib/api/groups';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';

type RawObject = Record<string, unknown>;

interface GroupRow {
  id: string;
  name: string;
  description: string;
}

interface GroupFormState {
  id?: string;
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

const toGroupRows = (payload: unknown): GroupRow[] => {
  const source = readData(payload);
  const arrayValue = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['groups', 'items', 'rows', 'result']
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
      const id = String(row.group_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.group_name ?? row.name ?? id),
        description: String(row.group_description ?? row.description ?? '')
      };
    })
    .filter((row): row is GroupRow => Boolean(row));
};

const defaultForm: GroupFormState = {
  name: '',
  description: ''
};

export default function AdminGroupsManager() {
  const t = useTranslations('admin');
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<GroupFormState>(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null);
  const router = useRouter();
  const locale = useLocale();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllGroups();
      setRows(toGroupRows(response.data));
    } catch {
      toast.error(t('load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(
    () => [
      {key: 'name' as const, label: t('columns.group_name')},
      {key: 'description' as const, label: t('columns.description')},
      {
        key: 'id' as const,
        label: t('columns.actions'),
        render: (value: unknown, row: GroupRow) => (
          <div className="flex gap-2">
            <Button
              className="p-2"
              variant="ghost"
              onClick={() => {
                setForm({id: row.id, name: row.name, description: row.description});
                setOpenForm(true);
              }}
            >
              {t('edit')}
            </Button>
            <Button
              className="p-2"
              variant="ghost"
              onClick={() => router.push(`/${locale}/admin/groups/${row.id}/members`)}
            >
              {t('manage_members')}
            </Button>
            <Button
              className="p-2"
              variant="ghost"
              onClick={() => router.push(`/${locale}/admin/groups/${row.id}/role`)}
            >
              {t('manage_roles')}
            </Button>
            <Button className="p-2" variant="danger" onClick={() => setDeleteTarget(row)}>
              {t('delete')}
            </Button>
          </div>
        )
      }
    ],
    [t, router, locale]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    try {
      setSaving(true);
      if (form.id) {
        await modifyGroupBase({
          group_id: form.id,
          name: form.name,
          description: form.description || undefined
        });
      } else {
        await createGroup({
          name: form.name,
          description: form.description || undefined
        });
      }

      toast.success(t('save_success'));
      setOpenForm(false);
      setForm(defaultForm);
      await load();
    } catch {
      toast.error(t('save_error'));
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
      await deleteGroup(deleteTarget.id);
      toast.success(t('delete_success'));
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(t('delete_error'));
    } finally {
      setDeleting(false);
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
      <div className="flex justify-end">
        <Button
          className="p-2"
          onClick={() => {
            setForm(defaultForm);
            setOpenForm(true);
          }}
        >
          {t('create_group')}
        </Button>
      </div>

      <DataTable columns={columns} rows={rows} />

      <Modal
        open={openForm}
        title={form.id ? t('edit_group_title') : t('create_group_title')}
        onClose={() => setOpenForm(false)}
      >
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.group_name')}</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={form.name}
              onChange={(event) => setForm((prev) => ({...prev, name: event.target.value}))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('columns.description')}</label>
            <textarea
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={form.description}
              onChange={(event) => setForm((prev) => ({...prev, description: event.target.value}))}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button className="p-2" variant="ghost" type="button" onClick={() => setOpenForm(false)}>
              {t('cancel')}
            </Button>
            <Button className="p-2" type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('delete_group_title')}
        message={t('delete_group_confirm')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={onDelete}
      />

      {deleting && <div className="hidden" aria-hidden="true" />}
    </div>
  );
}
