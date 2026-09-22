// @vitest-environment jsdom
import {renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {getUserGroups} = vi.hoisted(() => ({getUserGroups: vi.fn()}));
vi.mock('@/lib/api/groups', () => ({getUserGroups: () => getUserGroups()}));

const payload = {data: {group_users: [{group_id: 'g1', group_name: 'DÖK'}]}};

// The hook keeps a module-level cache; every test starts from a fresh module.
const load = async () => (await import('../useUserGroups')).useUserGroups;

describe('useUserGroups', () => {
  beforeEach(() => {
    vi.resetModules();
    getUserGroups.mockReset();
  });

  it('shares one request between hooks that mount together', async () => {
    getUserGroups.mockResolvedValue(payload);
    const useUserGroups = await load();
    const a = renderHook(() => useUserGroups());
    const b = renderHook(() => useUserGroups());

    await waitFor(() => expect(a.result.current.groups).toEqual([{id: 'g1', name: 'DÖK'}]));
    await waitFor(() => expect(b.result.current.groups).toEqual([{id: 'g1', name: 'DÖK'}]));
    expect(getUserGroups).toHaveBeenCalledTimes(1);
  });

  it('serves a later mount from the cache', async () => {
    getUserGroups.mockResolvedValue(payload);
    const useUserGroups = await load();
    const first = renderHook(() => useUserGroups());
    await waitFor(() => expect(first.result.current.groups).toHaveLength(1));

    const second = renderHook(() => useUserGroups());
    expect(second.result.current.groups).toEqual([{id: 'g1', name: 'DÖK'}]);
    expect(getUserGroups).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure — the next mount tries again', async () => {
    getUserGroups.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(payload);
    const useUserGroups = await load();

    const first = renderHook(() => useUserGroups());
    await waitFor(() => expect(first.result.current.failed).toBe(true));
    expect(first.result.current.groups).toEqual([]);

    const second = renderHook(() => useUserGroups());
    await waitFor(() => expect(second.result.current.groups).toHaveLength(1));
    expect(getUserGroups).toHaveBeenCalledTimes(2);
  });

  it('sends nothing while disabled', async () => {
    const useUserGroups = await load();
    renderHook(() => useUserGroups(false));
    expect(getUserGroups).not.toHaveBeenCalled();
  });
});
