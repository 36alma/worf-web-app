'use client';

import Link from 'next/link';
import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {getUserGroups} from '@/lib/api/groups';
import {
  createGlobalPostCategory,
  createGroupPostCategory,
  deleteGlobalPostCategory,
  deleteGroupPostCategory,
  getGlobalPostCategories,
  getGlobalPosts,
  getGroupPostCategories,
  getGroupPosts,
  modifyGlobalPostCategory,
  modifyGroupPostCategory
} from '@/lib/api/posts';
import {getGroupPermissions} from '@/lib/api/permissions';
import {hasPermissionRequirement} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import MarkdownRenderer from '@/components/posts/MarkdownRenderer';

type RawObject = Record<string, unknown>;

interface GroupItem {
  id: string;
  name: string;
}

interface PostCategory {
  id: string;
  name: string;
  description: string;
}

interface PostItem {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  categoryId: string;
  categoryName: string;
}

const readData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const candidate = payload as RawObject;
  if ('data' in candidate) {
    return candidate.data;
  }

  return payload;
};

const findArrayValue = (source: unknown): unknown[] => {
  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== 'object') {
    return [];
  }

  const objectValue = source as RawObject;
  const knownArray = ['posts', 'items', 'rows', 'result'].find((key) => Array.isArray(objectValue[key]));
  if (knownArray) {
    return objectValue[knownArray] as unknown[];
  }

  for (const value of Object.values(objectValue)) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const normalizeGroups = (payload: unknown): GroupItem[] => {
  const source = readData(payload);
  const arrayValue = findArrayValue(source);

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const id = String(row.group_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.group_name ?? row.name ?? id)
      };
    })
    .filter((row): row is GroupItem => Boolean(row));
};

const normalizeCategories = (payload: unknown): PostCategory[] => {
  const source = readData(payload);
  const arrayValue = findArrayValue(source);

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const id = String(row.post_category_id ?? row.category_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.name ?? row.category_name ?? id),
        description: String(row.description ?? '')
      };
    })
    .filter((row): row is PostCategory => Boolean(row));
};

const normalizePosts = (payload: unknown): PostItem[] => {
  const source = readData(payload);
  const arrayValue = findArrayValue(source);

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const nestedPost =
        row.post && typeof row.post === 'object' ? (row.post as RawObject) : null;
      const nestedCategory =
        row.category && typeof row.category === 'object' ? (row.category as RawObject) : null;

      const titleValue = nestedPost?.title ?? row.title ?? '';
      const bodyValue = nestedPost?.content ?? nestedPost?.body ?? row.body ?? row.content ?? '';
      const authorValue =
        nestedPost?.author_name ??
        nestedPost?.username ??
        nestedPost?.author ??
        nestedPost?.author_id ??
        row.author_name ??
        row.username ??
        row.author ??
        '';
      const createdAtValue =
        nestedPost?.created_at ??
        nestedPost?.create_time ??
        nestedPost?.date ??
        row.created_at ??
        row.create_time ??
        row.date ??
        '';
      const categoryIdValue =
        nestedCategory?.category_id ??
        row.post_category_id ??
        row.category_id ??
        '';
      const categoryNameValue =
        nestedCategory?.category_name ??
        nestedCategory?.name ??
        row.post_category_name ??
        row.category_name ??
        '';

      const id = String(
        row.post_id ??
          row.id ??
          nestedPost?.post_id ??
          nestedPost?.id ??
          `${String(authorValue)}-${String(createdAtValue)}-${String(titleValue)}`
      );
      if (!id) {
        return null;
      }

      return {
        id,
        title: String(titleValue),
        body: String(bodyValue),
        author: String(authorValue),
        createdAt: String(createdAtValue),
        categoryId: String(categoryIdValue),
        categoryName: String(categoryNameValue)
      };
    })
    .filter((row): row is PostItem => Boolean(row));
};

