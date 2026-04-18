'use client';

import {create} from 'zustand';
import type {PermissionMap} from '@/lib/api/permissions';

export type GroupPermissionStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface PermissionState {
  systemPermissions: PermissionMap;
  isSystemPermissionsLoaded: boolean;
  groupPermissionsById: Record<string, PermissionMap>;
  groupPermissionsStatusById: Record<string, GroupPermissionStatus>;
  setSystemPermissions: (permissions: PermissionMap) => void;
  setGroupPermissions: (groupId: string, permissions: PermissionMap) => void;
  setGroupPermissionsLoading: (groupId: string, isLoading: boolean) => void;
  setGroupPermissionsError: (groupId: string) => void;
  clearPermissions: () => void;
}

export const usePermissionStore = create<PermissionState>((set) => ({
  systemPermissions: {},
  isSystemPermissionsLoaded: false,
  groupPermissionsById: {},
  groupPermissionsStatusById: {},
  setSystemPermissions: (permissions) => set({systemPermissions: permissions, isSystemPermissionsLoaded: true}),
  setGroupPermissions: (groupId, permissions) =>
    set((state) => ({
      groupPermissionsById: {
        ...state.groupPermissionsById,
        [groupId]: permissions
      },
      groupPermissionsStatusById: {
        ...state.groupPermissionsStatusById,
        [groupId]: 'loaded'
      }
    })),
  setGroupPermissionsLoading: (groupId, isLoading) =>
    set((state) => ({
      groupPermissionsStatusById: {
        ...state.groupPermissionsStatusById,
        [groupId]: isLoading ? 'loading' : state.groupPermissionsStatusById[groupId] ?? 'idle'
      }
    })),
  setGroupPermissionsError: (groupId) =>
    set((state) => ({
      groupPermissionsStatusById: {
        ...state.groupPermissionsStatusById,
        [groupId]: 'error'
      }
    })),
  clearPermissions: () =>
    set({
      systemPermissions: {},
      isSystemPermissionsLoaded: false,
      groupPermissionsById: {},
      groupPermissionsStatusById: {}
    })
}));
