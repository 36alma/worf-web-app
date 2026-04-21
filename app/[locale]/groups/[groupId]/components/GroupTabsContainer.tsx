'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { GroupGeneralTab } from './GroupGeneralTab';
import { GroupMembersTab } from './GroupMembersTab';
import { GroupRolesTab } from './GroupRolesTab';

export function GroupTabsContainer() {
  const { hasPermission } = useGroupPermission();
  const canGetRoles = hasPermission('group.role.get');

  return (
    <div className="mt-4">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">Általános</TabsTrigger>
          <TabsTrigger value="members">Tagok</TabsTrigger>
          {canGetRoles && <TabsTrigger value="roles">Szerepkörök</TabsTrigger>}
        </TabsList>
        
        <div className="mt-4">
          <TabsContent value="general" className="mt-0 outline-none">
            <GroupGeneralTab />
          </TabsContent>
          <TabsContent value="members" className="mt-0 outline-none">
            <GroupMembersTab />
          </TabsContent>
          {canGetRoles && (
            <TabsContent value="roles" className="mt-0 outline-none">
              <GroupRolesTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
