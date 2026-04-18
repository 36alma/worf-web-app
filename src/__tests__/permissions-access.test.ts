import {describe, expect, it} from 'vitest';
import {
  groupNavPermissionRequirements,
  hasPermissionRequirement,
  navPermissionRequirements,
} from '@/lib/permissions/access';

describe('hasPermissionRequirement', () => {
  it('keeps group navigation visible in explicit mode while permissions are unresolved', () => {
    expect(
      hasPermissionRequirement({}, {anyOf: ['group.post.read']}, {mode: 'explicit'})
    ).toBe(true);
  });

  it('hides group navigation in explicit mode only when every relevant permission is false', () => {
    expect(
      hasPermissionRequirement(
        {
          'group.calendar.read': false,
          'group.calendar.write': false,
        },
        {anyOf: ['group.calendar.read', 'group.calendar.write']},
        {mode: 'explicit'}
      )
    ).toBe(false);
  });

  it('still treats missing permissions as denied in strict mode', () => {
    expect(hasPermissionRequirement({}, {anyOf: ['group.post.read']})).toBe(false);
  });
});

describe('group sidebar navigation config', () => {
  it('keeps roles and permissions entries in group scope only', () => {
    expect(navPermissionRequirements.roles).toBe('GROUP_ONLY');
    expect(navPermissionRequirements.permissions).toBe('GROUP_ONLY');
    expect(groupNavPermissionRequirements.roles).toEqual({anyOf: ['group.role.get']});
    expect(groupNavPermissionRequirements.permissions).toEqual({anyOf: ['group.permission.get.all']});
  });
});
