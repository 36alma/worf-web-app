'use client';

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';

interface UiState {
  mobileSidebarOpen: boolean;
  selectedGroupId: string;
  selectedGroupName: string;
  _lastUpdated?: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedGroupId: (groupId: string, groupName?: string) => void;
}

const customStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      const parsed = JSON.parse(str);
      const state = parsed.state;
      if (state && state._lastUpdated) {
        if (Date.now() - state._lastUpdated > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(name);
          return null;
        }
      }
      return str;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window !== 'undefined') localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window !== 'undefined') localStorage.removeItem(name);
  }
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mobileSidebarOpen: false,
      selectedGroupId: '',
      selectedGroupName: '',
      toggleSidebar: () => set((state) => ({mobileSidebarOpen: !state.mobileSidebarOpen})),
      setSidebarOpen: (open) => set({mobileSidebarOpen: open}),
      setSelectedGroupId: (groupId, groupName) => set((state) => {
        if (!groupId) {
          return { selectedGroupId: '', selectedGroupName: '', _lastUpdated: Date.now() };
        }
        return {
          selectedGroupId: groupId,
          selectedGroupName: groupName !== undefined ? groupName : state.selectedGroupName,
          _lastUpdated: Date.now()
        };
      })
    }),
    {
      name: 'worf-ui-store',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({
        selectedGroupId: state.selectedGroupId,
        selectedGroupName: state.selectedGroupName,
        _lastUpdated: state._lastUpdated
      })
    }
  )
);
