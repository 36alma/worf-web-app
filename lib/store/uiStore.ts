'use client';

import {create} from 'zustand';

interface UiState {
  mobileSidebarOpen: boolean;
  selectedGroupId: string;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedGroupId: (groupId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileSidebarOpen: false,
  selectedGroupId: '',
  toggleSidebar: () => set((state) => ({mobileSidebarOpen: !state.mobileSidebarOpen})),
  setSidebarOpen: (open) => set({mobileSidebarOpen: open}),
  setSelectedGroupId: (groupId) => set({selectedGroupId: groupId})
}));
