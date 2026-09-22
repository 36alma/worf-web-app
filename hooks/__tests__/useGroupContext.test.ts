// @vitest-environment jsdom
import {renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useGroupContext} from '../useGroupContext';

const mocks = vi.hoisted(() => ({
  getGroupMembers: vi.fn(),
  getGroupPermissions: vi.fn(),
  getSprintList: vi.fn()
}));
vi.mock('@/lib/api/groups', () => ({getGroupMembers: mocks.getGroupMembers}));
vi.mock('@/lib/api/permissions', () => ({getGroupPermissions: mocks.getGroupPermissions}));
vi.mock('@/lib/api/sprints', () => ({getSprintList: mocks.getSprintList}));

const members = {data: {users: [{user_id: 'u1', full_name: 'Nagy Béla', email: 'b@x.hu', username: 'bela'}]}};
const sprints = {data: {sprints: [{id: 's1', sprint_name: 'Sprint 1'}]}};

describe('useGroupContext', () => {
  beforeEach(() => {
    mocks.getGroupMembers.mockReset().mockResolvedValue(members);
    mocks.getGroupPermissions.mockReset().mockResolvedValue({'group.task.create': true, 'group.sprint.read': true});
    mocks.getSprintList.mockReset().mockResolvedValue(sprints);
  });

  it('does nothing and reports idle while there is no group', () => {
    const {result} = renderHook(() => useGroupContext(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.groupUsersLoading).toBe(false);
    expect(mocks.getGroupPermissions).not.toHaveBeenCalled();
  });

  it('reports loading on the very render a group id appears, before any effect has run', () => {
    const {result, rerender} = renderHook(({id}: {id: string | null}) => useGroupContext(id), {
      initialProps: {id: null as string | null}
    });
    rerender({id: 'g1'});
    // A modal gated on `loading` must not flash open with empty permissions.
    expect(result.current.loading).toBe(true);
    expect(result.current.groupUsersLoading).toBe(true);
    expect(result.current.hasPermission('group.task.create')).toBe(false);
  });

  it('loads permissions, members and (when readable) sprints', async () => {
    const {result} = renderHook(() => useGroupContext('g1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasPermission('group.task.create')).toBe(true);
    expect(result.current.hasPermission('group.task.delete')).toBe(false);
    await waitFor(() => expect(result.current.groupUsers).toHaveLength(1));
    await waitFor(() => expect(result.current.sprints).toHaveLength(1));
    expect(mocks.getSprintList).toHaveBeenCalledWith({group_id: 'g1', limit: 200});
  });

  it('skips the sprint request without group.sprint.read', async () => {
    mocks.getGroupPermissions.mockResolvedValue({'group.task.create': true});
    const {result} = renderHook(() => useGroupContext('g1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.getSprintList).not.toHaveBeenCalled();
    expect(result.current.sprints).toEqual([]);
  });

  it('skips members and sprints when they are not asked for', async () => {
    const {result} = renderHook(() => useGroupContext('g1', {users: false, sprints: false}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groupUsersLoading).toBe(false);
    expect(mocks.getGroupMembers).not.toHaveBeenCalled();
    expect(mocks.getSprintList).not.toHaveBeenCalled();
  });

  it('a failed permission request means read-only, not a hang', async () => {
    mocks.getGroupPermissions.mockRejectedValue(new Error('403'));
    const {result} = renderHook(() => useGroupContext('g1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasPermission('group.task.create')).toBe(false);
  });

  it('a failed member request leaves an empty picker, not a hang', async () => {
    mocks.getGroupMembers.mockRejectedValue(new Error('500'));
    const {result} = renderHook(() => useGroupContext('g1'));
    await waitFor(() => expect(result.current.groupUsersLoading).toBe(false));
    expect(result.current.groupUsers).toEqual([]);
  });

  it("never shows the previous group's permissions for the next one", async () => {
    const {result, rerender} = renderHook(({id}: {id: string}) => useGroupContext(id), {initialProps: {id: 'g1'}});
    await waitFor(() => expect(result.current.hasPermission('group.task.create')).toBe(true));

    mocks.getGroupPermissions.mockResolvedValue({});
    rerender({id: 'g2'});
    expect(result.current.loading).toBe(true);
    expect(result.current.hasPermission('group.task.create')).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasPermission('group.task.create')).toBe(false);
  });
});
