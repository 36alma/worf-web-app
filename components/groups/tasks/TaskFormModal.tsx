'use client';

import {useEffect, useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import {X, Plus, Sparkles} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {Task, GroupUser, STATUSES, TASK_TYPES, PRIORITIES} from './types';
import AssigneeCombobox from './AssigneeCombobox';
import {createTask, modifyTask} from '@/lib/api/tasks';
import {translateTaskApiError, translateTaskPriority, translateTaskStatus, translateTaskType} from '@/lib/i18n/tasks';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';

export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  initialData?: Task;
  onSuccess: () => void;
  groupUsers?: GroupUser[];
  groupUsersLoading?: boolean;
}

type TaskFormValues = {
  issue_key: string;
  summary: string;
  description?: string;
  task_type: string;
  status: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignee_id?: string | null;
  parent_task_id?: string;
  story_points?: string;
  due_at?: string;
  started_at?: string;
};

export default function TaskFormModal({
  open,
  onClose,
  groupId,
  initialData,
  onSuccess,
  groupUsers = [],
  groupUsersLoading = false
}: TaskFormModalProps) {
  const t = useTranslations('tasks');

  const taskSchema = useMemo(() => z.object({
    issue_key: z.string().min(1, t('validation.issueKeyRequired')),
    summary: z.string().min(1, t('validation.summaryRequired')),
    description: z.string().optional(),
    task_type: z.string().min(1, t('validation.taskTypeRequired')),
    status: z.string().min(1, t('validation.statusRequired')),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignee_id: z.string().nullable().optional(),
    parent_task_id: z.string().optional(),
    story_points: z.string().optional(),
    due_at: z.string().optional(),
    started_at: z.string().optional()
  }), [t]);

  const {
    register,
    handleSubmit,
    reset,
    control,
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
      assignee_id: null,
      parent_task_id: '',
      story_points: '',
      due_at: '',
      started_at: ''
    }
  });

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      reset({
        issue_key: initialData.issue_key || `TASK-${Math.floor(Math.random() * 10000)}`,
        summary: initialData.summary,
        description: initialData.description || '',
        task_type: initialData.task_type || 'TASK',
        status: initialData.status || 'TODO',
        priority: (initialData.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM',
        assignee_id: initialData.assigneer_id?.assigneer_email
          ? groupUsers.find((user) => user.email === initialData.assigneer_id?.assigneer_email)?.user_id || null
          : null,
        parent_task_id: initialData.parent_task_id || '',
        story_points: initialData.story_points != null ? String(initialData.story_points) : '',
        due_at: initialData.due_at ? new Date(initialData.due_at).toISOString().slice(0, 16) : '',
        started_at: initialData.started_at ? new Date(initialData.started_at).toISOString().slice(0, 16) : ''
      });
      return;
    }

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
      started_at: ''
    });
  }, [groupUsers, initialData, open, reset]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      if (initialData) {
        const payload: Record<string, unknown> = {
          group_id: groupId,
          task_id: initialData.id
        };

        let hasChanges = false;
        if (data.summary !== initialData.summary) { payload.summary = data.summary; hasChanges = true; }
        if (data.description !== (initialData.description || '')) { payload.description = data.description || ''; hasChanges = true; }
        if (data.task_type !== initialData.task_type) { payload.task_type = data.task_type; hasChanges = true; }
        if (data.status !== initialData.status) { payload.status = data.status; hasChanges = true; }
        if (data.priority !== initialData.priority) { payload.priority = data.priority; hasChanges = true; }

        const initialAssigneeId = initialData.assigneer_id?.assigneer_email
          ? groupUsers.find((user) => user.email === initialData.assigneer_id?.assigneer_email)?.user_id || null
          : null;
        if ((data.assignee_id || null) !== initialAssigneeId) { payload.assignee_id = data.assignee_id || null; hasChanges = true; }
        if ((data.parent_task_id || '') !== (initialData.parent_task_id || '')) { payload.parent_task_id = data.parent_task_id || null; hasChanges = true; }

        const newStoryPoints = data.story_points ? Number(data.story_points) : null;
        const previousStoryPoints = initialData.story_points ?? null;
        if (newStoryPoints !== previousStoryPoints) { payload.story_points = newStoryPoints; hasChanges = true; }

        const toIso = (value?: string) => value ? new Date(value).toISOString() : undefined;
        const newDue = toIso(data.due_at);
        const previousDue = initialData.due_at ? new Date(initialData.due_at).toISOString() : undefined;
        if (newDue !== previousDue) { payload.due_at = newDue || null; hasChanges = true; }

        const newStarted = toIso(data.started_at);
        const previousStarted = initialData.started_at ? new Date(initialData.started_at).toISOString() : undefined;
        if (newStarted !== previousStarted) { payload.started_at = newStarted || null; hasChanges = true; }

        if (!hasChanges) {
          onClose();
          return;
        }

        await modifyTask(payload as {group_id: string; task_id: string; [key: string]: unknown});
        toast.success(t('toasts.updateSuccess'));
      } else {
        const payload: Record<string, unknown> = {
          group_id: groupId,
          issue_key: data.issue_key,
          summary: data.summary,
          task_type: data.task_type || 'TASK'
        };

        if (data.description) payload.description = data.description;
        if (data.status) payload.status = data.status;
        if (data.priority) payload.priority = data.priority;
        if (data.assignee_id) payload.assignee_id = data.assignee_id;
        if (data.parent_task_id) payload.parent_task_id = data.parent_task_id;
        if (data.story_points) payload.story_points = Number(data.story_points);

        const createResponse = await createTask(payload as {group_id: string; [key: string]: unknown});
        toast.success(t('toasts.createSuccess'));

        const createdId = createResponse?.data?.data?.id || createResponse?.data?.id;
        if (createdId && (data.due_at || data.started_at)) {
          const datePayload: Record<string, unknown> = {group_id: groupId, task_id: createdId};
          if (data.due_at) datePayload.due_at = new Date(data.due_at).toISOString();
          if (data.started_at) datePayload.started_at = new Date(data.started_at).toISOString();

          try {
            await modifyTask(datePayload as {group_id: string; task_id: string; [key: string]: unknown});
          } catch (error) {
            toast.error(translateTaskApiError(t, error, 'toasts.scheduleSaveError'));
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'errors.default'));
    }
  };

  const labelClassName = 'mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]';
  const inputClassName = clsx(
    'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]',
    'outline-none transition-all duration-150',
    'focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20',
    'placeholder:text-[var(--text-tertiary)]'
  );
  const errorClassName = 'mt-1 text-[11px] font-medium text-red-500';

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,680px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                {initialData ? <Sparkles size={16} className="text-orange-500" /> : <Plus size={16} className="text-orange-500" />}
              </div>
              <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                {initialData ? t('page.editTitle') : t('page.createTitle')}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-[160px_1fr] gap-4">
              <div>
                <label className={labelClassName}>{t('table.key')} <span className="text-red-400">*</span></label>
                <input
                  {...register('issue_key')}
                  disabled={!!initialData}
                  className={clsx(inputClassName, errors.issue_key && 'border-red-400 focus:border-red-500 focus:ring-red-500/20', initialData && 'cursor-not-allowed opacity-60')}
                  placeholder="TASK-1234"
                />
                {errors.issue_key && <span className={errorClassName}>{errors.issue_key.message}</span>}
              </div>
              <div>
                <label className={labelClassName}>{t('table.summary')} <span className="text-red-400">*</span></label>
                <input
                  {...register('summary')}
                  className={clsx(inputClassName, errors.summary && 'border-red-400 focus:border-red-500 focus:ring-red-500/20')}
                  placeholder={t('form.summaryPlaceholder')}
                />
                {errors.summary && <span className={errorClassName}>{errors.summary.message}</span>}
              </div>
            </div>

            <div>
              <label className={labelClassName}>{t('form.description')}</label>
              <textarea
                {...register('description')}
                rows={3}
                className={clsx(inputClassName, 'min-h-[80px] resize-y')}
                placeholder={t('form.descriptionPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClassName}>{t('table.type')}</label>
                <Controller
                  name="task_type"
                  control={control}
                  render={({field}) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.typePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map((taskType) => (
                          <SelectItem key={taskType} value={taskType}>
                            {translateTaskType(t, taskType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <label className={labelClassName}>{t('table.status')}</label>
                <Controller
                  name="status"
                  control={control}
                  render={({field}) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {translateTaskStatus(t, status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <label className={labelClassName}>{t('table.priority')}</label>
                <Controller
                  name="priority"
                  control={control}
                  render={({field}) => (
                    <Select value={field.value || 'MEDIUM'} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.priorityPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {translateTaskPriority(t, priority)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClassName}>{t('form.assignee')}</label>
                <Controller
                  name="assignee_id"
                  control={control}
                  render={({field}) => (
                    <AssigneeCombobox
                      users={groupUsers}
                      value={field.value ?? null}
                      onChange={(nextValue) => field.onChange(nextValue)}
                      loading={groupUsersLoading}
                    />
                  )}
                />
              </div>
              <div>
                <label className={labelClassName}>{t('form.parentTask')}</label>
                <input
                  {...register('parent_task_id')}
                  className={inputClassName}
                  placeholder={t('form.parentTaskPlaceholder')}
                />
              </div>
              <div>
                <label className={labelClassName}>{t('form.storyPoints')}</label>
                <input
                  type="number"
                  min="0"
                  {...register('story_points')}
                  className={inputClassName}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>{t('form.startedAt')}</label>
                <input type="datetime-local" {...register('started_at')} className={inputClassName} />
              </div>
              <div>
                <label className={labelClassName}>{t('table.dueDate')}</label>
                <input type="datetime-local" {...register('due_at')} className={inputClassName} />
              </div>
            </div>
          </form>

          <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit(onSubmit)}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t('toasts.saving')}
                </span>
              ) : initialData ? (
                t('form.editLabel')
              ) : (
                t('form.createLabel')
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
