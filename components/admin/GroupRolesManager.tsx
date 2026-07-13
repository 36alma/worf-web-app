'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createGroupRole,
  deleteGroupRole,
  getAllPermissions,
  getGroupRoles,
  modifyGroupRole,
  setFixedRolePermissions
} from '@/lib/api/groups';
import { normalizeGroupId } from '@/lib/utils/groupId';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';
import FieldError from '@/components/ui/FieldError';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {requiredText, optionalText} from '@/lib/validation';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Calendar,
  FileText,
  CheckSquare,
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  Shield
} from 'lucide-react';

type RawObject = Record<string, unknown>;

interface Role {
  group_role_id: string;
  group_role_name: string;
  group_role_description: string;
  group_permissions: Array<{ group_permission_id: string; group_permission_name: string }>;
}

interface Permission {
  group_permission_id: string;
  group_permission_name: string;
  group_permission_description?: string;
}

interface PermissionCategory {
  name: string;
  icon: React.ComponentType<any>;
  permissions: Permission[];
}

interface GroupRolesManagerProps {
  groupId?: string;
  onClose?: () => void;
}

// Categorize permissions by their names
const categorizePermissions = (permissions: Permission[]): PermissionCategory[] => {
  const categories: Record<string, Permission[]> = {
    'Roles': [],
    'Calendar': [],
    'Posts': [],
    'Tasks': [],
    'Users & Groups': [],
    'Other': []
  };

  permissions.forEach((permission) => {
    const name = permission.group_permission_name.toLowerCase();
    if (name.includes('role')) {
      categories['Roles'].push(permission);
    } else if (name.includes('calendar') || name.includes('event')) {
      categories['Calendar'].push(permission);
    } else if (name.includes('post')) {
      categories['Posts'].push(permission);
    } else if (name.includes('task')) {
      categories['Tasks'].push(permission);
    } else if (name.includes('user') || name.includes('member') || name.includes('group')) {
      categories['Users & Groups'].push(permission);
    } else {
      categories['Other'].push(permission);
    }
  });

  const iconMap: Record<string, React.ComponentType<any>> = {
    'Roles': Lock,
    'Calendar': Calendar,
    'Posts': FileText,
    'Tasks': CheckSquare,
    'Users & Groups': Users,
    'Other': Lock
  };

  return Object.entries(categories)
    .filter(([, perms]) => perms.length > 0)
    .map(([name, perms]) => ({
      name,
      icon: iconMap[name],
      permissions: perms
    }));
};

const extractArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as RawObject;

  const dataObj = row.data as RawObject | undefined;
  const candidates = [
    row.data,
    row.roles,
    row.group_roles,
    row.group_permissions,
    dataObj?.roles,
    dataObj?.group_roles,
    dataObj?.group_permissions
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

const extractObject = (payload: unknown): RawObject | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const row = payload as RawObject;
  const dataObj = row.data;
  if (dataObj && typeof dataObj === 'object' && !Array.isArray(dataObj)) {
    return dataObj as RawObject;
  }
  return row;
};

const mapPermissionEntries = (input: unknown): Array<{ group_permission_id: string; group_permission_name: string }> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];

  return Object.entries(input as RawObject)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => ({
      group_permission_id: key,
      group_permission_name:
        typeof value === 'string' && value.trim().length > 0 ? value : key
    }));
};

