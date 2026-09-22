import type {DashboardTask} from '@/lib/types/dashboard';
import {normalizeGroupId} from './groupId';

/**
 * `panel/all` reports the reporter as `reporter: {reporter_email, reporter_fulname}` while the task modal reads
 * `reporter_id.reporter_fullname` — fold the former into the latter (an existing `reporter_id` wins), and put the
 * group id into its raw form like every other group id in the app.
 */
export function normalizeDashboardTask(raw: DashboardTask): DashboardTask {
  const {reporter, ...task} = raw;
  const normalized: DashboardTask = {...task, group_id: normalizeGroupId(task.group_id)};
  if (!normalized.reporter_id && reporter) {
    normalized.reporter_id = {
      reporter_email: reporter.reporter_email,
      reporter_fullname: reporter.reporter_fullname ?? reporter.reporter_fulname
    };
  }
  return normalized;
}

/**
 * A key that survives a refetch. Every opaque id (`id`, `group_id`) is encrypted afresh on each response, and the
 * `issue_key` is typed in by the user, so it can repeat across groups — hence the composite.
 */
export const dashboardTaskKey = (task: Pick<DashboardTask, 'group_name' | 'issue_key' | 'created_at'>): string =>
  `${task.group_name ?? ''}|${task.issue_key}|${task.created_at}`;

/** Past due and not finished. The server sorts these first; this drives the highlight. */
export function isTaskOverdue(task: Pick<DashboardTask, 'due_at' | 'status'>, now: Date): boolean {
  if (!task.due_at || task.status === 'DONE') return false;
  const due = new Date(task.due_at).getTime();
  return !Number.isNaN(due) && due < now.getTime();
}

interface CrudFlags {
  read: boolean;
  create: boolean;
  modify: boolean;
  delete: boolean;
}

export interface TaskModalPermissions {
  task: CrudFlags;
  comment: CrudFlags;
}

/** The `permissions` prop of `TaskDetailModal`, from one group's permission map. */
export function toTaskModalPermissions(has: (name: string) => boolean): TaskModalPermissions {
  const crud = (prefix: string): CrudFlags => ({
    read: has(`${prefix}.read`),
    create: has(`${prefix}.create`),
    modify: has(`${prefix}.modify`),
    delete: has(`${prefix}.delete`)
  });
  return {task: crud('group.task'), comment: crud('group.task.comment')};
}
