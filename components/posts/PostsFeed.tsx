'use client';

import Link from 'next/link';
import * as Avatar from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import * as Tooltip from '@radix-ui/react-tooltip';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  FileText,
  Globe,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Settings,
  Sparkles,
  Tag,
  ThumbsUp,
  Trash2
} from 'lucide-react';
import { getUserGroups } from '@/lib/api/groups';
import {
  createGlobalPostCategory,
  createGroupPostCategory,
  deleteGlobalPost,
  deleteGlobalPostCategory,
  deleteGroupPost,
  deleteGroupPostCategory,
  getGlobalPostCategories,
  getGlobalPosts,
  getGroupPostCategories,
  getGroupPosts,
  modifyGlobalPostCategory,
  modifyGroupPostCategory
} from '@/lib/api/posts';
import { getGroupPermissions } from '@/lib/api/permissions';
import { hasPermissionRequirement } from '@/lib/permissions/access';
import { usePermissionStore } from '@/lib/store/permissionStore';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';

type RawObject = Record<string, unknown>;
type PostStatus = 'draft' | 'published' | 'scheduled';

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
  status: PostStatus;
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
      const nestedAuthor =
        row.author && typeof row.author === 'object' ? (row.author as RawObject) : null;

      const titleValue = nestedPost?.title ?? row.title ?? '';
      const bodyValue = nestedPost?.content ?? nestedPost?.body ?? row.body ?? row.content ?? '';
      const authorValue =
        nestedAuthor?.name ??
        nestedAuthor?.username ??
        (nestedPost?.author && typeof nestedPost.author === 'object'
          ? (nestedPost.author as RawObject).name
          : nestedPost?.author) ??
        row.author_name ??
        (row.author && typeof row.author === 'object' ? (row.author as RawObject).name : row.author) ??
        nestedPost?.author_name ??
        nestedPost?.username ??
        row.username ??
        nestedPost?.author_id ??
        '';
      const createdAtValue =
        nestedPost?.created_at ??
        nestedPost?.updated_at ??
        nestedPost?.create_time ??
        nestedPost?.date ??
        row.created_at ??
        row.updated_at ??
        row.create_time ??
        row.date ??
        '';
      const categoryIdValue =
        nestedCategory?.category_id ??
        (nestedPost?.category && typeof nestedPost.category === 'object'
          ? (nestedPost.category as RawObject).category_id
          : undefined) ??
        row.post_category_id ??
        row.category_id ??
        '';
      const categoryNameValue =
        nestedCategory?.category_name ??
        nestedCategory?.name ??
        (nestedPost?.category && typeof nestedPost.category === 'object'
          ? ((nestedPost.category as RawObject).category_name ?? (nestedPost.category as RawObject).name)
          : undefined) ??
        row.post_category_name ??
        row.category_name ??
        '';
      const statusValue = String(nestedPost?.status ?? row.status ?? row.post_status ?? 'published').toLowerCase();

      const id = String(row.post_id ?? row.id ?? nestedPost?.post_id ?? nestedPost?.id ?? '');
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
        categoryName: String(categoryNameValue),
        status: statusValue === 'draft' || statusValue === 'scheduled' ? statusValue : 'published'
      };
    })
    .filter((row): row is PostItem => Boolean(row));
};

