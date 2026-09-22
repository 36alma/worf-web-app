import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Trash2, Plus, Pencil, X, Check, Play, Square} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import FieldError from '@/components/ui/FieldError';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {Sprint} from './types';
import {getSprintList, createSprint, modifySprint, deleteSprint, startSprint, closeSprint} from '@/lib/api/sprints';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {requiredText, optionalText} from '@/lib/validation';

export interface SprintManagerModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  permissions: {
    read: boolean;
    create: boolean;
    modify: boolean;
    delete: boolean;
    start: boolean;
    close: boolean;
  };
  onSprintsChanged?: (sprints: Sprint[]) => void;
}

type SprintFormValues = {
  sprint_name: string;
  sprint_goal: string;
  start_date: string;
  end_date: string;
};

const EMPTY_FORM: SprintFormValues = {sprint_name: '', sprint_goal: '', start_date: '', end_date: ''};

const toDateInput = (iso: string) => {
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ''; }
};

export default function SprintManagerModal({open, onClose, groupId, permissions, onSprintsChanged}: SprintManagerModalProps) {
  const t = useTranslations('tasks');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newForm, setNewForm] = useState<SprintFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SprintFormValues>(EMPTY_FORM);
  const [closeTarget, setCloseTarget] = useState<Sprint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null);

  const schemas = useMemo(() => ({sprint_name: requiredText(255), sprint_goal: optionalText(2000)}), []);
  const {errors: newErrors, validateAll: validateNewAll, clearError: clearNewError} = useFieldValidation(schemas);
  const {errors: editErrors, validateAll: validateEditAll, clearError: clearEditError} = useFieldValidation(schemas);

  const fetchSprints = () => {
    if (!permissions.read) return;
    setLoading(true);
    getSprintList({group_id: groupId, limit: 200})
      .then((res: any) => {
        const data = res.data?.data || res.data || [];
        const list = Array.isArray(data.sprints) ? data.sprints : Array.isArray(data) ? data : [];
        setSprints(list);
        onSprintsChanged?.(list);
      })
      .catch(() => toast.error(t('sprint.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) fetchSprints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId, permissions.read]);

  const isRangeValid = (values: SprintFormValues) =>
    !!values.start_date && !!values.end_date && new Date(values.start_date).getTime() < new Date(values.end_date).getTime();

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!permissions.create) return;
    if (!validateNewAll({sprint_name: newForm.sprint_name, sprint_goal: newForm.sprint_goal})) return;
    if (!isRangeValid(newForm)) {
      toast.error(t('sprint.dateRangeInvalid'));
      return;
    }

    try {
      const res = await createSprint({
        group_id: groupId,
        sprint_name: newForm.sprint_name,
        sprint_goal: newForm.sprint_goal || undefined,
        start_date: new Date(newForm.start_date).toISOString(),
        end_date: new Date(newForm.end_date).toISOString()
      });
      const created = res.data?.data || res.data;
      const nextSprints = [...sprints, created];
      setSprints(nextSprints);
      onSprintsChanged?.(nextSprints);
      setNewForm(EMPTY_FORM);
      toast.success(t('sprint.createSuccess'));
    } catch {
      toast.error(t('sprint.createError'));
    }
  };

  const startEdit = (sprint: Sprint) => {
    setEditingId(sprint.id);
    setEditForm({
      sprint_name: sprint.sprint_name,
      sprint_goal: sprint.sprint_goal || '',
      start_date: toDateInput(sprint.start_date),
      end_date: toDateInput(sprint.end_date)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleSaveEdit = async (sprintId: string) => {
    if (!permissions.modify) return;
    if (!validateEditAll({sprint_name: editForm.sprint_name, sprint_goal: editForm.sprint_goal})) return;
    if (!isRangeValid(editForm)) {
      toast.error(t('sprint.dateRangeInvalid'));
      return;
    }

    try {
      const res = await modifySprint({
        group_id: groupId,
        sprint_id: sprintId,
        sprint_name: editForm.sprint_name,
        sprint_goal: editForm.sprint_goal || null,
        start_date: new Date(editForm.start_date).toISOString(),
        end_date: new Date(editForm.end_date).toISOString()
      });
      const updated = res.data?.data || res.data;
      const nextSprints = sprints.map((sprint) => (sprint.id === sprintId ? {...sprint, ...updated} : sprint));
      setSprints(nextSprints);
      onSprintsChanged?.(nextSprints);
      toast.success(t('sprint.updateSuccess'));
      cancelEdit();
    } catch {
      toast.error(t('sprint.updateError'));
    }
  };

  const handleStart = async (sprint: Sprint) => {
    if (!permissions.start) return;

    try {
      const res = await startSprint({group_id: groupId, sprint_id: sprint.id});
      const updated = res.data?.data || res.data;
      const nextSprints = sprints.map((item) => (item.id === sprint.id ? {...item, ...updated} : item));
      setSprints(nextSprints);
      onSprintsChanged?.(nextSprints);
      toast.success(t('sprint.startSuccess'));
    } catch {
      toast.error(t('sprint.startError'));
    }
  };

  const handleClose = (sprint: Sprint) => {
    if (!permissions.close) return;
    setCloseTarget(sprint);
  };

  const executeClose = async () => {
    const sprint = closeTarget;
    if (!sprint) return;
    setCloseTarget(null);

    try {
      const res = await closeSprint({group_id: groupId, sprint_id: sprint.id});
      const data = res.data?.data || res.data || {};
      const unassignedCount = Array.isArray(data.unassigned_task_ids) ? data.unassigned_task_ids.length : 0;
      const nextSprints = sprints.map((item) =>
        item.id === sprint.id ? {...item, status: 'CLOSED' as const, closed_at: new Date().toISOString()} : item
      );
      setSprints(nextSprints);
      onSprintsChanged?.(nextSprints);
      toast.success(t('sprint.closeSuccess', {count: unassignedCount}));
    } catch {
      toast.error(t('sprint.closeError'));
    }
  };

  const handleDelete = (sprint: Sprint) => {
    if (!permissions.delete) return;
    setDeleteTarget(sprint);
  };

  const executeDelete = async () => {
    const sprint = deleteTarget;
    if (!sprint) return;
    setDeleteTarget(null);

    try {
      await deleteSprint({group_id: groupId, sprint_id: sprint.id});
      const nextSprints = sprints.filter((item) => item.id !== sprint.id);
      setSprints(nextSprints);
      onSprintsChanged?.(nextSprints);
      toast.success(t('sprint.deleteSuccess'));
    } catch {
      toast.error(t('sprint.deleteError'));
    }
  };

  const inputCls = 'w-full rounded-md border border-border bg-surface-input px-3 py-2 text-sm text-fg outline-none focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-accent/50';
  const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wider text-fg-muted';

  return (
    <Modal open={open} onClose={onClose} title={t('sprint.title')}>
      <div className="flex flex-col gap-6">
        {!permissions.read ? (
          <p className="text-sm text-fg-secondary">{t('sprint.noReadPermission')}</p>
        ) : loading ? (
          <div className="h-20 animate-pulse rounded bg-surface-2" />
        ) : (
          <div className="flex flex-col gap-3">
            {sprints.map((sprint) => (
              <div key={sprint.id} className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                {editingId === sprint.id ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className={labelCls}>{t('sprint.name')}</label>
                      <input
                        value={editForm.sprint_name}
                        onChange={(e) => { setEditForm((prev) => ({...prev, sprint_name: e.target.value})); clearEditError('sprint_name'); }}
                        className={inputCls}
                        placeholder={t('sprint.namePlaceholder')}
                      />
                      <FieldError messages={editErrors.sprint_name} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('sprint.goal')}</label>
                      <textarea
                        value={editForm.sprint_goal}
                        onChange={(e) => { setEditForm((prev) => ({...prev, sprint_goal: e.target.value})); clearEditError('sprint_goal'); }}
                        rows={2}
                        className={inputCls}
                        placeholder={t('sprint.goalPlaceholder')}
                      />
                      <FieldError messages={editErrors.sprint_goal} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>{t('sprint.startDate')}</label>
                        <input
                          type="date"
                          value={editForm.start_date}
                          onChange={(e) => setEditForm((prev) => ({...prev, start_date: e.target.value}))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>{t('sprint.endDate')}</label>
                        <input
                          type="date"
                          value={editForm.end_date}
                          onChange={(e) => setEditForm((prev) => ({...prev, end_date: e.target.value}))}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" startIcon={<X size={14} />} onClick={cancelEdit}>
                        {t('sprint.cancel')}
                      </Button>
                      <Button variant="primary" size="sm" startIcon={<Check size={14} />} onClick={() => handleSaveEdit(sprint.id)}>
                        {t('sprint.save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-fg">{sprint.sprint_name}</p>
                        <Badge variant={sprint.status === 'ACTIVE' ? 'info' : sprint.status === 'CLOSED' ? 'neutral' : 'success'}>
                          {t(`sprint.status.${sprint.status}`)}
                        </Badge>
                      </div>
                      {sprint.sprint_goal && <p className="mt-0.5 text-sm text-fg-secondary">{sprint.sprint_goal}</p>}
                      <p className="mt-1 text-caption text-fg-muted">
                        {new Date(sprint.start_date).toLocaleDateString()} – {new Date(sprint.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {permissions.start && sprint.status === 'PLANNED' && (
                        <Button size="sm" variant="primary" startIcon={<Play size={14} />} onClick={() => handleStart(sprint)}>
                          {t('backlog.startSprint')}
                        </Button>
                      )}
                      {permissions.close && sprint.status === 'ACTIVE' && (
                        <Button size="sm" variant="secondary" startIcon={<Square size={14} />} onClick={() => handleClose(sprint)}>
                          {t('backlog.closeSprint')}
                        </Button>
                      )}
                      {permissions.modify && (
                        <button onClick={() => startEdit(sprint)} className="p-1.5 text-fg-muted transition-colors hover:text-fg" aria-label={t('sprint.edit')}>
                          <Pencil size={16} />
                        </button>
                      )}
                      {permissions.delete && (
                        <button onClick={() => handleDelete(sprint)} className="p-1.5 text-fg-muted transition-colors hover:text-danger" aria-label={t('actions.delete')}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {sprints.length === 0 && <p className="text-sm italic text-fg-secondary">{t('sprint.noSprints')}</p>}
          </div>
        )}

        {permissions.create && (
          <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4">
            <h4 className="text-section text-fg">{t('sprint.create')}</h4>
            <div>
              <label className={labelCls}>{t('sprint.name')}</label>
              <input
                value={newForm.sprint_name}
                onChange={(e) => { setNewForm((prev) => ({...prev, sprint_name: e.target.value})); clearNewError('sprint_name'); }}
                className={inputCls}
                placeholder={t('sprint.namePlaceholder')}
              />
              <FieldError messages={newErrors.sprint_name} />
            </div>
            <div>
              <label className={labelCls}>{t('sprint.goal')}</label>
              <textarea
                value={newForm.sprint_goal}
                onChange={(e) => { setNewForm((prev) => ({...prev, sprint_goal: e.target.value})); clearNewError('sprint_goal'); }}
                rows={2}
                className={inputCls}
                placeholder={t('sprint.goalPlaceholder')}
              />
              <FieldError messages={newErrors.sprint_goal} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('sprint.startDate')}</label>
                <input
                  type="date"
                  value={newForm.start_date}
                  onChange={(e) => setNewForm((prev) => ({...prev, start_date: e.target.value}))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('sprint.endDate')}</label>
                <input
                  type="date"
                  value={newForm.end_date}
                  onChange={(e) => setNewForm((prev) => ({...prev, end_date: e.target.value}))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                startIcon={<Plus size={16} />}
                disabled={!newForm.sprint_name.trim() || !newForm.start_date || !newForm.end_date}
              >
                {t('sprint.create')}
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!closeTarget}
        title={t('backlog.closeSprint')}
        message={closeTarget ? t('sprint.closeConfirm', {name: closeTarget.sprint_name}) : ''}
        onCancel={() => setCloseTarget(null)}
        onConfirm={executeClose}
        confirmLabel={t('backlog.closeSprint')}
        cancelLabel={t('sprint.cancel')}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('actions.delete')}
        message={deleteTarget ? t('sprint.deleteConfirm', {name: deleteTarget.sprint_name}) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('sprint.cancel')}
      />
    </Modal>
  );
}
