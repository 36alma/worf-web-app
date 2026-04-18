'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermissionRequirement } from '@/lib/permissions/access';
import { CalendarProvider } from '@/src/contexts/CalendarContext';
import CalendarLayout from '@/src/components/calendar/CalendarLayout';

interface GroupCalendarContentProps {
  groupId: string;
  permissions: Record<string, any>;
}

/**
 * Client component for rendering the group calendar.
 * 
 * Receives groupId and permissions as guaranteed props from the server component.
 * Handles UI rendering, interactions, and write-gated actions.
 * 
 * The groupId is _never_ re-derived or re-fetched here — it comes from parent props only.
 */
export default function GroupCalendarContent({
  groupId,
  permissions
}: GroupCalendarContentProps) {
  const { user } = useAuthStore();

  // Token retrieval from auth store or localStorage
  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      for (const key of ['worf_access_token', 'access_token', 'token']) {
        const candidate = window.localStorage.getItem(key);
        if (candidate?.trim()) {
          return candidate.trim();
        }
      }
    }
    const authToken = (user as { access_token?: string; token?: string } | null)?.access_token ??
      (user as { token?: string } | null)?.token;
    return typeof authToken === 'string' ? authToken : '';
  }, [user]);

  // Calculate write permission
  const canWrite = hasPermissionRequirement(permissions, {
    anyOf: ['group.calendar.event.write', 'group.calendar.write']
  });

  return (
    <CalendarProvider groupId={groupId} token={token}>
      <section className="space-y-4">
        <h1 className="display-font text-2xl">Group Calendar</h1>
        <CalendarLayout
          groupId={groupId}
          canWrite={canWrite}
        />
      </section>
    </CalendarProvider>
  );
}
