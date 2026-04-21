'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trash2, UserPlus, Users, Loader2 } from 'lucide-react';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import { 
  getGroupMembers, 
  addUserToGroup, 
  removeUserFromGroup, 
  getGroupRolesNonAdmin,
  modifyGroupMemberRoleNonAdmin
} from '@/lib/api/groups';
import { usePermissionStore } from '@/lib/store/permissionStore';
import { useAuthStore } from '@/lib/store/authStore';
import Button from '@/components/ui/Button';

import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import toast from 'react-hot-toast';

export function GroupMembersTab() {
  const { groupId, hasPermission } = useGroupPermission();
  const { systemPermissions } = usePermissionStore();
  const { user } = useAuthStore();
  
  // Data States
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Permissions (Silent Policy)
  // Check both group-level and system-level permissions.
  // Fallback: If user is a "Leader", allow member management for better UX.
  const isLeader = members.find(m => (m.user_id || m.id) === user?.id)?.group_role_name?.toLowerCase().includes('leader');
  
  const canAdd = hasPermission('group.create.add.usertogroup') || 
                 systemPermissions['group.create.add.usertogroup'] || 
                 isLeader;
                 
  const canRemove = hasPermission('group.delete.remove.userfromgroup') || 
                    systemPermissions['group.delete.remove.userfromgroup'] || 
                    isLeader;
                    
  const canModifyRole = hasPermission('group.role.modify') || 
                        systemPermissions['group.role.modify'] || 
                        isLeader;

  const fetchMembers = useCallback(async () => {
    try {
      const res = await getGroupMembers(groupId);
      const data = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.data || [];
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members', err);
      toast.error('Nem sikerült betölteni a tagokat');
    }
  }, [groupId]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await getGroupRolesNonAdmin(groupId);
      const data = Array.isArray(res.data) 
        ? res.data 
        : res.data?.group_roles || res.data?.roles || res.data?.data || [];
      setRoles(data);
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  }, [groupId]);

  const initData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchMembers(), fetchRoles()]);
    setIsLoading(false);
  }, [fetchMembers, fetchRoles]);

  useEffect(() => {
    initData();
  }, [initData]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = newUserId.trim();
    if (!userId) return;

    try {
      setIsAdding(true);
      await addUserToGroup(groupId, userId);
      toast.success('Tag sikeresen hozzáadva');
      setIsAddModalOpen(false);
      setNewUserId('');
      fetchMembers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Hiba történt a tag hozzáadásakor';
      toast.error(msg);
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const userId = memberToRemove.user_id || memberToRemove.id;
    
    try {
      setIsRemoving(true);
      await removeUserFromGroup(groupId, userId);
      toast.success('Tag sikeresen eltávolítva');
      setMemberToRemove(null);
      fetchMembers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Hiba történt a tag eltávolításakor';
      toast.error(msg);
      console.error(err);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    try {
      setUpdatingMemberId(userId);
      await modifyGroupMemberRoleNonAdmin({
        group_id: groupId,
        user_id: userId,
        group_role_id: newRoleId
      });
      toast.success('Szerepkör sikeresen módosítva');
      fetchMembers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Hiba történt a szerepkör módosításakor';
      toast.error(msg);
      console.error(err);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Users className="text-orange-500" size={20} />
            Csoport Tagok
          </h2>
          <p className="text-sm text-gray-400 mt-1">A csoport tagjainak kezelése és jogosultságaik kiosztása.</p>
        </div>
        {canAdd && (
          <Button 
            onClick={() => setIsAddModalOpen(true)} 
            startIcon={<UserPlus size={18} />} 
            className="bg-orange-500 hover:bg-orange-600 text-white border-none shadow-lg shadow-orange-500/20 px-6"
          >
            Tag Hozzáadása
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Felhasználó</th>
                <th className="px-6 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Szerepkör</th>
                <th className="w-20 px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                      <span className="text-gray-500 font-medium">Tagok betöltése...</span>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Users size={48} className="text-gray-500 mb-2" />
                      <p className="text-gray-400 font-medium text-base">Nincsenek tagok a csoportban</p>
                      <p className="text-gray-500 text-sm">Vegyél fel új tagokat a fenti gombbal.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const userId = member.user_id || member.id;
                  const isUpdating = updatingMemberId === userId;
                  
                  return (
                    <tr key={userId} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center text-orange-500 border border-orange-500/10 font-bold text-sm">
                            {(member.name || member.user_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate max-w-[200px]">
                              {member.name || member.user_name || 'Ismeretlen'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-[150px]">
                              {userId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="max-w-[200px]">
                          <Select
                            disabled={!canModifyRole || isUpdating}
                            defaultValue={member.group_role_id}
                            onValueChange={(val) => handleRoleChange(userId, val)}
                          >
                            <SelectTrigger className="h-9 bg-[#1a1a1a] border-white/5 hover:border-white/10 transition-all">
                              <SelectValue placeholder="Válassz szerepkört" />
                              {isUpdating && <Loader2 size={14} className="ml-2 animate-spin text-orange-500" />}
                            </SelectTrigger>
                            <SelectContent className="bg-[#1c1c1c] border-white/10">
                              {roles.map((role) => (
                                <SelectItem key={role.group_role_id} value={role.group_role_id}>
                                  {role.group_role_name || role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {canRemove && (
                          <button
                            onClick={() => setMemberToRemove(member)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-90"
                            title="Tag eltávolítása"
                          >
                            <Trash2 size={18} strokeWidth={1.75} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hozzáadás Dialog */}
      {canAdd && (
        <Modal 
          open={isAddModalOpen} 
          title="Tag Hozzáadása" 
          onClose={() => setIsAddModalOpen(false)}
        >
          <form onSubmit={handleAddMember} className="space-y-6 pt-2">
            <div className="space-y-2">
              <label htmlFor="user_id" className="text-sm font-medium text-gray-300">
                Felhasználó Azonosító (ID)
              </label>
              <Input
                id="user_id"
                autoFocus
                placeholder="Pl. user-1234-abcd"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                required
                className="bg-[#0c0c0c]"
              />
              <p className="text-[11px] text-gray-500">
                Add meg a felhasználó egyedi azonosítóját a csoporthoz való csatlakozáshoz.
              </p>
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
                className="bg-orange-500 hover:bg-orange-600 text-white border-none min-w-[120px] shadow-lg shadow-orange-500/20" 
                disabled={!newUserId.trim() || isAdding}
              >
                {isAdding ? <Loader2 size={18} className="animate-spin" /> : 'Hozzáadás'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Eltávolítás AlertDialog */}
      {canRemove && (
        <ConfirmDialog
          open={!!memberToRemove}
          title="Tag Eltávolítása"
          message={`Biztosan el szeretnéd távolítani ezt a felhasználót a csoportból (${memberToRemove?.name || memberToRemove?.user_name || memberToRemove?.id || memberToRemove?.user_id})? Ez a művelet nem vonható vissza.`}
          cancelLabel="Mégse"
          confirmLabel={isRemoving ? 'Eltávolítás...' : 'Igen, eltávolítás'}
          onCancel={() => setMemberToRemove(null)}
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  );
}
