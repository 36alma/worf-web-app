'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import { getGroupMembers, addUserToGroup, removeUserFromGroup } from '@/lib/api/groups';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

export function GroupMembersTab() {
  const { groupId, hasPermission } = useGroupPermission();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // States for Remove Confirm
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const canAdd = hasPermission('group.create.add.usertogroup');
  const canRemove = hasPermission('group.delete.remove.userfromgroup');

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const res = await getGroupMembers(groupId);
      // Assuming array is directly returned or in res.data
      const data = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.data || [];
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;
    try {
      setIsAdding(true);
      await addUserToGroup(groupId, newUserId.trim());
      toast.success('Tag sikeresen hozzáadva');
      setIsAddModalOpen(false);
      setNewUserId('');
      fetchMembers();
    } catch (err) {
      toast.error('Hiba történt a tag hozzáadásakor');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setIsRemoving(true);
      await removeUserFromGroup(groupId, memberToRemove.id || memberToRemove.user_id);
      toast.success('Tag sikeresen eltávolítva');
      setMemberToRemove(null);
      fetchMembers();
    } catch (err) {
      toast.error('Hiba történt a tag eltávolításakor');
      console.error(err);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Csoport Tagok</h2>
        {canAdd && (
          <Button onClick={() => setIsAddModalOpen(true)} startIcon={<UserPlus size={16} />} className="p-2">
            Új Tag
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <tr>
              <th className="px-4 py-3 font-medium text-[var(--text-tertiary)]">Név / ID</th>
              <th className="px-4 py-3 font-medium text-[var(--text-tertiary)]">Szerepkör</th>
              {canRemove && <th className="w-10 px-4 py-3 text-right"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canRemove ? 3 : 2} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                  Betöltés...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={canRemove ? 3 : 2} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                  Nincsenek tagok a csoportban.
                </td>
              </tr>
            ) : (
              members.map((member, i) => (
                <tr key={member.id || member.user_id || i} className="border-b border-[var(--border-subtle)] last:border-none hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    <div className="font-medium">{member.name || member.user_name || 'Ismeretlen'}</div>
                    <div className="text-xs text-[var(--text-tertiary)] opacity-75">{member.id || member.user_id}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {member.group_role_name || '-'}
                  </td>
                  {canRemove && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setMemberToRemove(member)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Tag eltávolítása"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Hozzáadás Modál */}
      {canAdd && (
        <Modal open={isAddModalOpen} title="Új Tag Hozzáadása" onClose={() => setIsAddModalOpen(false)}>
          <form onSubmit={handleAddMember} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="user_id" className="text-sm font-medium text-[var(--text-secondary)]">
                Felhasználó ID
              </label>
              <input
                id="user_id"
                autoFocus
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="Pl. user-1234-abcd"
                className="w-full rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" className="p-2" onClick={() => setIsAddModalOpen(false)}>
                Mégse
              </Button>
              <Button type="submit" variant="primary" className="p-2" disabled={!newUserId.trim() || isAdding}>
                {isAdding ? 'Hozzáadás...' : 'Hozzáadás'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Törlés Megerősítés */}
      {canRemove && (
        <ConfirmDialog
          open={!!memberToRemove}
          title="Tag Eltávolítása"
          message={`Biztosan el szeretnéd távolítani ezt a felhasználót a csoportból (${memberToRemove?.name || memberToRemove?.id || memberToRemove?.user_id})? Ezt a műveletet később vissza lehet vonni újbóli hozzáadással.`}
          cancelLabel="Mégse"
          confirmLabel={isRemoving ? 'Eltávolítás...' : 'Eltávolítás'}
          onCancel={() => setMemberToRemove(null)}
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  );
}
