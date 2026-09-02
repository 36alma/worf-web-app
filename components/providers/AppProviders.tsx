'use client';

import {ReactNode, useEffect} from 'react';
import {Toaster} from 'react-hot-toast';
import {usePathname} from 'next/navigation';
import {getUserPermissions} from '@/lib/api/permissions';
import {getCurrentUserProfile} from '@/lib/api/user';
import {useAuthStore} from '@/lib/store/authStore';
import {usePermissionStore} from '@/lib/store/permissionStore';

export default function AppProviders({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const {setUser, setLoading, logout} = useAuthStore();
  const {setSystemPermissions, clearPermissions} = usePermissionStore();

  useEffect(() => {
    // Public routes: /auth/* (login/register flows) and /{locale}/shared/*
    // (the unauthenticated share-link landing page, Task 33) must never
    // trigger the authenticated-user bootstrap below — for a logged-out
    // visitor, getCurrentUserProfile() 401s and the apiClient interceptor
    // hard-redirects to /auth/login, which would bounce a share-link
    // recipient away from the page before they ever see it. Anchored (not a
    // bare substring check) so a hypothetical future route that merely
    // *contains* "/shared/" somewhere in its path (e.g. "/files/shared/by-
    // me") can't silently and unintentionally lose the auth bootstrap too.
    // '/{locale}/shared/' does not match '/files/shared-with-me' (Task 23),
    // which has a hyphen after "shared", not a slash.
    const isPublicRoute = pathname.includes('/auth/') || /^\/[^/]+\/shared\//.test(pathname);
    if (isPublicRoute) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      try {
        const {data} = await getCurrentUserProfile();
        if (mounted) {
          setUser(data?.data ?? data);
        }

        try {
          const permissions = await getUserPermissions();
          if (mounted) {
            setSystemPermissions(permissions);
          }
        } catch {
          if (mounted) {
            setSystemPermissions({});
          }
        }
      } catch {
        if (mounted) {
          clearPermissions();
          logout();
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [pathname, setUser, setLoading, logout, setSystemPermissions, clearPermissions]);

  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        containerClassName="toast-viewport"
        toastOptions={{
          className: 'toast toast-root',
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderLeft: '3px solid var(--info)',
            borderRadius: 'var(--radius-lg)'
          }
        }}
      />
    </>
  );
}
