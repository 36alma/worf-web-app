'use client';

import {useEffect, useState} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import {GroupTabsContainer} from './components/GroupTabsContainer';
import {getGroup, getGroupMembers} from '@/lib/api/groups';

export default function GroupDetailPage() {
  const {groupId, isLoading: permissionsLoading} = useGroupPermission();
  const [groupData, setGroupData] = useState<any>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    
    const fetchMetadata = async () => {
      try {
        setIsLoadingMetadata(true);
        // Fetch group data
        const groupRes = await getGroup(groupId);
        const group = groupRes.data?.data || groupRes.data;
        if (group) setGroupData(group);

        // Fetch members for count
        const membersRes = await getGroupMembers(groupId);
        const members = Array.isArray(membersRes.data) ? membersRes.data : membersRes.data?.users || membersRes.data?.data || [];
        setMemberCount(members.length);
      } catch (error) {
        console.error('Failed to fetch group metadata:', error);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [groupId]);

  if (permissionsLoading || isLoadingMetadata) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto mt-6">
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        <div className="flex gap-6">
          <div className="w-48 h-64 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
          <div className="flex-1 h-96 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        </div>
      </div>
    );
  }

  // Get first letter of group name for monogram
  const groupName = groupData?.name || groupData?.group_name || 'Csoport';
  const monogram = groupName.charAt(0).toUpperCase();
  // Format creation date if available
  const createdDate = groupData?.created_at 
    ? new Date(groupData.created_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Ismeretlen';

  return (
    <div className="max-w-6xl mx-auto space-y-6 mt-4">
      {/* Page Header */}
      <div className="flex items-center gap-4 bg-[#1a1a1a] border border-white/5 p-6 rounded-xl">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent text-white text-2xl font-medium">
          {monogram}
        </div>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {groupName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-fg-secondary mt-1">
            <span>Létrehozva: {createdDate}</span>
            <span>&middot;</span>
            <span>{memberCount} tag</span>
          </div>
        </div>
      </div>
      
      {/* Tabs / Sidebar Layout */}
      <GroupTabsContainer groupData={groupData} />
    </div>
  );
}