const mapRoles = (payload: unknown): Role[] => {
  const rows = extractArray(payload);
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as RawObject;
      const id = String(row.group_role_id ?? row.id ?? '').trim();
      if (!id) return null;

      const permissionsSource = Array.isArray(row.group_permissions)
        ? row.group_permissions
        : Array.isArray(row.permissions)
          ? row.permissions
          : [];
      const permissionsFromObjectMap =
        !permissionsSource.length &&
        row.group_permissions &&
        typeof row.group_permissions === 'object' &&
        !Array.isArray(row.group_permissions)
          ? mapPermissionEntries(row.group_permissions).filter((permission) => {
              const groupPermissionsMap = row.group_permissions as RawObject;
              return Boolean(groupPermissionsMap[permission.group_permission_id]);
            })
          : [];
      const permissionsFromIdList =
        !permissionsSource.length && Array.isArray(row.group_permission_ids)
          ? row.group_permission_ids
              .map((permissionId) => String(permissionId ?? '').trim())
              .filter((permissionId): permissionId is string => permissionId.length > 0)
              .map((permissionId) => ({
                group_permission_id: permissionId,
                group_permission_name: permissionId
              }))
          : [];

      const permissions = permissionsSource
        .map((permission) => {
          if (!permission || typeof permission !== 'object') return null;
          const p = permission as RawObject;
          const permissionId = String(p.group_permission_id ?? p.id ?? '').trim();
          if (!permissionId) return null;

          return {
            group_permission_id: permissionId,
            group_permission_name: String(p.group_permission_name ?? p.name ?? permissionId)
          };
        })
        .filter((permission): permission is { group_permission_id: string; group_permission_name: string } => Boolean(permission));
      const normalizedPermissions =
        permissions.length > 0
          ? permissions
          : permissionsFromObjectMap.length > 0
            ? permissionsFromObjectMap
            : permissionsFromIdList;

      return {
        group_role_id: id,
        group_role_name: String(row.group_role_name ?? row.name ?? id),
        group_role_description: String(row.group_role_description ?? row.description ?? ''),
        group_permissions: normalizedPermissions
      };
    })
    .filter((role): role is Role => Boolean(role));
};

const mapPermissions = (payload: unknown): Permission[] => {
  const rows = extractArray(payload);
  if (rows.length === 0) {
    const source = extractObject(payload);
    if (!source) return [];

    const nestedMapCandidates = [
      source.group_permissions,
      source.permissions,
      source.permission_map
    ];

    for (const candidate of nestedMapCandidates) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        return mapPermissionEntries(candidate)
          .map((permission) => ({
            ...permission,
            group_permission_description: undefined
          }))
          .sort((a, b) => a.group_permission_name.localeCompare(b.group_permission_name));
      }
    }

    return mapPermissionEntries(source)
      .map((permission) => ({
        ...permission,
        group_permission_description: undefined
      }))
      .sort((a, b) => a.group_permission_name.localeCompare(b.group_permission_name));
  }

  return rows
    .map((item): Permission | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as RawObject;
      const id = String(row.group_permission_id ?? row.id ?? '').trim();
      if (!id) return null;
      return {
        group_permission_id: id,
        group_permission_name: String(row.group_permission_name ?? row.name ?? id),
        group_permission_description: row.group_permission_description ? String(row.group_permission_description) : undefined
      };
    })
    .filter((permission): permission is Permission => permission !== null);
};

