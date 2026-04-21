'use client';

import { useEffect, useState } from 'react';
import { Settings, ShieldPlus, Trash2, Edit2 } from 'lucide-react';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import {
  getGroupRolesNonAdmin,
  createGroupRoleNonAdmin,
  modifyGroupRoleNonAdmin,
  deleteGroupRoleNonAdmin,
  getAllPermissionsNonAdmin,
  setFixedRolePermissionsNonAdmin
} from '@/lib/api/groups';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SideSheet from '@/components/ui/SideSheet';
import { Switch } from '@/components/ui/Switch';
import toast from 'react-hot-toast';

export function GroupRolesTab() {
  const { groupId, hasPermission } = useGroupPermission();

  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal: Create & Edit
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [actingRole, setActingRole] = useState<any | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Delete
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions Settings Sheet
  const [isPermsSheetOpen, setIsPermsSheetOpen] = useState(false);
  const [roleForPerms, setRoleForPerms] = useState<any | null>(null);
  const [allPerms, setAllPerms] = useState<any[]>([]);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  const canGetRoles = hasPermission('group.role.get');
  const canCreate = hasPermission('group.role.create');
  const canModify = hasPermission('group.role.modify');
  const canDelete = hasPermission('group.role.delete');
  const canGetPerms = hasPermission('group.permission.get.all');
  const canSetPerms = hasPermission('group.role.permission.set.fixed');

  const fetchRoles = async () => {
    if (!canGetRoles) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await getGroupRolesNonAdmin(groupId);
      // Fix: look for group_roles in the payload
      const data = Array.isArray(res.data) 
        ? res.data 
        : res.data?.group_roles || res.data?.roles || res.data?.data || [];
      setRoles(data);
    } catch (err) {
      console.error('Failed to fetch roles', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, canGetRoles]);

  // Load permissions when sheet opens
  const fetchAllPermissions = async () => {
    if (!canGetPerms) return;
    try {
      setIsLoadingPerms(true);
      const res = await getAllPermissionsNonAdmin();
      const permsData = Array.isArray(res.data) ? res.data : res.data?.permissions || res.data?.data || [];
      setAllPerms(permsData);
    } catch (err) {
      console.error('Failed to fetch permissions', err);
    } finally {
      setIsLoadingPerms(false);
    }
  };

  const openCreateModal = () => {
    setActingRole(null);
    setRoleName('');
    setRoleDesc('');
    setIsRoleModalOpen(true);
  };

  const openEditModal = (role: any) => {
    setActingRole(role);
    setRoleName(role.group_role_name || role.name || '');
    setRoleDesc(role.group_role_description || role.description || '');
    setIsRoleModalOpen(true);
  };

  const openPermissionsSheet = (role: any) => {
    setRoleForPerms(role);
    
    // Set initially checked perms based on role.group_permissions array
    const activeIds = new Set<string>();
    const rolePermArray = role.group_permissions || role.permissions || [];
    rolePermArray.forEach((p: any) => {
      const pId = typeof p === 'string' ? p : p.group_permission_id || p.id;
      if (pId) activeIds.add(pId);
    });
    setSelectedPermIds(activeIds);

    setIsPermsSheetOpen(true);
    if (allPerms.length === 0) fetchAllPermissions();
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    try {
      setIsSubmittingRole(true);
      if (actingRole) {
        // Edit
        await modifyGroupRoleNonAdmin({
          group_id: groupId,
          role_id: actingRole.group_role_id || actingRole.id,
          name: roleName.trim(),
          description: roleDesc.trim() || undefined
        });
        toast.success('Szerepkör frissítve');
      } else {
        // Create
        await createGroupRoleNonAdmin({
          group_id: groupId,
          name: roleName.trim(),
          description: roleDesc.trim() || undefined
        });
        toast.success('Szerepkör létrehozva');
      }
      setIsRoleModalOpen(false);
      fetchRoles();
    } catch (err) {
      console.error(err);
      toast.error('Hiba történt a mentés során');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      setIsDeleting(true);
      await deleteGroupRoleNonAdmin(groupId, roleToDelete.group_role_id || roleToDelete.id);
      toast.success('Szerepkör törölve');
      setRoleToDelete(null);
      fetchRoles();
    } catch (err) {
      console.error(err);
      toast.error('Hiba történt a törlés során');
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePermission = (permId: string, checked: boolean) => {
    const next = new Set(selectedPermIds);
    if (checked) next.add(permId);
    else next.delete(permId);
    setSelectedPermIds(next);
  };

  const handleSavePermissions = async () => {
    if (!roleForPerms) return;
    try {
      setIsSavingPerms(true);
      await setFixedRolePermissionsNonAdmin({
        group_id: groupId,
        group_role_id: roleForPerms.group_role_id || roleForPerms.id,
        permission_ids: Array.from(selectedPermIds)
      });
      toast.success('Jogosultságok elmentve');
      setIsPermsSheetOpen(false);
      fetchRoles(); // Refresh the list so new permissions are cached
    } catch (err) {
      console.error(err);
      toast.error('Nem sikerült elmenteni a jogokat');
    } finally {
      setIsSavingPerms(false);
    }
  };

  if (!canGetRoles) {
    return null; // Silent Policy: nem is jelenítjük meg, ha nincs Get joga
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">Szerepkörök</h2>
          <p className="text-sm text-gray-400">A csoportban elérhető szerepkörök és jogosultságaik kezelése.</p>
        </div>
        {canCreate && (
          <Button 
            onClick={openCreateModal} 
            startIcon={<ShieldPlus size={16} />} 
            className="bg-orange-500 hover:bg-orange-600 text-white border-none shadow-lg shadow-orange-500/20"
          >
            Új Szerepkör
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-400">Megnevezés</th>
              <th className="px-6 py-4 font-medium text-gray-400 hidden sm:table-cell">Leírás</th>
              {(canModify || canDelete || canSetPerms) && <th className="px-6 py-4 text-right">Műveletek</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                    Betöltés...
                  </div>
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                  Nincsenek létrehozott szerepkörök.
                </td>
              </tr>
            ) : (
              roles.map((role, i) => (
                <tr key={role.group_role_id || role.id || i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-white font-medium">
                    {role.group_role_name || role.name}
                  </td>
                  <td className="px-6 py-4 text-gray-400 hidden sm:table-cell">
                    {role.group_role_description || role.description || '-'}
                  </td>
                  {(canModify || canDelete || canSetPerms) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canSetPerms && (
                          <button
                            onClick={() => openPermissionsSheet(role)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-orange-500/10 hover:text-orange-500 transition-colors"
                            title="Jogosultságok beállítása"
                          >
                            <Settings size={18} strokeWidth={1.75} />
                          </button>
                        )}
                        {canModify && (
                          <button
                            onClick={() => openEditModal(role)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-orange-500/10 hover:text-orange-500 transition-colors"
                            title="Szerkesztés"
                          >
                            <Edit2 size={18} strokeWidth={1.75} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setRoleToDelete(role)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Törlés"
                          >
                            <Trash2 size={18} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Szerepkör Létrehozás / Szerkesztés Modál */}
      {(canCreate || canModify) && (
        <Modal
          open={isRoleModalOpen}
          title={actingRole ? 'Szerepkör Szerkesztése' : 'Új Szerepkör'}
          onClose={() => setIsRoleModalOpen(false)}
        >
          <form onSubmit={handleSaveRole} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="roleName" className="text-sm font-medium text-gray-300">Név</label>
                <input
                  id="roleName"
                  autoFocus
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Pl. Moderátor"
                  required
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="roleDesc" className="text-sm font-medium text-gray-300">Leírás (Opcionális)</label>
                <input
                  id="roleDesc"
                  type="text"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Mire jogosít fel ez a szerepkör?"
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="secondary" 
                className="bg-white/5 hover:bg-white/10 border-white/10 text-white" 
                onClick={() => setIsRoleModalOpen(false)}
              >
                Mégse
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-500 hover:bg-orange-600 text-white border-none disabled:bg-orange-500/50" 
                disabled={!roleName.trim() || isSubmittingRole}
              >
                {isSubmittingRole ? 'Mentés...' : 'Mentés'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Törlés Megerősítés */}
      {canDelete && (
        <ConfirmDialog
          open={!!roleToDelete}
          title="Szerepkör Törlése"
          message={`Biztosan törölni szeretnéd a(z) "${roleToDelete?.group_role_name || roleToDelete?.name}" szerepkört? Ez a művelet nem vonható vissza, és a hozzárendelt felhasználók elveszítik ezen jogosultságaikat.`}
          cancelLabel="Mégse"
          confirmLabel={isDeleting ? 'Törlés...' : 'Törlés'}
          onCancel={() => setRoleToDelete(null)}
          onConfirm={handleDeleteRole}
        />
      )}

      {/* Jogosultságok Beállítása Sheet */}
      {canSetPerms && (
        <SideSheet
          open={isPermsSheetOpen}
          title={`Jogosultságok: ${roleForPerms?.group_role_name || roleForPerms?.name}`}
          onClose={() => setIsPermsSheetOpen(false)}
        >
          <div className="flex flex-col h-full -mx-5 px-5">
            <div className="flex-1 overflow-y-auto pb-6">
              {isLoadingPerms ? (
                <div className="py-10 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                  Jogosultságok betöltése...
                </div>
              ) : allPerms.length === 0 ? (
                <div className="py-10 text-center text-gray-500">Nem találhatók kiosztható jogok.</div>
              ) : (
                <div className="space-y-3 mt-4">
                  {allPerms.map((perm) => {
                    const permId = perm.group_permission_id || perm.id || perm.name;
                    return (
                      <div key={permId} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-[#111] transition-colors hover:bg-white/5">
                        <div className="flex flex-col pr-4">
                          <span className="text-sm font-medium text-white">
                            {perm.group_permission_name || perm.label || perm.name}
                          </span>
                          {(perm.group_permission_description || perm.description || perm.name) && (
                            <span className="text-xs text-gray-400 mt-1">
                              {perm.group_permission_description || perm.description || perm.name}
                            </span>
                          )}
                        </div>
                        <Switch
                          checked={selectedPermIds.has(permId)}
                          onCheckedChange={(checked) => togglePermission(permId, checked)}
                          className="data-[state=checked]:bg-orange-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 pt-4 pb-2 border-t border-white/10 bg-[#1a1a1a]">
              <Button 
                onClick={handleSavePermissions} 
                className="w-full justify-center p-3 bg-orange-500 hover:bg-orange-600 text-white border-none shadow-lg shadow-orange-500/20 disabled:bg-orange-500/50" 
                disabled={isLoadingPerms || isSavingPerms}
              >
                {isSavingPerms ? 'Mentés folyamatban...' : 'Változtatások Mentése'}
              </Button>
            </div>
          </div>
        </SideSheet>
      )}
    </div>
  );
}
