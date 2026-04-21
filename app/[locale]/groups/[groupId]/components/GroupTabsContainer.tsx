'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { GroupGeneralTab } from './GroupGeneralTab';
import { GroupMembersTab } from './GroupMembersTab';
import { GroupRolesTab } from './GroupRolesTab';
import { Settings, Users, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GroupTabsContainerProps {
  groupData?: any;
}

export function GroupTabsContainer({ groupData }: GroupTabsContainerProps) {
  const t = useTranslations('group_detail.tabs');
  const { hasPermission } = useGroupPermission();
  const canGetRoles = hasPermission('group.role.get');

  return (
    <div className="mt-6">
      <Tabs defaultValue="general" className="flex flex-col md:flex-row gap-6" orientation="vertical">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0">
          <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-1 items-stretch">
            <TabsTrigger 
              value="general" 
              className="justify-start px-4 py-3 h-auto text-base text-gray-400 font-medium data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-none rounded-none border-l-2 border-transparent data-[state=active]:border-orange-500 hover:bg-white/5 transition-colors"
            >
              <Settings className="w-5 h-5 mr-3" />
              {t('general')}
            </TabsTrigger>
            <TabsTrigger 
              value="members" 
              className="justify-start px-4 py-3 h-auto text-base text-gray-400 font-medium data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-none rounded-none border-l-2 border-transparent data-[state=active]:border-orange-500 hover:bg-white/5 transition-colors"
            >
              <Users className="w-5 h-5 mr-3" />
              {t('members')}
            </TabsTrigger>
            {canGetRoles && (
              <TabsTrigger 
                value="roles" 
                className="justify-start px-4 py-3 h-auto text-base text-gray-400 font-medium data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-none rounded-none border-l-2 border-transparent data-[state=active]:border-orange-500 hover:bg-white/5 transition-colors"
              >
                <Shield className="w-5 h-5 mr-3" />
                {t('roles')}
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 min-w-0 bg-[#1a1a1a] ring-1 ring-white/5 rounded-xl p-6">
          <TabsContent value="general" className="mt-0 outline-none">
            <GroupGeneralTab groupData={groupData} />
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
