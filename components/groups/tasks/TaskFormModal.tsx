'use client';

import {useEffect, useState} from 'react';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import {X, Plus, Sparkles} from 'lucide-react';
import clsx from 'clsx';
import {Task, GroupUser, STATUSES, STATUS_LABELS, TASK_TYPES, TASK_TYPE_LABELS} from './types';
import AssigneeCombobox from './AssigneeCombobox';
import {createTask, modifyTask} from '@/lib/api/tasks';
import toast from 'react-hot-toast';

// ── Schema ──────────────────────────────────────────────────────────────
const taskSchema = z.object({
  issue_key: z.string().min(1, 'A feladat kulcs kötelező'),
  summary: z.string().min(1, 'A feladat címe kötelező'),
  description: z.string().optional(),
  task_type: z.string().min(1, 'Típus kiválasztása kötelező'),
  status: z.string().min(1, 'Állapot kiválasztása kötelező'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignee_id: z.string().nullable().optional(),
  parent_task_id: z.string().optional(),
  story_points: z.string().optional(),
  due_at: z.string().optional(),
  started_at: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

// ── Props ───────────────────────────────────────────────────────────────
export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  initialData?: Task;
  onSuccess: () => void;
  /** Cached list of group users for the Assignee Combobox */
  groupUsers?: GroupUser[];
  /** True while group users are being fetched */
  groupUsersLoading?: boolean;
}

export default function TaskFormModal({
  open,
  onClose,
  groupId,
  initialData,
  onSuccess,
  groupUsers = [],
  groupUsersLoading = false,
}: TaskFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: {errors, isSubmitting},
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      issue_key: `TASK-${Math.floor(Math.random() * 10000)}`,
      summary: '',
      description: '',
      task_type: 'TASK',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee_id: null,
      parent_task_id: '',
      story_points: '',
      due_at: '',
      started_at: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          issue_key: initialData.issue_key || `TASK-${Math.floor(Math.random() * 10000)}`,
          summary: initialData.summary,
          description: initialData.description || '',
          task_type: initialData.task_type || 'TASK',
          status: initialData.status || 'TODO',
          priority: (initialData.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM',
          assignee_id: initialData.assignee_id || null,
          parent_task_id: initialData.parent_task_id || '',
          story_points: initialData.story_points != null ? String(initialData.story_points) : '',
          due_at: initialData.due_at ? new Date(initialData.due_at).toISOString().slice(0, 16) : '',
          started_at: initialData.started_at ? new Date(initialData.started_at).toISOString().slice(0, 16) : '',
        });
      } else {
        reset({
          issue_key: `TASK-${Math.floor(Math.random() * 10000)}`,
          summary: '',
          description: '',
          task_type: 'TASK',
          status: 'TODO',
          priority: 'MEDIUM',
          assignee_id: null,
          parent_task_id: '',
          story_points: '',
          due_at: '',
          started_at: '',
        });
      }
    }
  }, [open, initialData, reset]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      if (initialData) {
        const payload: any = {
          group_id: groupId,
          task_id: initialData.id,
        };

        let hasChanges = false;
        if (data.summary !== initialData.summary) { payload.summary = data.summary; hasChanges = true; }
        if (data.description !== (initialData.description || '')) { payload.description = data.description || ''; hasChanges = true; }
        if (data.task_type !== initialData.task_type) { payload.task_type = data.task_type; hasChanges = true; }
        if (data.status !== initialData.status) { payload.status = data.status; hasChanges = true; }
        if (data.priority !== initialData.priority) { payload.priority = data.priority; hasChanges = true; }
        if ((data.assignee_id || null) !== (initialData.assignee_id || null)) { payload.assignee_id = data.assignee_id || null; hasChanges = true; }
        if ((data.parent_task_id || '') !== (initialData.parent_task_id || '')) { payload.parent_task_id = data.parent_task_id || null; hasChanges = true; }

        const newSP = data.story_points !== '' && data.story_points !== undefined ? Number(data.story_points) : null;
        const oldSP = initialData.story_points ?? null;
        if (newSP !== oldSP) { payload.story_points = newSP; hasChanges = true; }

        const toISO = (v?: string) => v ? new Date(v).toISOString() : undefined;
        const newDue = toISO(data.due_at);
        const oldDue = initialData.due_at ? new Date(initialData.due_at).toISOString() : undefined;
        if (newDue !== oldDue) { payload.due_at = newDue || null; hasChanges = true; }

        const newStarted = toISO(data.started_at);
        const oldStarted = initialData.started_at ? new Date(initialData.started_at).toISOString() : undefined;
        if (newStarted !== oldStarted) { payload.started_at = newStarted || null; hasChanges = true; }

        if (hasChanges) {
          await modifyTask(payload);
          toast.success('Feladat sikeresen módosítva');
        } else {
          onClose();
          return;
        }
      } else {
        const payload: any = {
          group_id: groupId,
          issue_key: data.issue_key,
          summary: data.summary,
          task_type: data.task_type || 'TASK',
        };
        if (data.description) payload.description = data.description;
        if (data.status) payload.status = data.status;
        if (data.priority) payload.priority = data.priority;
        if (data.assignee_id) payload.assignee_id = data.assignee_id;
        if (data.parent_task_id) payload.parent_task_id = data.parent_task_id;
        if (data.story_points !== '' && data.story_points !== undefined) payload.story_points = Number(data.story_points);

        const createRes = await createTask(payload);
        toast.success('Feladat sikeresen létrehozva');

        const createdId = createRes?.data?.data?.id || createRes?.data?.id;
        if (createdId && (data.due_at || data.started_at)) {
          const datePayload: any = {group_id: groupId, task_id: createdId};
          if (data.due_at) datePayload.due_at = new Date(data.due_at).toISOString();
          if (data.started_at) datePayload.started_at = new Date(data.started_at).toISOString();
          try {
            await modifyTask(datePayload);
          } catch {
            toast.error('A dátumok beállítása sikertelen volt — állítsd be kézzel a részletekben.');
          }
        }
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 422) toast.error('Hibás bemeneti adatok: Kérlek ellenőrizd az azonosítót és a címet! (422)');
      else if (status === 403) toast.error('Nincs jogosultságod ehhez a művelethez (403)');
      else if (status === 429) toast.error('Túl sok kérés (429)');
      else toast.error('Hiba történt a mentés során');
    }
  };

  // ── Style classes ──
  const labelCls = 'block text-xs font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider';
  const inputCls = clsx(
    'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]',
    'outline-none transition-all duration-150',
    'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
    'placeholder:text-[var(--text-tertiary)]'
  );
  const selectCls = clsx(inputCls, 'cursor-pointer appearance-none');
  const errorCls = 'text-[11px] text-red-500 mt-1 font-medium';

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,680px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">

          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                {initialData ? <Sparkles size={16} className="text-indigo-500" /> : <Plus size={16} className="text-indigo-500" />}
              </div>
              <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                {initialData ? 'Feladat szerkesztése' : 'Új feladat létrehozása'}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 px-6 py-5 max-h-[65vh] overflow-y-auto">

            {/* Row 1: Key + Title */}
            <div className="grid grid-cols-[160px_1fr] gap-4">
              <div>
                <label className={labelCls}>Kulcs <span className="text-red-400">*</span></label>
                <input
                  {...register('issue_key')}
                  disabled={!!initialData}
                  className={clsx(inputCls, errors.issue_key && 'border-red-400 focus:border-red-500 focus:ring-red-500/20', initialData && 'opacity-60 cursor-not-allowed')}
                  placeholder="TASK-1234"
                />
                {errors.issue_key && <span className={errorCls}>{errors.issue_key.message}</span>}
              </div>
              <div>
                <label className={labelCls}>Cím <span className="text-red-400">*</span></label>
                <input
                  {...register('summary')}
                  className={clsx(inputCls, errors.summary && 'border-red-400 focus:border-red-500 focus:ring-red-500/20')}
                  placeholder="Mit kell megcsinálni?"
                />
                {errors.summary && <span className={errorCls}>{errors.summary.message}</span>}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Leírás</label>
              <textarea
                {...register('description')}
                rows={3}
                className={clsx(inputCls, 'resize-y min-h-[80px]')}
                placeholder="Bővebb részletek a feladatról..."
              />
            </div>

            {/* Row 2: Típus + Állapot + Prioritás */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Típus</label>
                <select {...register('task_type')} className={selectCls}>
                  {TASK_TYPES.map(tt => (
                    <option key={tt} value={tt}>{TASK_TYPE_LABELS[tt]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Állapot</label>
                <select {...register('status')} className={selectCls}>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prioritás</label>
                <select {...register('priority')} className={selectCls}>
                  <option value="LOW">Alacsony</option>
                  <option value="MEDIUM">Közepes</option>
                  <option value="HIGH">Magas</option>
                  <option value="URGENT">Sürgős</option>
                </select>
              </div>
            </div>

            {/* Row 3: Felelős + Parent + SP */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Felelős</label>
                <Controller
                  name="assignee_id"
                  control={control}
                  render={({field}) => (
                    <AssigneeCombobox
                      users={groupUsers}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v)}
                      loading={groupUsersLoading}
                    />
                  )}
                />
              </div>
              <div>
                <label className={labelCls}>Szülő feladat</label>
                <input
                  {...register('parent_task_id')}
                  className={inputCls}
                  placeholder="Ha alfeladat..."
                />
              </div>
              <div>
                <label className={labelCls}>Story Points</label>
                <input
                  type="number"
                  min="0"
                  {...register('story_points')}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Row 4: Dátumok */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Kezdési dátum</label>
                <input
                  type="datetime-local"
                  {...register('started_at')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Határidő</label>
                <input
                  type="datetime-local"
                  {...register('due_at')}
                  className={inputCls}
                />
              </div>
            </div>
          </form>

          {/* ── Footer ── */}
          <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] hover:border-[var(--border-default)]"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit(onSubmit)}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Mentés...
                </span>
              ) : (
                initialData ? 'Módosítás mentése' : 'Feladat létrehozása'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
