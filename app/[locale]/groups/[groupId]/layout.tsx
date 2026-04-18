/**
 * Group context layout — the most critical file for the groups route.
 *
 * Responsibilities:
 * 1. Extract [groupId] from the URL and safely decode it via decodeURIComponent.
 *    This ensures the Base64 padding characters (`=`) are preserved even if the
 *    browser or Next.js percent-encoded them (e.g. `%3D` → `=`).
 * 2. Wrap all children in the GroupPermissionProvider, which fetches
 *    group-level permissions on the client and exposes them via context.
 * 3. If the decoded groupId is empty/missing, redirect to the groups list.
 *
 * IMPORTANT: The groupId is NEVER modified beyond URL-decoding.
 * It is passed as-is to the backend. No hashing, no re-encoding.
 */

import {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {GroupPermissionProvider} from '@/components/providers/GroupPermissionContext';

interface GroupLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
    groupId: string;
  }>;
}

export default async function GroupLayout({children, params}: GroupLayoutProps) {
  const {locale, groupId: rawGroupId} = await params;

  // ── Safely decode the groupId ──────────────────────────────────────
  // Next.js may percent-encode the `=` characters in Base64 IDs.
  // decodeURIComponent restores the original encrypted value.
  let cleanGroupId: string;
  try {
    cleanGroupId = decodeURIComponent(rawGroupId).trim();
  } catch {
    // Invalid percent-encoding — use the raw value as-is.
    cleanGroupId = rawGroupId.trim();
  }

  // ── Validate ───────────────────────────────────────────────────────
  if (!cleanGroupId) {
    redirect(`/${locale}/groups`);
  }

  // ── Render with permission context ─────────────────────────────────
  // The GroupPermissionProvider is a client component that fetches
  // permissions and exposes them to all child routes via React context.
  return (
    <GroupPermissionProvider groupId={cleanGroupId}>
      {children}
    </GroupPermissionProvider>
  );
}