const stripMarkdown = (content: string): string =>
  content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildExcerpt = (content: string, maxLength = 150): string => {
  const clean = stripMarkdown(content);
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength).trimEnd()}...`;
};

const looksLikeTechnicalId = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.length < 24 || /\s/.test(trimmed)) {
    return false;
  }

  return /^[A-Za-z0-9_\-=+/.:]+$/.test(trimmed);
};

const formatRelativeTime = (value: string, locale: string, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absSec < 60) {
    return rtf.format(diffSec, 'second');
  }

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute');
  }

  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month');
  }

  return rtf.format(Math.round(diffDays / 365), 'year');
};

interface PostsFeedProps {
  mode: 'global' | 'group';
  groupId?: string;
}

export default function PostsFeed({ mode, groupId = '' }: PostsFeedProps) {
  const t = useTranslations('posts');
  const locale = useLocale();
  const router = useRouter();
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
  const [selectedCategoryFilterId, setSelectedCategoryFilterId] = useState('all');

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryEditingId, setCategoryEditingId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState('');
  const [deletingPostId, setDeletingPostId] = useState('');
  const [pinnedPostIds, setPinnedPostIds] = useState<Record<string, boolean>>({});

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

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.create'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.create.global'] });
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canEditInScope = useMemo(() => {
    if (!isGroupScope || !activeGroupPermissions) {
      return false;
    }

    return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.modify'] });
  }, [activeGroupPermissions, isGroupScope]);

  const canDeleteInScope = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.delete', 'group.post.modify'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.delete.global', 'post.create.global'] });
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canReadCategories = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.category.read'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.category.get.global'] });
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canCreateCategory = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.category.create'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.category.create.global'] });
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canModifyCategory = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.category.modify'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.category.modify.global'] });
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const canDeleteCategory = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.category.delete'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.category.delete.global'] });
  }, [activeGroupPermissions, isGroupScope, isSystemPermissionsLoaded, systemPermissions]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      if (isGroupScope && activeGroupId) {
        await ensureGroupPermissions(activeGroupId);
        const response = await getGroupPosts({ group_id: activeGroupId, page_number: 1, load_post_number: 50 });
        setPosts(normalizePosts(response.data));
      } else {
        const response = await getGlobalPosts({ page_number: 1, load_post_number: 50 });
        setPosts(normalizePosts(response.data));
      }
    } catch {
      setPosts([]);
      toast.error(t('toasts.loadPostsError'));
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, ensureGroupPermissions, isGroupScope, t]);

  const loadCategories = useCallback(async () => {
    if (!canReadCategories) {
      setCategories([]);
      return;
    }

    setCategoriesLoading(true);
    try {
      if (isGroupScope && activeGroupId) {
        const response = await getGroupPostCategories({ group_id: activeGroupId, limit: 200 });
        setCategories(normalizeCategories(response.data));
      } else {
        const response = await getGlobalPostCategories({ limit: 200 });
        setCategories(normalizeCategories(response.data));
      }
    } catch {
      setCategories([]);
      toast.error(t('toasts.loadCategoriesError'));
    } finally {
      setCategoriesLoading(false);
    }
  }, [activeGroupId, canReadCategories, isGroupScope, t]);

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
    if (selectedCategoryFilterId === 'all') {
      return;
    }

    if (!categories.some((category) => category.id === selectedCategoryFilterId)) {
      setSelectedCategoryFilterId('all');
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
    if (selectedCategoryFilterId === 'all') {
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
          toast.error(t('toasts.noCategoryModifyPermission'));
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

        toast.success(t('toasts.categoryUpdated'));
      } else {
        if (!canCreateCategory) {
          toast.error(t('toasts.noCategoryCreatePermission'));
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

        toast.success(t('toasts.categoryCreated'));
      }

      resetCategoryForm();
      await loadCategories();
    } catch {
      toast.error(t('toasts.categorySaveError'));
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
      toast.error(t('toasts.noCategoryDeletePermission'));
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
        setSelectedCategoryFilterId('all');
      }

      setDeletingCategoryId('');
      await loadCategories();
      toast.success(t('toasts.categoryDeleted'));
    } catch {
      toast.error(t('toasts.categoryDeleteError'));
    } finally {
      setCategorySubmitting(false);
    }
  };

  const onDeletePost = async () => {
    if (!deletingPostId) {
      return;
    }

    if (!canDeleteInScope) {
      toast.error(t('toasts.noPostDeletePermission'));
      return;
    }

    try {
      if (isGroupScope && activeGroupId) {
        await deleteGroupPost(activeGroupId, deletingPostId);
      } else {
        await deleteGlobalPost(deletingPostId);
      }

      setDeletingPostId('');
      await loadPosts();
      toast.success(t('toasts.postDeleted'));
    } catch {
      toast.error(t('toasts.postDeleteError'));
    }
  };

  const canManageCategories = canCreateCategory || canModifyCategory || canDeleteCategory;
  const createEditorHref = useMemo(() => {
    if (isGroupScope && activeGroupId) {
      return `/${locale}/groups/${activeGroupId}/posts/new`;
    }

    return `/${locale}/posts/new`;
  }, [activeGroupId, isGroupScope, locale]);

  const selectedGroupName = useMemo(() => {
    if (!selectedFilterGroupId) {
      return t('filters.globalFeed');
    }

    const selectedGroup = groups.find((group) => group.id === selectedFilterGroupId);
    return selectedGroup?.name ?? t('filters.globalFeed');
  }, [groups, selectedFilterGroupId, t]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryFilterId === 'all') {
      return t('filters.allCategories');
    }

    const selectedCategory = categories.find((category) => category.id === selectedCategoryFilterId);
    return selectedCategory?.name ?? t('filters.allCategories');
  }, [categories, selectedCategoryFilterId, t]);

  const openPost = (postId: string) => {
    const encodedPostId = encodeURIComponent(postId);

    if (isGroupScope && activeGroupId) {
      router.push(`/${locale}/groups/${activeGroupId}/posts/${encodedPostId}`);
      return;
    }

    router.push(`/${locale}/posts/${encodedPostId}`);
  };

  const openPostEditor = (postId: string) => {
    const encodedPostId = encodeURIComponent(postId);

    if (isGroupScope && activeGroupId) {
      router.push(`/${locale}/groups/${activeGroupId}/posts/${encodedPostId}/edit`);
      return;
    }

    router.push(`/${locale}/posts/${encodedPostId}/edit`);
  };

  const copyPostLink = async (postId: string) => {
    const encodedPostId = encodeURIComponent(postId);
    const path = isGroupScope && activeGroupId ? `/${locale}/groups/${activeGroupId}/posts/${encodedPostId}` : `/${locale}/posts/${encodedPostId}`;
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('toasts.linkCopied'));
    } catch {
      toast.error(t('toasts.linkCopyError'));
    }
  };

  const togglePin = (postId: string) => {
    setPinnedPostIds((prev) => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  return (
    <Tooltip.Provider delayDuration={100}>
      <section className="posts-page">
        <div className="page-header posts-header">
          <div className="page-title-section">
            <h1 className="page-title posts-page-title">
              <FileText size={20} className="page-title-icon" />
              {mode === 'group' ? t('groupTitle') : t('title')}
            </h1>
            <span className="page-count-badge">{t('stats.postCount', { count: filteredPosts.length })}</span>
          </div>

          <div className="posts-actions">
            <div className="page-filters-scroll">
              <div className="page-filters">
                {mode === 'global' && (
                  <div className="filter-group">
                    <Select.Root value={selectedFilterGroupId || 'global'} onValueChange={(value) => setSelectedFilterGroupId(value === 'global' ? '' : value)}>
                      <Select.Trigger className="filter-select filter-chip" aria-label={t('filters.groupFilter')}>
                        <Layers size={14} className="filter-icon" />
                        <Select.Value>{selectedGroupName}</Select.Value>
                        <Select.Icon>
                          <ChevronDown size={14} />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="posts-select-content" position="popper" sideOffset={4}>
                          <Select.Viewport className="select-viewport">
                            <Select.Item value="global" className="posts-select-item">
                              <Select.ItemIndicator className="select-indicator">
                                <Check size={14} />
                              </Select.ItemIndicator>
                              <Select.ItemText>{t('filters.globalFeed')}</Select.ItemText>
                            </Select.Item>
                            {groups.map((group) => (
                              <Select.Item key={group.id} value={group.id} className="posts-select-item">
                                <Select.ItemIndicator className="select-indicator">
                                  <Check size={14} />
                                </Select.ItemIndicator>
                                <Select.ItemText>{group.name}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                )}

                {canReadCategories && (
                  <div className="filter-group">
                    <Select.Root value={selectedCategoryFilterId} onValueChange={setSelectedCategoryFilterId}>
                      <Select.Trigger className="filter-select filter-chip" aria-label={t('filters.category')} disabled={categoriesLoading}>
                        <Tag size={14} className="filter-icon" />
                        <Select.Value>{selectedCategoryName}</Select.Value>
                        <Select.Icon>
                          <ChevronDown size={14} />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="posts-select-content" position="popper" sideOffset={4}>
                          <Select.Viewport className="select-viewport">
                            <Select.Item value="all" className="posts-select-item">
                              <Select.ItemIndicator className="select-indicator">
                                <Check size={14} />
                              </Select.ItemIndicator>
                              <Select.ItemText>{t('filters.allCategories')}</Select.ItemText>
                            </Select.Item>
                            {categories.map((category) => (
                              <Select.Item key={category.id} value={category.id} className="posts-select-item">
                                <Select.ItemIndicator className="select-indicator">
                                  <Check size={14} />
                                </Select.ItemIndicator>
                                <Select.ItemText>{category.name}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                )}

                {canReadCategories && canManageCategories && (
                  <button className="btn-secondary filter-chip" type="button" onClick={() => setCategoryModalOpen(true)}>
                    <Settings size={14} />
                    <span>{t('filters.manageCategories')}</span>
                  </button>
                )}
              </div>
            </div>

            {canCreateInScope && (
              <Link href={createEditorHref} className="btn-primary btn-full-mobile">
                <Plus size={14} />
                <span>{t('createPost')}</span>
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="surface rounded-xl p-4 text-sm text-[var(--text-secondary)]">{t('loading')}</div>
        ) : (
          <div className="posts-list">
            {filteredPosts.map((post) => {
              const categoryLabel = post.categoryName || categoriesById.get(post.categoryId)?.name || '';
              const rawTitle = post.title.trim();
              const titleLabel = rawTitle && !looksLikeTechnicalId(rawTitle) ? rawTitle : t('untitled');
              const authorName = post.author.trim() ? post.author : t('unknownAuthor');
              const relativeTime = formatRelativeTime(post.createdAt, locale, t('timeUnknown'));
              const scopeLabel = isGroupScope ? t('filters.teamFeed') : t('filters.globalFeed');
              const excerpt = buildExcerpt(post.body);
              const pinned = Boolean(pinnedPostIds[post.id]);

              const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPost(post.id);
                }
              };

              return (
                <article key={post.id} className="post-card">
                  <div className="post-card-header">
                    <div className="post-card-author">
                      <Avatar.Root className="post-avatar">
                        <Avatar.Fallback className="post-avatar-fallback">{authorName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                      </Avatar.Root>
                      <div className="post-author-info">
                        <span className="post-author-name">{authorName}</span>
                        <div className="post-meta-row">
                          <Clock size={12} />
                          <time className="post-time">{relativeTime}</time>
                          <span className="post-scope-badge">
                            <Globe size={10} />
                            {scopeLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="post-card-actions">
                      <span className={`post-status-badge status-${post.status}`}>{t(`status.${post.status}`)}</span>

                      {pinned && (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <span className="post-pin-badge" aria-hidden="true">
                              <Pin size={12} />
                            </span>
                          </Tooltip.Trigger>
                          <Tooltip.Content className="posts-tooltip-content" sideOffset={4}>
                            {t('pinned')}
                          </Tooltip.Content>
                        </Tooltip.Root>
                      )}

                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="post-menu-btn" aria-label={t('actions.menu')}>
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="posts-dropdown-content" sideOffset={4} align="end">
                            <DropdownMenu.Item className="posts-dropdown-item" onClick={() => openPost(post.id)}>
                              <Eye size={14} />
                              <span>{t('actions.view')}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="posts-dropdown-item" onClick={() => openPostEditor(post.id)} disabled={!canEditInScope}>
                              <Pencil size={14} />
                              <span>{t('actions.edit')}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="posts-dropdown-item" onClick={() => void copyPostLink(post.id)}>
                              <Copy size={14} />
                              <span>{t('actions.copyLink')}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="posts-dropdown-item" onClick={() => togglePin(post.id)}>
                              <Pin size={14} />
                              <span>{pinned ? t('actions.unpin') : t('actions.pin')}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="posts-dropdown-separator" />
                            <DropdownMenu.Item className="posts-dropdown-item danger" onClick={() => setDeletingPostId(post.id)} disabled={!canDeleteInScope}>
                              <Trash2 size={14} />
                              <span>{t('actions.delete')}</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </div>

                  <div className="post-card-body" role="link" tabIndex={0} onKeyDown={onCardKeyDown} onClick={() => openPost(post.id)}>
                    <h3 className="post-card-title">{titleLabel}</h3>
                    {excerpt && <p className="post-card-excerpt">{excerpt}</p>}
                  </div>

                  <div className="post-card-footer">
                    <div className="post-card-tags">
                      {categoryLabel && (
                        <span className="post-category-badge">
                          <Tag size={11} />
                          {categoryLabel}
                        </span>
                      )}
                    </div>

                    <div className="post-card-stats">
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <span className="post-stat">
                            <ThumbsUp size={13} />0
                          </span>
                        </Tooltip.Trigger>
                        <Tooltip.Content className="posts-tooltip-content" sideOffset={4}>
                          {t('stats.likes', { count: 0 })}
                        </Tooltip.Content>
                      </Tooltip.Root>

                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <span className="post-stat">
                            <MessageSquare size={13} />0
                          </span>
                        </Tooltip.Trigger>
                        <Tooltip.Content className="posts-tooltip-content" sideOffset={4}>
                          {t('stats.comments', { count: 0 })}
                        </Tooltip.Content>
                      </Tooltip.Root>

                      <span className="post-stat">
                        <Calendar size={13} />
                        {relativeTime}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredPosts.length === 0 && (
              <div className="empty-state surface">
                <div className="empty-state-icon">
                  <FileText size={40} />
                </div>
                <h3 className="empty-state-title">{t('empty.title')}</h3>
                <p className="empty-state-text">{t('empty.description')}</p>
                {canCreateInScope && (
                  <Link href={createEditorHref} className="btn-primary">
                    <Plus size={14} />
                    <span>{t('empty.createFirst')}</span>
                  </Link>
                )}
              </div>
            )}

            {filteredPosts.length > 0 && filteredPosts.length < 3 && canCreateInScope && (
              <div className="posts-cta-card">
                <div className="posts-cta-content">
                  <Sparkles size={18} className="posts-cta-icon" />
                  <span className="posts-cta-text">{t('cta.text')}</span>
                </div>
                <Link href={createEditorHref} className="btn-ghost">
                  <Plus size={14} />
                  {t('createPost')}
                </Link>
              </div>
            )}
          </div>
        )}

        <Modal
          open={categoryModalOpen}
          title={t('categories.modalTitle')}
          onClose={() => {
            setCategoryModalOpen(false);
            resetCategoryForm();
          }}
        >
          <form className="space-y-3" onSubmit={onCategorySubmit}>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder={t('categories.namePlaceholder')}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
              maxLength={100}
              disabled={categorySubmitting || (!canCreateCategory && !categoryEditingId)}
            />
            <textarea
              value={categoryDescription}
              onChange={(event) => setCategoryDescription(event.target.value)}
              placeholder={t('categories.descriptionPlaceholder')}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
              rows={3}
              disabled={categorySubmitting || (!canCreateCategory && !categoryEditingId)}
            />
            <div className="flex justify-end gap-2">
              {categoryEditingId && (
                <Button type="button" variant="ghost" onClick={resetCategoryForm} disabled={categorySubmitting}>
                  {t('categories.cancelEdit')}
                </Button>
              )}
              <Button
                className='p-2'
                type="submit"
                disabled={
                  categorySubmitting ||
                  (categoryEditingId ? !canModifyCategory : !canCreateCategory) ||
                  !categoryName.trim() ||
                  !categoryDescription.trim()
                }
              >
                {categoryEditingId ? t('categories.save') : t('categories.create')}
              </Button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('categories.empty')}</p>
            ) : (
              categories.map((category) => (
                <article key={category.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{category.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{category.description || '-'}</p>
                    </div>
                    <div className="flex gap-2">
                      {canModifyCategory && (
                        <Button type="button" className="p-2" variant="ghost" onClick={() => onStartCategoryEdit(category)}>
                          {t('actions.edit')}
                        </Button>
                      )}
                      {canDeleteCategory && (
                        <Button type="button" className="p-2" variant="danger" onClick={() => setDeletingCategoryId(category.id)}>
                          {t('actions.delete')}
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
          title={t('categories.deleteTitle')}
          message={t('categories.deleteMessage')}
          onCancel={() => setDeletingCategoryId('')}
          onConfirm={onDeleteCategory}
        />

        <ConfirmDialog
          open={Boolean(deletingPostId)}
          title={t('deletePostTitle')}
          message={t('deletePostMessage')}
          onCancel={() => setDeletingPostId('')}
          onConfirm={onDeletePost}
        />
      </section>
    </Tooltip.Provider>
  );
}
