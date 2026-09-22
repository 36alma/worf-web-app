import {describe, expect, it} from 'vitest';
import type {DashboardTask} from '@/lib/types/dashboard';
import {dashboardTaskKey, isTaskOverdue, normalizeDashboardTask, toTaskModalPermissions} from '../dashboardTasks';

const task = (over: Partial<DashboardTask> = {}): DashboardTask => ({
  id: 'enc-1',
  issue_key: 'WORF-42',
  summary: 'Plakát',
  description: null,
  task_type: 'TASK',
  status: 'TODO',
  priority: 'HIGH',
  parent_task_id: null,
  subtasks_total: 0,
  subtasks_completed: 0,
  created_at: '2026-09-01T10:00:00+00:00',
  updated_at: '2026-09-01T10:00:00+00:00',
  group_id: 'abc=',
  group_name: 'DÖK',
  ...over
});

describe('normalizeDashboardTask', () => {
  it('folds the panel `reporter` (with its upstream typo) into `reporter_id`', () => {
    const result = normalizeDashboardTask(
      task({reporter: {reporter_email: 'a@b.hu', reporter_fulname: 'Nagy Béla'}})
    );
    expect(result.reporter_id).toEqual({reporter_email: 'a@b.hu', reporter_fullname: 'Nagy Béla'});
    expect('reporter' in result).toBe(false);
  });

  it('prefers the correctly spelled name when both are present', () => {
    const result = normalizeDashboardTask(
      task({reporter: {reporter_email: 'a@b.hu', reporter_fullname: 'Helyes', reporter_fulname: 'Elgépelt'}})
    );
    expect(result.reporter_id?.reporter_fullname).toBe('Helyes');
  });

  it('keeps an existing reporter_id', () => {
    const existing = {reporter_email: 'x@y.hu', reporter_fullname: 'Már Megvan'};
    const result = normalizeDashboardTask(task({reporter_id: existing, reporter: {reporter_email: 'a@b.hu'}}));
    expect(result.reporter_id).toEqual(existing);
  });

  it('leaves reporter_id unset when the task has no reporter', () => {
    expect(normalizeDashboardTask(task()).reporter_id).toBeUndefined();
  });

  it('decodes a percent-encoded group id', () => {
    expect(normalizeDashboardTask(task({group_id: 'abc%3D'})).group_id).toBe('abc=');
  });
});

describe('dashboardTaskKey', () => {
  it('does not depend on the encrypted ids, so it survives a refetch', () => {
    expect(dashboardTaskKey(task({id: 'enc-1', group_id: 'g1'}))).toBe(
      dashboardTaskKey(task({id: 'enc-2', group_id: 'g2'}))
    );
  });

  it('tells apart the same issue_key in two groups', () => {
    expect(dashboardTaskKey(task({group_name: 'DÖK'}))).not.toBe(dashboardTaskKey(task({group_name: 'Sakk'})));
  });
});

describe('isTaskOverdue', () => {
  const now = new Date('2026-09-20T12:00:00Z');

  it('is overdue when past due and unfinished', () => {
    expect(isTaskOverdue({due_at: '2026-09-19T15:00:00+00:00', status: 'IN_PROGRESS'}, now)).toBe(true);
  });

  it('is not overdue when DONE, without a due date, or still in the future', () => {
    expect(isTaskOverdue({due_at: '2026-09-19T15:00:00+00:00', status: 'DONE'}, now)).toBe(false);
    expect(isTaskOverdue({due_at: null, status: 'TODO'}, now)).toBe(false);
    expect(isTaskOverdue({due_at: '2026-09-21T15:00:00+00:00', status: 'TODO'}, now)).toBe(false);
  });

  it('ignores an unparsable due date', () => {
    expect(isTaskOverdue({due_at: 'nonsense', status: 'TODO'}, now)).toBe(false);
  });
});

describe('toTaskModalPermissions', () => {
  it('maps a group permission map onto the modal shape', () => {
    const granted = new Set(['group.task.read', 'group.task.modify', 'group.task.comment.read']);
    const result = toTaskModalPermissions((name) => granted.has(name));
    expect(result.task).toEqual({read: true, create: false, modify: true, delete: false});
    expect(result.comment).toEqual({read: true, create: false, modify: false, delete: false});
  });
});