export default function GroupRolesManager({ groupId: propGroupId }: GroupRolesManagerProps) {
  const params = useParams<{ groupId: string }>();
  const t = useTranslations('admin.groupRoles');
  const groupId = useMemo(() => {
    if (typeof propGroupId === 'string' && propGroupId.length > 0) {
      return normalizeGroupId(propGroupId);
    }
    if (typeof params?.groupId === 'string' && params.groupId.length > 0) {
      return normalizeGroupId(params.groupId);
    }

    return '';
  }, [propGroupId, params]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [editingRoleId, setEditingRoleId] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Roles', 'Calendar', 'Posts', 'Tasks']));
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const roleSchemas = useMemo(() => ({name: requiredText(150), description: optionalText(1000)}), []);
  const {errors, validateField, validateAll, clearError} = useFieldValidation(roleSchemas);

  const selectedRole = useMemo(
    () => roles.find((role) => role.group_role_id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const filteredPermissions = useMemo(() => {
    if (!searchQuery) return permissions;
    const query = searchQuery.toLowerCase();
    return permissions.filter((p) => p.group_permission_name.toLowerCase().includes(query));
  }, [permissions, searchQuery]);

  const categorizedPermissions = useMemo(
    () => categorizePermissions(filteredPermissions),
    [filteredPermissions]
  );

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const loadRoles = useCallback(async () => {
    if (!groupId) return;
    setLoadingRoles(true);
    try {
      const response = await getGroupRoles({ group_id: groupId });
      const nextRoles = mapRoles(response.data);
      setRoles(nextRoles);
      setSelectedRoleId((previous) => {
        if (previous && nextRoles.some((role) => role.group_role_id === previous)) return previous;
        return nextRoles[0]?.group_role_id ?? '';
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.loadError');
      toast.error(message);
      setRoles([]);
      setSelectedRoleId('');
    } finally {
      setLoadingRoles(false);
    }
  }, [groupId, t]);

  const loadPermissionCatalog = useCallback(async () => {
    setLoadingPermissions(true);
    try {
      const response = await getAllPermissions(groupId);
      setPermissions(mapPermissions(response.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.loadError');
      toast.error(message);
      setPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    if (!groupId) return;
    void loadRoles();
    void loadPermissionCatalog();
  }, [groupId, loadRoles, loadPermissionCatalog]);

  useEffect(() => {
    if (!selectedRole) {
      setSelectedPermissionIds(new Set());
      return;
    }
    setSelectedPermissionIds(new Set(selectedRole.group_permissions.map((permission) => permission.group_permission_id)));
  }, [selectedRole]);

  const startCreate = () => {
    setEditingRoleId('');
    setFormName('');
    setFormDescription('');
  };

  const startEdit = () => {
    if (!selectedRole) return;
    setEditingRoleId(selectedRole.group_role_id);
    setFormName(selectedRole.group_role_name);
    setFormDescription(selectedRole.group_role_description);
  };

  const submitRole = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateAll({name: formName, description: formDescription})) {
      return;
    }

    if (!groupId) {
      toast.error(t('messages.saveError'));
      return;
    }

    setSavingRole(true);
    try {
      if (editingRoleId) {
        await modifyGroupRole({
          group_id: groupId,
          role_id: editingRoleId,
          name: formName.trim(),
          description: formDescription.trim() || undefined
        });
        toast.success(t('messages.roleUpdated'));
      } else {
        await createGroupRole({
          group_id: groupId,
          name: formName.trim(),
          description: formDescription.trim() || undefined
        });
        toast.success(t('messages.roleCreated'));
      }
      startCreate();
      await loadRoles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.saveError');
      toast.error(message);
    } finally {
      setSavingRole(false);
    }
  };

  const removeSelectedRole = async () => {
    if (!groupId || !selectedRole) return;
    try {
      await deleteGroupRole(groupId, selectedRole.group_role_id);
      toast.success(t('messages.roleDeleted'));
      setDeleteConfirmOpen(false);
      await loadRoles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.deleteError');
      toast.error(message);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds((previous) => {
      const next = new Set(previous);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const toggleCategoryPermissions = (categoryName: string) => {
    const category = categorizedPermissions.find((c) => c.name === categoryName);
    if (!category) return;

    const categoryPermissionIds = new Set(category.permissions.map((p) => p.group_permission_id));
    const allSelected = category.permissions.every((p) =>
      selectedPermissionIds.has(p.group_permission_id)
    );

    setSelectedPermissionIds((previous) => {
      const next = new Set(previous);
      if (allSelected) {
        // Deselect all in category
        categoryPermissionIds.forEach((id) => next.delete(id));
      } else {
        // Select all in category
        categoryPermissionIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const savePermissions = async () => {
    if (!groupId || !selectedRole) return;
    setSavingPermissions(true);
    try {
      await setFixedRolePermissions({
        group_id: groupId,
        group_role_id: selectedRole.group_role_id,
        permission_ids: Array.from(selectedPermissionIds)
      });
      toast.success(t('messages.permissionsSaved'));
      await loadRoles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.saveError');
      toast.error(message);
    } finally {
      setSavingPermissions(false);
    }
  };

  if (!groupId) {
    return <div className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">{t('title')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      {/* Unified Roles Management Panel */}
      <div className="grid gap-1 lg:grid-cols-12">
        {/* Left Column: Role List */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] lg:col-span-4 flex flex-col overflow-hidden shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('rolesList.heading')}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{t('rolesList.countLabel', { count: roles.length })}</p>
              </div>
              <Button
                className="h-9 px-3 gap-2"
                onClick={() => {
                  setSelectedRoleId('');
                  startCreate();
                }}
                startIcon={<Plus size={16} />}
              >
                {t('rolesList.newRoleButton')}
              </Button>
            </div>
          </div>

          {/* Role List */}
          <div className="flex-1 overflow-y-auto">
            {loadingRoles ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center h-full">
                <Shield size={32} className="text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">{t('rolesList.noRoles')}</p>
              </div>
            ) : (
              <div className="space-y-1 p-3">
                {roles.map((role, index) => (
                  <button
                    key={role.group_role_id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.group_role_id)}
                    className={`w-full rounded-lg border-2 p-3 text-left transition-all duration-200 ${
                      selectedRoleId === role.group_role_id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 shadow-md'
                        : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className="text-[var(--accent)] flex-shrink-0" />
                          <div className="font-medium text-sm text-[var(--text-primary)]">{role.group_role_name}</div>
                        </div>
                        {role.group_role_description && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">{role.group_role_description}</p>
                        )}
                        <div className="mt-2 text-xs text-[var(--text-tertiary)]">{t('rolesList.permissionsCount', { count: role.group_permissions.length })}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Edit/Create Form + Permissions */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] lg:col-span-8 flex flex-col overflow-hidden shadow-sm">
          {/* Form Section */}
          <form onSubmit={submitRole} className="border-b border-[var(--border)] px-6 py-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {editingRoleId ? t('form.editTitle') : selectedRoleId && !editingRoleId ? t('form.reviewTitle') : t('form.createTitle')}
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">{t('form.nameLabel')}</label>
              <input
                value={formName}
                onChange={(event) => {
                  setFormName(event.target.value);
                  clearError('name');
                }}
                onBlur={(event) => validateField('name', event.target.value)}
                placeholder={t('form.namePlaceholder')}
                className={`w-full rounded-lg border-2 bg-[var(--bg-input)] px-3 py-2.5 text-sm placeholder-[var(--text-tertiary)] focus:outline-none transition-all ${
                  errors.name?.length
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-[var(--border)] focus:border-[var(--accent)]'
                }`}
                disabled={!!selectedRoleId && !editingRoleId}
                required
              />
              <FieldError messages={errors.name} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">{t('form.descriptionLabel')}</label>
              <textarea
                value={formDescription}
                onChange={(event) => {
                  setFormDescription(event.target.value);
                  clearError('description');
                }}
                onBlur={(event) => validateField('description', event.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
                className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 text-sm placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                rows={2}
                disabled={!!selectedRoleId && !editingRoleId}
              />
              <FieldError messages={errors.description} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {selectedRoleId && !editingRoleId ? (
                <>
                  <Button
                    className="px-4 py-2"
                    type="button"
                    onClick={startEdit}
                    startIcon={<Pencil size={16} />}
                  >
                    {t('form.editButton')}
                  </Button>
                  <Button
                    className="px-4 py-2"
                    variant="danger"
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    startIcon={<Trash2 size={16} />}
                  >
                    {t('form.deleteButton')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="flex-1 px-4 py-2"
                    type="submit"
                    disabled={savingRole}
                    startIcon={editingRoleId ? <Pencil size={16} /> : <Plus size={16} />}
                  >
                    {savingRole ? t('messages.roleUpdated') : (editingRoleId ? t('form.saveButton') : t('form.createButton'))}
                  </Button>
                  {editingRoleId && (
                    <Button
                      className="px-4 py-2"
                      variant="secondary"
                      type="button"
                      onClick={startCreate}
                    >
                      {t('form.cancelButton')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </form>

          {/* Permissions Section */}
          {!selectedRole ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Lock size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
                <p className="text-sm text-[var(--text-secondary)]">{t('permissions.selectRoleHint')}</p>
              </div>
            </div>
          ) : loadingPermissions ? (
            <div className="flex-1 p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : permissions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Lock size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
                <p className="text-sm text-[var(--text-secondary)]">{t('permissions.noPermissions')}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">{t('permissions.heading')}</h4>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  {t('permissions.selectedCount', { selected: selectedPermissionIds.size, total: permissions.length })}
                </div>
              </div>

              {/* Search Box */}
              <div className="border-b border-[var(--border)] px-6 py-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    placeholder={t('permissions.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] pl-9 pr-3 py-2 text-sm placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Permissions List */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-h-full space-y-1 p-3">
                  {categorizedPermissions.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)] py-4">{t('permissions.noPermissions')}</p>
                  ) : (
                    categorizedPermissions.map((category) => {
                      const isExpanded = expandedCategories.has(category.name);
                      const CategoryIcon = category.icon;
                      const selectedCount = category.permissions.filter((p) =>
                        selectedPermissionIds.has(p.group_permission_id)
                      ).length;

                      return (
                        <div key={category.name} className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[rgba(249,115,22,0.02)]">
                          <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors">
                            <button
                              type="button"
                              onClick={() => toggleCategory(category.name)}
                              className="flex items-center gap-3 flex-1"
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <CategoryIcon size={16} className="text-[var(--accent)]" />
                              <span className="text-left text-sm font-medium text-[var(--text-primary)]">{category.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategoryPermissions(category.name)}
                              className={`flex items-center justify-center h-6 w-6 rounded transition-all duration-200 ${
                                selectedCount === category.permissions.length
                                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                  : selectedCount > 0
                                    ? 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30'
                                    : 'bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:bg-[var(--border)]'
                              }`}
                              title={selectedCount === category.permissions.length ? t('permissions.categoryDeselectAll') : t('permissions.categorySelectAll')}
                            >
                              {selectedCount === category.permissions.length ? (
                                <Check size={14} strokeWidth={3} />
                              ) : selectedCount > 0 ? (
                                <div className="w-2 h-2 rounded-full bg-current" />
                              ) : (
                                <X size={14} strokeWidth={2} />
                              )}
                            </button>
                            <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-1 rounded">
                              {selectedCount}/{category.permissions.length}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-[var(--border-subtle)] space-y-2 bg-[var(--bg-surface)] p-3">
                              {category.permissions.map((permission) => {
                                const checked = selectedPermissionIds.has(permission.group_permission_id);
                                return (
                                  <button
                                    key={permission.group_permission_id}
                                    type="button"
                                    onClick={() => togglePermission(permission.group_permission_id)}
                                    className={`w-full rounded-lg border-2 p-3 text-left transition-all duration-200 flex items-start justify-between gap-3 ${
                                      checked
                                        ? 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
                                        : 'border-[var(--border-subtle)] bg-[var(--bg-input)]/30 hover:border-[var(--border)] hover:bg-[var(--bg-hover)]'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-[var(--text-primary)]">{permission.group_permission_name}</div>
                                      {permission.group_permission_description && (
                                        <div className="mt-1 text-xs text-[var(--text-secondary)] line-clamp-2">{permission.group_permission_description}</div>
                                      )}
                                    </div>
                                    <div className="flex-shrink-0">
                                      {checked ? (
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                          <Check size={14} className="text-green-500 font-bold" strokeWidth={3} />
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                          <X size={14} className="text-red-500 font-bold" strokeWidth={3} />
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Save Permissions Button */}
              <div className="border-t border-[var(--border)] px-6 py-3">
                <Button
                  className="w-full p-2"
                  onClick={() => void savePermissions()}
                  disabled={savingPermissions}
                >
                  {savingPermissions ? t('messages.permissionsSaved') : t('permissions.saveButton')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('deleteConfirm.title')}
        message={t('deleteConfirm.message', { name: selectedRole?.group_role_name || '' })}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void removeSelectedRole()}
        cancelLabel={t('deleteConfirm.cancel')}
        confirmLabel={t('deleteConfirm.confirm')}
      />

      {/* Permissions Section (Separate Panel) */}
      {editingRoleId || (selectedRoleId && !editingRoleId && selectedRole) ? null : null}
    </div>
  );
}
