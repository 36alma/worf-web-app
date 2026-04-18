import GroupRolesManager from '@/components/admin/GroupRolesManager';
import {normalizeGroupId} from '@/lib/utils/groupId';

export default async function GroupRolePage({
  params
}: {
  params: Promise<{groupId: string}>;
}) {
  const {groupId: rawGroupId} = await params;
  const groupId = normalizeGroupId(rawGroupId);

  return (
    <div className="h-full w-full">
      <div className="space-y-4">
        <GroupRolesManager groupId={groupId} />
      </div>
    </div>
  );
}
