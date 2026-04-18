'use client';

import { useEffect, useState } from 'react';
import { getGroupPermissions } from '@/lib/api/permissions';
import { hasPermissionRequirement } from '@/lib/permissions/access';
import GroupCalendarContent from './GroupCalendarContent';

interface ClientCalendarWrapperProps {
  groupId: string;
}

export default function ClientCalendarWrapper({ groupId }: ClientCalendarWrapperProps) {
  const [permissions, setPermissions] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    getGroupPermissions(groupId)
      .then((perms) => {
        if (isMounted) setPermissions(perms);
      })
      .catch((err) => {
        console.error(`Failed to load permissions for group ${groupId}:`, err);
        if (isMounted) setError(true);
      });
      
    return () => {
      isMounted = false;
    };
  }, [groupId]);

  if (error) {
    return null; // Silent policy
  }

  if (!permissions) {
    return null; // Loading state (silent)
  }

  const canRead = hasPermissionRequirement(permissions, {
    anyOf: ['group.calendar.read', 'group.calendar.event.read']
  });

  if (!canRead) {
    return null;
  }

  return <GroupCalendarContent groupId={groupId} permissions={permissions} />;
}
