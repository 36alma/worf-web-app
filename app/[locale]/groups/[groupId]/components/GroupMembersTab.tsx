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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">Csoport Tagok</h2>
          <p className="text-sm text-gray-400">A csoport tagjainak és szerepköreinek kezelése.</p>
        </div>
        {canAdd && (
          <Button 
            onClick={() => setIsAddModalOpen(true)} 
            startIcon={<UserPlus size={16} />} 
            className="bg-orange-500 hover:bg-orange-600 text-white border-none shadow-lg shadow-orange-500/20"
          >
            Új Tag
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-400">Név / ID</th>
              <th className="px-6 py-4 font-medium text-gray-400">Szerepkör</th>
              {canRemove && <th className="w-16 px-6 py-4 text-right"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={canRemove ? 3 : 2} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                    Betöltés...
                  </div>
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={canRemove ? 3 : 2} className="px-6 py-12 text-center text-gray-500">
                  Nincsenek tagok a csoportban.
                </td>
              </tr>
            ) : (
              members.map((member, i) => (
                <tr key={member.id || member.user_id || i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-white">
                    <div className="font-medium text-base">{member.name || member.user_name || 'Ismeretlen'}</div>
                    <div className="text-xs text-gray-500 mt-1 font-mono">{member.id || member.user_id}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium border border-white/10">
                      {member.group_role_name || 'Alapértelmezett'}
                    </span>
                  </td>
                  {canRemove && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setMemberToRemove(member)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Tag eltávolítása"
                      >
                        <Trash2 size={18} strokeWidth={1.75} />
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
              <label htmlFor="user_id" className="text-sm font-medium text-gray-300">
                Felhasználó ID
              </label>
              <input
                id="user_id"
                autoFocus
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="Pl. user-1234-abcd"
                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="secondary" 
                className="bg-white/5 hover:bg-white/10 border-white/10 text-white" 
                onClick={() => setIsAddModalOpen(false)}
              >
                Mégse
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-500 hover:bg-orange-600 text-white border-none disabled:bg-orange-500/50" 
                disabled={!newUserId.trim() || isAdding}
              >
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
          message={`Biztosan el szeretnéd távolítani ezt a felhasználót a csoportból (${memberToRemove?.name || memberToRemove?.id || memberToRemove?.user_id})?`}
          cancelLabel="Mégse"
          confirmLabel={isRemoving ? 'Eltávolítás...' : 'Eltávolítás'}
          onCancel={() => setMemberToRemove(null)}
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  );
}
