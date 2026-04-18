import {beforeEach, describe, expect, it, vi} from 'vitest';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock
}));

import {getGroupPermissions} from '@/lib/api/permissions';

describe('getGroupPermissions', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
  });

  it('forwards the original group_id in the request body without query encoding', async () => {
    const groupId = 'dgcqI16Hgd4fxZPOvW-slWYl5N40J0sT830yLaBnjcLeFZbT7rBrY6a00gU=';
    apiClientMock.post.mockResolvedValue({
      data: {
        'group.permission.get.all': true
      }
    });

    await expect(getGroupPermissions(groupId)).resolves.toEqual({
      'group.permission.get.all': true
    });

    expect(apiClientMock.post).toHaveBeenCalledWith('/v1/group/permission', {group_id: groupId});
    expect(apiClientMock.get).not.toHaveBeenCalled();
  });
});
