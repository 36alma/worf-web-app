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
      const data = Array.isArray(res.data) ? res.data : res.data?.roles || res.data?.data || [];
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
    setRoleName(role.name || role.group_role_name || '');
    setRoleDesc(role.description || role.group_role_description || '');
    setIsRoleModalOpen(true);
  };

  const openPermissionsSheet = (role: any) => {
    setRoleForPerms(role);
    
    // Set initially checked perms based on role.permissions array (expected to contain ID or object with ID)
    const activeIds = new Set<string>();
    const rolePermArray = role.permissions || role.group_permissions || [];
    rolePermArray.forEach((p: any) => {
      const pId = typeof p === 'string' ? p : p.id || p.group_permission_id;
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
          role_id: actingRole.id || actingRole.group_role_id,
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
      await deleteGroupRoleNonAdmin(groupId, roleToDelete.id || roleToDelete.group_role_id);
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
        group_role_id: roleForPerms.id || roleForPerms.group_role_id,
        permission_ids: Array.from(selectedPermIds)
      });
      toast.success('Jogosultságok elmentve');
      setIsPermsSheetOpen(false);
      fetchRoles(); // Frissíti a listát, hogy az új jogok a cache objektumban meglegyenek
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Szerepkörök</h2>
        {canCreate && (
          <Button onClick={openCreateModal} startIcon={<ShieldPlus size={16} />} className="p-2">
            Új Szerepkör
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <tr>
              <th className="px-4 py-3 font-medium text-[var(--text-tertiary)]">Megnevezés</th>
              <th className="px-4 py-3 font-medium text-[var(--text-tertiary)] hidden sm:table-cell">Leírás</th>
              {(canModify || canDelete || canSetPerms) && <th className="px-4 py-3 text-right">Műveletek</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                  Betöltés...
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                  Nincsenek létrehozott szerepkörök.
                </td>
              </tr>
            ) : (
              roles.map((role, i) => (
                <tr key={role.id || role.group_role_id || i} className="border-b border-[var(--border-subtle)] last:border-none hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                    {role.name || role.group_role_name}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] hidden sm:table-cell">
                    {role.description || role.group_role_description || '-'}
                  </td>
                  {(canModify || canDelete || canSetPerms) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canSetPerms && (
                          <button
                            onClick={() => openPermissionsSheet(role)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
                            title="Jogosultságok beállítása"
                          >
                            <Settings size={16} strokeWidth={1.75} />
                          </button>
                        )}
                        {canModify && (
                          <button
                            onClick={() => openEditModal(role)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
                            title="Szerkesztés"
                          >
                            <Edit2 size={16} strokeWidth={1.75} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setRoleToDelete(role)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Törlés"
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
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
              <div className="space-y-1.5">
                <label htmlFor="roleName" className="text-sm font-medium text-[var(--text-secondary)]">Nev</label>
                <input
                  id="roleName"
                  autoFocus
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Pl. Moderátor"
                  required
                  className="w-full rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="roleDesc" className="text-sm font-medium text-[var(--text-secondary)]">Leírás (Opcionális)</label>
                <input
                  id="roleDesc"
                  type="text"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Mire jogosít fel ez a szerepkört?"
                  className="w-full rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" className="p-2" onClick={() => setIsRoleModalOpen(false)}>
                Mégse
              </Button>
              <Button type="submit" variant="primary" className="p-2" disabled={!roleName.trim() || isSubmittingRole}>
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
          message={`Biztosan törölni szeretnéd a(z) "${roleToDelete?.name || roleToDelete?.group_role_name}" szerepkört? Ez a művelet nem vonható vissza, és a hozzárendelt felhasználók elveszítik ezen jogosultságaikat.`}
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
          title={`Jogosultságok: ${roleForPerms?.name || roleForPerms?.group_role_name}`}
          onClose={() => setIsPermsSheetOpen(false)}
        >
          <div className="flex flex-col h-full -mx-5 px-5">
            <div className="flex-1 overflow-y-auto pb-6">
              {isLoadingPerms ? (
                <div className="py-10 text-center text-[var(--text-tertiary)]">Jogosultságok betöltése...</div>
              ) : allPerms.length === 0 ? (
                <div className="py-10 text-center text-[var(--text-tertiary)]">Nem találhatók kiosztható jogok.</div>
              ) : (
                <div className="space-y-3">
                  {allPerms.map((perm) => {
                    const permId = perm.id || perm.group_permission_id || perm.name;
                    return (
                      <div key={permId} className="flex items-center justify-between gap-4 p-3 rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors hover:bg-[var(--bg-hover)]">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {perm.label || perm.name || perm.group_permission_name}
                          </span>
                          {(perm.description || perm.name) && (
                            <span className="text-xs text-[var(--text-tertiary)] mt-0.5">
                              {perm.description || perm.name}
                            </span>
                          )}
                        </div>
                        <Switch
                          checked={selectedPermIds.has(permId)}
                          onCheckedChange={(checked) => togglePermission(permId, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 pt-4 pb-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <Button 
                onClick={handleSavePermissions} 
                className="w-full justify-center p-2.5" 
                disabled={isLoadingPerms || isSavingPerms}
              >
                {isSavingPerms ? 'Mentés...' : 'Változtatások Mentése'}
              </Button>
            </div>
          </div>
        </SideSheet>
      )}
    </div>
  );
}
