'use client';

import {create} from 'zustand';

export interface UserProfile {
  id?: string;
  username?: string;
  email?: string;
  fullname?: string;
  avatar?: string;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({user, isAuthenticated: true, isLoading: false}),
  setLoading: (isLoading) => set({isLoading}),
  logout: () => set({user: null, isAuthenticated: false, isLoading: false})
}));
