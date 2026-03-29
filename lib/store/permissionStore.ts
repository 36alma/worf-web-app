'use client';

import {create} from 'zustand';
import type {PermissionMap} from '@/lib/api/permissions';

interface PermissionState {
  systemPermissions: PermissionMap;
  isSystemPermissionsLoaded: boolean;
  groupPermissionsById: Record<string, PermissionMap>;
  groupPermissionsLoadingById: Record<string, boolean>;
  setSystemPermissions: (permissions: PermissionMap) => void;
  setGroupPermissions: (groupId: string, permissions: PermissionMap) => void;
  setGroupPermissionsLoading: (groupId: string, isLoading: boolean) => void;
  clearPermissions: () => void;
}

export const usePermissionStore = create<PermissionState>((set) => ({
  systemPermissions: {},
  isSystemPermissionsLoaded: false,
  groupPermissionsById: {},
  groupPermissionsLoadingById: {},
  setSystemPermissions: (permissions) => set({systemPermissions: permissions, isSystemPermissionsLoaded: true}),
  setGroupPermissions: (groupId, permissions) =>
    set((state) => ({
      groupPermissionsById: {
        ...state.groupPermissionsById,
        [groupId]: permissions
      },
      groupPermissionsLoadingById: {
        ...state.groupPermissionsLoadingById,
        [groupId]: false
      }
    })),
  setGroupPermissionsLoading: (groupId, isLoading) =>
    set((state) => ({
      groupPermissionsLoadingById: {
        ...state.groupPermissionsLoadingById,
        [groupId]: isLoading
      }
    })),
  clearPermissions: () =>
    set({
      systemPermissions: {},
      isSystemPermissionsLoaded: false,
      groupPermissionsById: {},
      groupPermissionsLoadingById: {}
    })
}));
