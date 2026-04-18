'use client';

import {useEffect, useState} from 'react';
import type {CalendarPermissionsState, SupportedLocale} from '../types';
import {normalizePermissionMap} from '../utils/calendarMappers';
import {worfFetch} from '../utils/worfCalendarClient';

interface UseCalendarPermissionsOptions {
  groupId: string;
  locale: SupportedLocale;
}

const initialState: CalendarPermissionsState = {
  isLoading: true,
  userPermissions: {},
  groupPermissions: {},
  canRead: false,
  canManageEvents: false,
  canManageCalendars: false
};

export function useCalendarPermissions({groupId, locale}: UseCalendarPermissionsOptions) {
  const [state, setState] = useState<CalendarPermissionsState>(initialState);

  useEffect(() => {
    let mounted = true;

    const loadPermissions = async () => {
      setState(initialState);

      try {
        // Bearer is NOT included — the proxy injects it server-side.
        const [userPayload, groupPayload] = await Promise.all([
          worfFetch({
            path: '/v1/user/permission',
            locale,
            body: {},
            silentError: true
          }),
          worfFetch({
            path: '/v1/group/permission',
            locale,
            body: {
              group_id: groupId
            },
            silentError: true
          })
        ]);

        if (!mounted) {
          return;
        }

        const userPermissions = normalizePermissionMap(userPayload);
        const groupPermissions = normalizePermissionMap(groupPayload);

        setState({
          isLoading: false,
          userPermissions,
          groupPermissions,
          canRead: groupPermissions['group.calendar.read'] === true,
          canManageEvents: groupPermissions['group.calendar.event.write'] === true,
          canManageCalendars: groupPermissions['group.calendar.write'] === true
        });
      } catch {
        if (!mounted) {
          return;
        }

        setState({
          ...initialState,
          isLoading: false
        });
      }
    };

    void loadPermissions();

    return () => {
      mounted = false;
    };
  }, [groupId, locale]);

  return state;
}