const formatDate = (value: string, locale: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

interface PostsFeedProps {
  mode: 'global' | 'group';
  groupId?: string;
}

export default function PostsFeed({mode, groupId = ''}: PostsFeedProps) {
  const t = useTranslations('posts');
  const locale = useLocale();
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsLoadingById,
    setGroupPermissions,
    setGroupPermissionsLoading
  } = usePermissionStore();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedFilterGroupId, setSelectedFilterGroupId] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategoryFilterId, setSelectedCategoryFilterId] = useState('');

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryEditingId, setCategoryEditingId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState('');

  const activeGroupId = mode === 'group' ? groupId : selectedFilterGroupId;
  const isGroupScope = Boolean(activeGroupId);

  const activeGroupPermissions = activeGroupId ? groupPermissionsById[activeGroupId] : null;

  const ensureGroupPermissions = useCallback(
    async (targetGroupId: string) => {
      if (!targetGroupId) {
        return;
      }

      if (groupPermissionsById[targetGroupId] || groupPermissionsLoadingById[targetGroupId]) {
        return;
      }

      setGroupPermissionsLoading(targetGroupId, true);
      try {
        const permissions = await getGroupPermissions(targetGroupId);
        setGroupPermissions(targetGroupId, permissions);
      } catch {
        setGroupPermissions(targetGroupId, {});
      }
    },
    [groupPermissionsById, groupPermissionsLoadingById, setGroupPermissions, setGroupPermissionsLoading]
  );

  const canCreateInScope = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, {anyOf: ['group.post.create']});
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, {anyOf: ['post.create.global']});
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canEditInScope = useMemo(() => {
    if (!isGroupScope || !activeGroupPermissions) {
      return false;
    }

    return hasPermissionRequirement(activeGroupPermissions, {anyOf: ['group.post.modify']});
  }, [activeGroupPermissions, isGroupScope]);

  const canReadCategories = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, {anyOf: ['group.post.category.read']});
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, {anyOf: ['post.category.get.global']});
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canCreateCategory = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, {anyOf: ['group.post.category.create']});
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, {anyOf: ['post.category.create.global']});
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canModifyCategory = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, {anyOf: ['group.post.category.modify']});
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, {anyOf: ['post.category.modify.global']});
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canDeleteCategory = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, {anyOf: ['group.post.category.delete']});
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, {anyOf: ['post.category.delete.global']});
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      if (isGroupScope && activeGroupId) {
        await ensureGroupPermissions(activeGroupId);
        const response = await getGroupPosts({group_id: activeGroupId, page_number: 1, load_post_number: 50});
        setPosts(normalizePosts(response.data));
      } else {
        const response = await getGlobalPosts({page_number: 1, load_post_number: 50});
        setPosts(normalizePosts(response.data));
      }
    } catch {
      setPosts([]);
      toast.error('Post feed betoltese sikertelen');
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, ensureGroupPermissions, isGroupScope]);

  const loadCategories = useCallback(async () => {
    if (!canReadCategories) {
      setCategories([]);
      return;
    }

    setCategoriesLoading(true);
    try {
      if (isGroupScope && activeGroupId) {
        const response = await getGroupPostCategories({group_id: activeGroupId, limit: 200});
        setCategories(normalizeCategories(response.data));
      } else {
        const response = await getGlobalPostCategories({limit: 200});
        setCategories(normalizeCategories(response.data));
      }
    } catch {
      setCategories([]);
      toast.error('Kategoriak betoltese sikertelen');
    } finally {
      setCategoriesLoading(false);
    }
  }, [activeGroupId, canReadCategories, isGroupScope]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (mode !== 'global') {
      return;
    }

    let mounted = true;
    const loadGroups = async () => {
      try {
        const response = await getUserGroups();
        if (mounted) {
          setGroups(normalizeGroups(response.data));
        }
      } catch {
        if (mounted) {
          setGroups([]);
        }
      }
    };

    void loadGroups();

    return () => {
      mounted = false;
    };
  }, [mode]);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    void ensureGroupPermissions(activeGroupId);
  }, [activeGroupId, ensureGroupPermissions]);

  useEffect(() => {
    if (selectedCategoryFilterId && !categories.some((category) => category.id === selectedCategoryFilterId)) {
      setSelectedCategoryFilterId('');
    }
  }, [categories, selectedCategoryFilterId]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, PostCategory>();

    for (const category of categories) {
      map.set(category.id, category);
    }

    return map;
  }, [categories]);

  const filteredPosts = useMemo(() => {
    if (!selectedCategoryFilterId) {
      return posts;
    }

    return posts.filter((post) => post.categoryId === selectedCategoryFilterId);
  }, [posts, selectedCategoryFilterId]);

  const resetCategoryForm = () => {
    setCategoryEditingId('');
    setCategoryName('');
    setCategoryDescription('');
  };

  const onCategorySubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = categoryName.trim();
    const trimmedDescription = categoryDescription.trim();

    if (!trimmedName || !trimmedDescription) {
      return;
    }

    try {
      setCategorySubmitting(true);

      if (categoryEditingId) {
        if (!canModifyCategory) {
          toast.error('Nincs jogod kategoria modositashoz');
          return;
        }

        if (isGroupScope && activeGroupId) {
          await modifyGroupPostCategory({
            group_id: activeGroupId,
            post_category_id: categoryEditingId,
            name: trimmedName,
            description: trimmedDescription
          });
        } else {
          await modifyGlobalPostCategory({
            post_category_id: categoryEditingId,
            name: trimmedName,
            description: trimmedDescription
          });
        }

        toast.success('Kategoria frissitve');
      } else {
        if (!canCreateCategory) {
          toast.error('Nincs jogod kategoria letrehozasra');
          return;
        }

        if (isGroupScope && activeGroupId) {
          await createGroupPostCategory({
            group_id: activeGroupId,
            name: trimmedName,
            description: trimmedDescription
          });
        } else {
          await createGlobalPostCategory({
            name: trimmedName,
            description: trimmedDescription
          });
        }

        toast.success('Kategoria letrehozva');
      }

      resetCategoryForm();
      await loadCategories();
    } catch {
      toast.error('Kategoria mentes sikertelen');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const onStartCategoryEdit = (category: PostCategory) => {
    if (!canModifyCategory) {
      return;
    }

    setCategoryEditingId(category.id);
    setCategoryName(category.name);
    setCategoryDescription(category.description);
  };

  const onDeleteCategory = async () => {
    if (!deletingCategoryId) {
      return;
    }

    if (!canDeleteCategory) {
      toast.error('Nincs jogod kategoria torlesre');
      return;
    }

    try {
      setCategorySubmitting(true);

      if (isGroupScope && activeGroupId) {
        await deleteGroupPostCategory(activeGroupId, deletingCategoryId);
      } else {
        await deleteGlobalPostCategory(deletingCategoryId);
      }

      if (selectedCategoryFilterId === deletingCategoryId) {
        setSelectedCategoryFilterId('');
      }

      setDeletingCategoryId('');
      await loadCategories();
      toast.success('Kategoria torolve');
    } catch {
      toast.error('Kategoria torles sikertelen');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const canManageCategories = canCreateCategory || canModifyCategory || canDeleteCategory;
  const createEditorHref = useMemo(() => {
    if (isGroupScope && activeGroupId) {
      return `/${locale}/groups/${activeGroupId}/posts/new`;
    }

    return `/${locale}/posts/new`;
  }, [activeGroupId, isGroupScope, locale]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-font text-2xl">{mode === 'group' ? 'Group Posts' : t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'global' && (
            <>
              <label className="text-xs uppercase tracking-wide text-slate-400">Group filter</label>
              <select
                value={selectedFilterGroupId}
                onChange={(event) => setSelectedFilterGroupId(event.target.value)}
                className="rounded-md border border-[var(--border)] bg-[#10101a] px-3 py-2 text-sm text-slate-200"
              >
                <option value="">Global feed</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {canReadCategories && (
            <>
              <label className="text-xs uppercase tracking-wide text-slate-400">Category</label>
              <select
                value={selectedCategoryFilterId}
                onChange={(event) => setSelectedCategoryFilterId(event.target.value)}
                className="rounded-md border border-[var(--border)] bg-[#10101a] px-3 py-2 text-sm text-slate-200"
                disabled={categoriesLoading}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {canReadCategories && canManageCategories && (
            <Button type="button" variant="ghost" onClick={() => setCategoryModalOpen(true)}>
              Manage Categories
            </Button>
          )}

          {canCreateInScope && (
            <Link
              href={createEditorHref}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              Create Post
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="surface rounded-xl p-4 text-sm text-slate-300">Loading posts...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="surface rounded-xl p-4 text-sm text-slate-300">No posts yet.</div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const categoryLabel = post.categoryName || categoriesById.get(post.categoryId)?.name || '';
            const titleLabel = post.title && post.title !== post.id ? post.title : 'Untitled post';
            const dateLabel = post.createdAt ? formatDate(post.createdAt, locale) : '';

            return (
              <article key={post.id} className="surface card-animate rounded-xl p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="display-font text-lg">{titleLabel}</h3>
                    <p className="text-xs text-slate-400">
                      {post.author || 'Unknown author'}
                      {dateLabel ? ` - ${dateLabel}` : ''}
                    </p>
                    {categoryLabel && <p className="mt-1 text-xs text-cyan-300">Category: {categoryLabel}</p>}
                  </div>
                  {canEditInScope && activeGroupId && (
                    <Link
                      href={`/${locale}/groups/${activeGroupId}/posts/${post.id}/edit`}
                      className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                    >
                      Edit
                    </Link>
                  )}
                </div>
                <MarkdownRenderer content={post.body} className="text-sm text-slate-200" />
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={categoryModalOpen}
        title="Post Categories"
        onClose={() => {
          setCategoryModalOpen(false);
          resetCategoryForm();
        }}
      >
        <form className="space-y-3" onSubmit={onCategorySubmit}>
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Category name"
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            maxLength={100}
            disabled={categorySubmitting || (!canCreateCategory && !categoryEditingId)}
          />
          <textarea
            value={categoryDescription}
            onChange={(event) => setCategoryDescription(event.target.value)}
            placeholder="Category description"
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            rows={3}
            disabled={categorySubmitting || (!canCreateCategory && !categoryEditingId)}
          />
          <div className="flex justify-end gap-2">
            {categoryEditingId && (
              <Button type="button" variant="ghost" onClick={resetCategoryForm} disabled={categorySubmitting}>
                Cancel edit
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                categorySubmitting ||
                (categoryEditingId ? !canModifyCategory : !canCreateCategory) ||
                !categoryName.trim() ||
                !categoryDescription.trim()
              }
            >
              {categoryEditingId ? 'Save category' : 'Create category'}
            </Button>
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-400">No categories yet.</p>
          ) : (
            categories.map((category) => (
              <article key={category.id} className="rounded-md border border-[var(--border)] bg-[#11111c] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{category.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{category.description || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    {canModifyCategory && (
                      <Button type="button" variant="ghost" onClick={() => onStartCategoryEdit(category)}>
                        Edit
                      </Button>
                    )}
                    {canDeleteCategory && (
                      <Button type="button" variant="danger" onClick={() => setDeletingCategoryId(category.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingCategoryId)}
        title="Delete category"
        message="Are you sure you want to delete this category?"
        onCancel={() => setDeletingCategoryId('')}
        onConfirm={onDeleteCategory}
      />
    </section>
  );
}
