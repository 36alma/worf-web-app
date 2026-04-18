import {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import Modal from '@/components/ui/Modal';
import {Task, STATUSES, STATUS_LABELS, TASK_TYPES, TASK_TYPE_LABELS} from './types';
import {createTask, modifyTask} from '@/lib/api/tasks';
import toast from 'react-hot-toast';

const taskSchema = z.object({
  issue_key: z.string().min(1, 'A feladat kulcs kötelező'),
  summary: z.string().min(1, 'A feladat címe kötelező'),
  description: z.string().optional(),
  task_type: z.string().min(1, 'Típus kiválasztása kötelező'),
  status: z.string().min(1, 'Állapot kiválasztása kötelező'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignee_id: z.string().optional(),
  parent_task_id: z.string().optional(),
  story_points: z.string().optional(),
  due_at: z.string().optional(),
  started_at: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  initialData?: Task;
  onSuccess: () => void;
}

export default function TaskFormModal({open, onClose, groupId, initialData, onSuccess}: TaskFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: {errors, isSubmitting}
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      issue_key: `TASK-${Math.floor(Math.random() * 10000)}`,
      summary: '',
      description: '',
      task_type: 'TASK',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee_id: '',
      parent_task_id: '',
      story_points: '',
      due_at: '',
      started_at: '',
    }
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
          assignee_id: initialData.assignee_id || '',
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
          assignee_id: '',
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
          task_id: initialData.id
        };
        
        let hasChanges = false;
        if (data.summary !== initialData.summary) { payload.summary = data.summary; hasChanges = true; }
        if (data.description !== (initialData.description || '')) { payload.description = data.description || ""; hasChanges = true; }
        if (data.task_type !== initialData.task_type) { payload.task_type = data.task_type; hasChanges = true; }
        if (data.status !== initialData.status) { payload.status = data.status; hasChanges = true; }
        if (data.priority !== initialData.priority) { payload.priority = data.priority; hasChanges = true; }
        if ((data.assignee_id || '') !== (initialData.assignee_id || '')) { payload.assignee_id = data.assignee_id || null; hasChanges = true; }
        if ((data.parent_task_id || '') !== (initialData.parent_task_id || '')) { payload.parent_task_id = data.parent_task_id || null; hasChanges = true; }

        const newSP = data.story_points !== '' && data.story_points !== undefined ? Number(data.story_points) : null;
        const oldSP = initialData.story_points ?? null;
        if (newSP !== oldSP) { payload.story_points = newSP; hasChanges = true; }
        
        // Dátumok: ISO-8601
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
        // Létrehozás: issue_key és summary KÖTELEZŐ (422 hiba nélkülük)
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
        
        // Create API nem fogad el dátumokat — létrehozás után azonnal modify-val beállítjuk
        const createRes = await createTask(payload);
        toast.success('Feladat sikeresen létrehozva');

        // Ha van dátum, azonnal modify hívás
        const createdId = createRes?.data?.data?.id || createRes?.data?.id;
        if (createdId && (data.due_at || data.started_at)) {
          const datePayload: any = { group_id: groupId, task_id: createdId };
          if (data.due_at) datePayload.due_at = new Date(data.due_at).toISOString();
          if (data.started_at) datePayload.started_at = new Date(data.started_at).toISOString();
          try {
            await modifyTask(datePayload);
          } catch {
            // Nem blokkoljuk a create sikert, de jelezzük
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

  const inputCls = "w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <Modal open={open} onClose={onClose} title={initialData ? 'Feladat szerkesztése' : 'Új feladat'}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
        
        {/* ── Kötelező mezők ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Azonosító (Kulcs) <span className="text-red-500">*</span>
            </label>
            <input
              {...register('issue_key')}
              disabled={!!initialData}
              className={`${inputCls} ${errors.issue_key ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="TASK-1234"
            />
            {errors.issue_key && <span className="text-xs text-red-500">{errors.issue_key.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Cím <span className="text-red-500">*</span>
            </label>
            <input
              {...register('summary')}
              className={`${inputCls} ${errors.summary ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Mit kell megcsinálni?"
            />
            {errors.summary && <span className="text-xs text-red-500">{errors.summary.message}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text-primary)]">Leírás</label>
          <textarea
            {...register('description')}
            rows={3}
            className={inputCls}
            placeholder="Bővebb részletek a feladatról..."
          />
        </div>

        {/* ── Típus / Állapot / Prioritás ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Típus</label>
            <select {...register('task_type')} className={inputCls}>
              {TASK_TYPES.map(tt => (
                <option key={tt} value={tt}>{TASK_TYPE_LABELS[tt]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Állapot</label>
            <select {...register('status')} className={inputCls}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Prioritás</label>
            <select {...register('priority')} className={inputCls}>
              <option value="LOW">Alacsony</option>
              <option value="MEDIUM">Közepes</option>
              <option value="HIGH">Magas</option>
              <option value="URGENT">Sürgős</option>
            </select>
          </div>
        </div>

        {/* ── Felelős / Szülő Feladat / Story Points ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Felelős (User ID)</label>
            <input
              {...register('assignee_id')}
              className={inputCls}
              placeholder="user-id-123"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Szülő Feladat ID</label>
            <input
              {...register('parent_task_id')}
              className={inputCls}
              placeholder="Ha alfeladat..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Story Points</label>
            <input
              type="number"
              min="0"
              {...register('story_points')}
              className={inputCls}
              placeholder="0"
            />
          </div>
        </div>

        {/* ── Dátumok ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Kezdési dátum</label>
            <input
              type="datetime-local"
              {...register('started_at')}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Határidő</label>
            <input
              type="datetime-local"
              {...register('due_at')}
              className={inputCls}
            />
          </div>
        </div>

        {/* ── Mentés ── */}
        <div className="mt-2 flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4 sticky bottom-0 bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-default)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Mégse
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
