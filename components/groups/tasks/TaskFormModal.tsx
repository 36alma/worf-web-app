import {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import Modal from '@/components/ui/Modal';
import {Task} from './types';
import {createTask, modifyTask} from '@/lib/api/tasks';
import toast from 'react-hot-toast';

const taskSchema = z.object({
  issue_key: z.string().min(1, 'A feladat kulcs kötelező'),
  summary: z.string().min(1, 'A feladat címe kötelező'),
  description: z.string().optional(),
  status: z.string().min(1, 'Állapot kiválasztása kötelező'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  due_at: z.string().optional()
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
      status: 'TODO',
      priority: 'MEDIUM',
      due_at: ''
    }
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          issue_key: (initialData as any).issue_key || `TASK-${Math.floor(Math.random() * 10000)}`,
          summary: initialData.summary,
          description: initialData.description || '',
          status: initialData.status || 'TODO',
          priority: (initialData.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM',
          due_at: initialData.due_at ? new Date(initialData.due_at).toISOString().split('T')[0] : ''
        });
      } else {
        reset({
          issue_key: `TASK-${Math.floor(Math.random() * 10000)}`,
          summary: '',
          description: '',
          status: 'TODO',
          priority: 'MEDIUM',
          due_at: ''
        });
      }
    }
  }, [open, initialData, reset]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      if (initialData) {
        const payload: any = {
          group_id: groupId,
          task_id: initialData.task_id
        };
        
        let hasChanges = false;
        if (data.summary !== initialData.summary) { payload.summary = data.summary; hasChanges = true; }
        if (data.description !== (initialData.description || '')) { payload.description = data.description || ""; hasChanges = true; }
        if (data.status !== initialData.status) { payload.status = data.status; hasChanges = true; }
        if (data.priority !== initialData.priority) { payload.priority = data.priority; hasChanges = true; }
        
        const newDate = data.due_at ? new Date(data.due_at).toISOString() : undefined;
        const oldDate = initialData.due_at ? new Date(initialData.due_at).toISOString() : undefined;
        if (newDate !== oldDate) { payload.due_at = newDate; hasChanges = true; }

        if (hasChanges) {
          await modifyTask(payload);
          toast.success('Feladat sikeresen módosítva');
        } else {
          onClose(); // No changes to save
          return;
        }
      } else {
        const payload: any = {
          group_id: groupId,
          issue_key: data.issue_key,
          summary: data.summary,
        };
        if (data.description) payload.description = data.description;
        if (data.status) payload.status = data.status;
        if (data.priority) payload.priority = data.priority;
        if (data.due_at) payload.due_at = new Date(data.due_at).toISOString();
        
        await createTask(payload);
        toast.success('Feladat sikeresen létrehozva');
      }
      onSuccess();
      onClose();
    } catch {
      toast.error('Hiba történt a mentés során');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initialData ? 'Feladat szerkesztése' : 'Új feladat'}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text-primary)]">
            Azonosító (Kulcs) <span className="text-red-500">*</span>
          </label>
          <input
            {...register('issue_key')}
            disabled={!!initialData} // Usually issue keys shouldn't be changed once set
            className={`w-full rounded-md border bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-1 ${errors.issue_key ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[var(--border-default)] focus:border-indigo-500 focus:ring-indigo-500'} ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            className={`w-full rounded-md border bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-1 ${errors.summary ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[var(--border-default)] focus:border-indigo-500 focus:ring-indigo-500'}`}
            placeholder="Mit kell megcsinálni?"
          />
          {errors.summary && <span className="text-xs text-red-500">{errors.summary.message}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text-primary)]">Leírás</label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="Bővebb részletek a feladatról..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Állapot</label>
            <select
              {...register('status')}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Prioritás</label>
            <select
              {...register('priority')}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="LOW">Alacsony</option>
              <option value="MEDIUM">Közepes</option>
              <option value="HIGH">Magas</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text-primary)]">Határidő</label>
          <input
            type="date"
            {...register('due_at')}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="mt-4 flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
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
