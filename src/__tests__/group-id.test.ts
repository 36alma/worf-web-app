import {describe, expect, it, vi, beforeEach} from 'vitest';
import {normalizeGroupId} from '@/lib/utils/groupId';
import {getGroupPermissions} from '@/lib/api/permissions';
import {getUserGroups} from '@/lib/api/groups';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock
}));

describe('group_id normalization', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
  });

  describe('normalizeGroupId utility', () => {
    it('returns raw input as-is', () => {
      expect(normalizeGroupId('abc=')).toBe('abc=');
      expect(normalizeGroupId('straight-raw-id')).toBe('straight-raw-id');
    });

    it('decodes encoded input correctly', () => {
      expect(normalizeGroupId('abc%3D')).toBe('abc=');
      expect(normalizeGroupId('a%2Fb%3D')).toBe('a/b=');
    });

    it('handles invalid percent-encoded sequences gracefully', () => {
      // %ZZ is not valid encoding
      expect(normalizeGroupId('abc%ZZ')).toBe('abc%ZZ');
    });

    it('returns empty string for non-string or empty inputs', () => {
      expect(normalizeGroupId(null)).toBe('');
      expect(normalizeGroupId(undefined)).toBe('');
      // @ts-expect-error Testing invalid type
      expect(normalizeGroupId(123)).toBe('');
      expect(normalizeGroupId('   ')).toBe('');
    });
  });

  describe('API flow with normalizeGroupId', () => {
    it('sends raw group_id even if encoded input is provided to getGroupPermissions', async () => {
      const rawId = 'hello-world=';
      const encodedId = encodeURIComponent(rawId);

      apiClientMock.post.mockResolvedValueOnce({
        data: {'group.read': true}
      });

      await getGroupPermissions(encodedId);

      // The API client should be called with the RAW id, stripped of encoding
      expect(apiClientMock.post).toHaveBeenCalledWith('/v1/group/permission', {
        group_id: rawId
      });
    });

    it('handles mixed flow: getUserGroups -> permission lookup', async () => {
      const rawIdFromDb = 'QuaPTl_4vNRsXyJv2tEhsiAw01iD=';
      
      // 1. Mock getUserGroups returning raw DB id
      apiClientMock.post.mockResolvedValueOnce({
        data: {
          items: [
            {group_id: rawIdFromDb, group_name: 'Test Group'}
          ]
        }
      });

      const userGroups = await getUserGroups();
      const groupId = userGroups.data.items[0].group_id;
      
      expect(groupId).toBe(rawIdFromDb);

      // 2. Simulate what Next.js Router does (sometimes encodes the param)
      const routerParamId = encodeURIComponent(groupId);
      expect(routerParamId).toBe('QuaPTl_4vNRsXyJv2tEhsiAw01iD%3D');

      // 3. User visits group page, passing the router-encoded param to permission check
      apiClientMock.post.mockResolvedValueOnce({
        data: {'group.read': true}
      });

      await getGroupPermissions(routerParamId);

      // 4. Verify the permission check converted it back to RAW DB format
      expect(apiClientMock.post).toHaveBeenLastCalledWith('/v1/group/permission', {
        group_id: rawIdFromDb
      });
    });
  });
});
