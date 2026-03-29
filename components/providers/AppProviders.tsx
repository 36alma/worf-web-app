'use client';

import {ReactNode, useEffect} from 'react';
import {Toaster} from 'react-hot-toast';
import apiClient from '@/lib/api/client';
import {getUserPermissions} from '@/lib/api/permissions';
import {useAuthStore} from '@/lib/store/authStore';
import {usePermissionStore} from '@/lib/store/permissionStore';

export default function AppProviders({children}: {children: ReactNode}) {
  const {setUser, setLoading, logout} = useAuthStore();
  const {setSystemPermissions, clearPermissions} = usePermissionStore();

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {data} = await apiClient.get('/v1/user/editprofile');
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
  }, [setUser, setLoading, logout, setSystemPermissions, clearPermissions]);

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111118',
            color: '#f1f5f9',
            border: '1px solid #1e1e2e'
          }
        }}
      />
    </>
  );
}
