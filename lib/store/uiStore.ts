'use client';

import {create} from 'zustand';

interface UiState {
  mobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileSidebarOpen: false,
  toggleSidebar: () => set((state) => ({mobileSidebarOpen: !state.mobileSidebarOpen})),
  setSidebarOpen: (open) => set({mobileSidebarOpen: open})
}));
