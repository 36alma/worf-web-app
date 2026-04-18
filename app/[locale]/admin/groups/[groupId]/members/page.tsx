import UserGroupRolesAssignment from '@/components/admin/UserGroupRolesAssignment';
import {normalizeGroupId} from '@/lib/utils/groupId';

export default async function GroupMembersPage({
  params
}: {
  params: Promise<{groupId: string}>;
}) {
  const {groupId: rawGroupId} = await params;
  const groupId = normalizeGroupId(rawGroupId);

  return (
    <div className="h-full w-full">
      <div className="space-y-4">
        <UserGroupRolesAssignment groupId={groupId} />
      </div>
    </div>
  );
}
