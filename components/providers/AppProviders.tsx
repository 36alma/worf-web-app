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
    const isAuthRoute = pathname.includes('/auth/');
    if (isAuthRoute) {
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
