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
  CircleDot,
  ClipboardCheck,
  Clock,
  Code,
  Copy,
  Eye,
  FileText,
  Globe,
  Hash,
  ImageIcon,
  Layers,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Settings,
  Sparkles,
  Tag,
  Trash2
} from 'lucide-react';
import { getUserGroups } from '@/lib/api/groups';
import {
  createGlobalPostCategory,
  createGroupPostCategory,
  deleteGlobalPostCategory,
  deleteGroupPostCategory,
  deletePost,
  getGlobalPostCategories,
  getGroupPostCategories,
  getPostPanel,
  getPostTags,
  getPostUnreadCount,
  modifyGlobalPostCategory,
  modifyGroupPostCategory,
  pinPost
} from '@/lib/api/posts';
import {
  hasPostPermission,
  httpStatus,
  MAX_PINNED_PER_SCOPE,
  normalizePostList,
  normalizeTagList,
  numberField,
  POST_STATUSES,
  type PostModel,
  type PostStatus,
  type PostTag
} from '@/lib/posts/model';
import PostReviewQueue from '@/components/posts/PostReviewQueue';
import PostTagManagerModal from '@/components/posts/PostTagManagerModal';
import PostTrashView from '@/components/posts/PostTrashView';
import { getGroupPermissions } from '@/lib/api/permissions';
import { hasPermissionRequirement } from '@/lib/permissions/access';
import {
  canDeleteGlobalPost,
  canDeleteGroupPost,
  canModifyGlobalPost,
  canModifyGroupPost
} from '@/lib/permissions/postGuard';
import { usePermissionStore } from '@/lib/store/permissionStore';
import { useAuthStore } from '@/lib/store/authStore';
import { getFormattedExcerpt } from '@/lib/utils/postUtils';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';

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

type FeedView = 'feed' | 'review' | 'trash';

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
  const { user } = useAuthStore();
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsStatusById,
    setGroupPermissions,
    setGroupPermissionsLoading,
    setGroupPermissionsError
  } = usePermissionStore();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedFilterGroupId, setSelectedFilterGroupId] = useState('');
  const [posts, setPosts] = useState<PostModel[]>([]);
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
  const [view, setView] = useState<FeedView>('feed');
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [tagFilterId, setTagFilterId] = useState('');
  const [tags, setTags] = useState<PostTag[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinBusyId, setPinBusyId] = useState('');

  const activeGroupId = mode === 'group' ? groupId : selectedFilterGroupId;
  const isGroupScope = Boolean(activeGroupId);

  const activeGroupPermissions = activeGroupId ? groupPermissionsById[activeGroupId] : null;

  const ensureGroupPermissions = useCallback(
    async (targetGroupId: string) => {
      if (!targetGroupId) {
        return;
      }

      const permissionStatus = groupPermissionsStatusById[targetGroupId];
      if (permissionStatus === 'loading' || permissionStatus === 'loaded' || permissionStatus === 'error') {
        return;
      }

      setGroupPermissionsLoading(targetGroupId, true);
      try {
        const permissions = await getGroupPermissions(targetGroupId);
        setGroupPermissions(targetGroupId, permissions);
      } catch {
        setGroupPermissionsError(targetGroupId);
      }
    },
    [groupPermissionsStatusById, setGroupPermissions, setGroupPermissionsError, setGroupPermissionsLoading]
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

  const canDeleteInScope = useMemo(() => {
    if (isGroupScope) {
      if (!activeGroupPermissions) {
        return false;
      }

      return hasPermissionRequirement(activeGroupPermissions, { anyOf: ['group.post.delete'] });
    }

    if (!isSystemPermissionsLoaded) {
      return false;
    }

    return hasPermissionRequirement(systemPermissions, { anyOf: ['post.delete.global'] });
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

  const scopePermissions = isGroupScope ? activeGroupPermissions ?? {} : systemPermissions;
  const scopeGroup = isGroupScope && activeGroupId ? activeGroupId : undefined;
  const canPostPermission = useCallback(
    (key: Parameters<typeof hasPostPermission>[1]) => hasPostPermission(scopePermissions, key, isGroupScope),
    [isGroupScope, scopePermissions]
  );
  const canPin = canPostPermission('pin');
  const canReview = canPostPermission('review');
  const canManageTags = canPostPermission('tagManage');
  const canSeeTrash = canPostPermission('restore') || canPostPermission('purge');
  const pinnedCount = useMemo(() => posts.filter((post) => post.isPinned).length, [posts]);

  useEffect(() => {
    if ((view === 'review' && !canReview) || (view === 'trash' && !canSeeTrash)) {
      // Wait for permissions before falling back, so a deep link (?view=review) survives the first render.
      const loaded = isGroupScope ? Boolean(activeGroupPermissions) : isSystemPermissionsLoaded;
      if (loaded) setView('feed');
    }
  }, [activeGroupPermissions, canReview, canSeeTrash, isGroupScope, isSystemPermissionsLoaded, view]);

  // Deep link from the inbox: `?view=review` (review requests) or `?view=trash`.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    if (requested === 'review' || requested === 'trash') setView(requested);
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const response = await getPostUnreadCount(scopeGroup);
      setUnreadCount(numberField(response.data, ['unread'], 0));
    } catch {
      setUnreadCount(0);
    }
  }, [scopeGroup]);

  const loadTags = useCallback(async () => {
    try {
      const response = await getPostTags(scopeGroup);
      setTags(normalizeTagList(response.data));
    } catch {
      setTags([]);
    }
  }, [scopeGroup]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      if (isGroupScope && activeGroupId) {
        await ensureGroupPermissions(activeGroupId);
      }
      const response = await getPostPanel(scopeGroup, {
        page_number: 1,
        load_post_number: 50,
        status: statusFilter || undefined,
        tag_id: tagFilterId || undefined
      });
      setPosts(normalizePostList(response.data));
      void loadUnread();
    } catch {
      setPosts([]);
      toast.error(t('toasts.loadPostsError'));
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, ensureGroupPermissions, isGroupScope, loadUnread, scopeGroup, statusFilter, t, tagFilterId]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (tagFilterId && !tags.some((tag) => tag.id === tagFilterId)) setTagFilterId('');
  }, [tagFilterId, tags]);

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
    // Remove mode check so groups always load, enabling group name display
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

    const postToDelete = posts.find(p => p.id === deletingPostId);
    if (!postToDelete) {
      return;
    }

    const canDelete = isGroupScope
      ? canDeleteGroupPost(user?.id, postToDelete.authorId, activeGroupPermissions || {})
      : canDeleteGlobalPost(user?.id, postToDelete.authorId, systemPermissions);

    if (!canDelete) {
      return;
    }

    try {
      await deletePost(scopeGroup, deletingPostId);

      setDeletingPostId('');
      await loadPosts();
      toast.success(t('toasts.postTrashed'));
    } catch {
      toast.error(t('toasts.postDeleteError'));
    }
  };

  const canManageCategories = canCreateCategory || canModifyCategory || canDeleteCategory;
  const createEditorHref = useMemo(() => {
    if (isGroupScope && activeGroupId) {
      return `/${locale}/groups/${encodeURIComponent(activeGroupId)}/posts/new`;
    }

    return `/${locale}/posts/new`;
  }, [activeGroupId, isGroupScope, locale]);

  const selectedGroupName = useMemo(() => {
    if (!activeGroupId) {
      return t('filters.globalFeed');
    }

    const selectedGroup = groups.find((group) => group.id === activeGroupId);
    return selectedGroup?.name ?? t('filters.globalFeed');
  }, [groups, activeGroupId, t]);

  const statusOptions = useMemo(() => POST_STATUSES.map((status) => ({ id: status, name: t(`status.${status}`) })), [t]);

  const selectedTagName = useMemo(() => {
    const tag = tags.find((item) => item.id === tagFilterId);
    return tag ? `#${tag.name}` : t('filters.allTags');
  }, [t, tagFilterId, tags]);

  const feedTabs = useMemo(
    () =>
      [
        { key: 'feed' as FeedView, label: t('views.feed'), icon: <FileText size={14} /> },
        ...(canReview ? [{ key: 'review' as FeedView, label: t('views.review'), icon: <ClipboardCheck size={14} /> }] : []),
        ...(canSeeTrash ? [{ key: 'trash' as FeedView, label: t('views.trash'), icon: <Trash2 size={14} /> }] : [])
      ],
    [canReview, canSeeTrash, t]
  );

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
      router.push(`/${locale}/groups/${encodeURIComponent(activeGroupId)}/posts/${encodedPostId}`);
      return;
    }

    router.push(`/${locale}/posts/${encodedPostId}`);
  };

  const openPostEditor = (postId: string) => {
    const encodedPostId = encodeURIComponent(postId);

    if (isGroupScope && activeGroupId) {
      router.push(`/${locale}/groups/${encodeURIComponent(activeGroupId)}/posts/${encodedPostId}/edit`);
      return;
    }

    router.push(`/${locale}/posts/${encodedPostId}/edit`);
  };

  const copyPostLink = async (postId: string) => {
    const encodedPostId = encodeURIComponent(postId);
    const path = isGroupScope && activeGroupId ? `/${locale}/groups/${encodeURIComponent(activeGroupId)}/posts/${encodedPostId}` : `/${locale}/posts/${encodedPostId}`;
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('toasts.linkCopied'));
    } catch {
      toast.error(t('toasts.linkCopyError'));
    }
  };

  const togglePin = async (post: PostModel) => {
    const next = !post.isPinned;
    if (next && pinnedCount >= MAX_PINNED_PER_SCOPE) {
      toast.error(t('toasts.pinLimit'));
      return;
    }

    setPinBusyId(post.uuid);
    try {
      await pinPost(scopeGroup, post.id, next);
      toast.success(next ? t('toasts.pinned') : t('toasts.unpinned'));
      await loadPosts();
    } catch (error) {
      const status = httpStatus(error);
      toast.error(status === 400 || status === 422 ? t('toasts.pinLimit') : t('toasts.pinError'));
    } finally {
      setPinBusyId('');
    }
  };

  // ── group.post.read gate (Silent Policy) ─────────────────────────
  // In group mode, if permissions are loaded but "group.post.read" is
  // false, render an empty page silently — no error message.
  if (mode === 'group' && activeGroupId) {
    const groupPermStatus = groupPermissionsStatusById[activeGroupId];
    const permissionsLoaded = groupPermStatus === 'loaded' || groupPermStatus === 'error';
    if (permissionsLoaded && !hasPermissionRequirement(activeGroupPermissions || {}, { anyOf: ['group.post.read'] })) {
      return null;
    }
  }

  return (
    <Tooltip.Provider delayDuration={100}>
      <section className="posts-page">
        <div className="page-header posts-header">
          <div className="page-title-section">
            <h1 className="page-title posts-page-title inline-flex items-center gap-2 flex-wrap">
              <FileText size={20} className="page-title-icon" />
              <span>{mode === 'group' ? t('groupTitle') : t('title')}</span>
              {isGroupScope && selectedGroupName !== t('filters.globalFeed') && (
                <span className="text-[var(--text-secondary)] font-normal text-[15px]">
                  — {selectedGroupName}
                </span>
              )}
            </h1>
            <span className="page-count-badge">{t('stats.postCount', { count: filteredPosts.length })}</span>
            {unreadCount > 0 && (
              <span className="page-count-badge inline-flex items-center gap-1 text-[var(--accent)]">
                <CircleDot size={11} />
                {t('stats.unread', { count: unreadCount })}
              </span>
            )}
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

                {view === 'feed' && (
                  <div className="filter-group">
                    <Select.Root value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : (value as PostStatus))}>
                      <Select.Trigger className="filter-select filter-chip" aria-label={t('filters.status')}>
                        <CircleDot size={14} className="filter-icon" />
                        <Select.Value>{statusFilter ? t(`status.${statusFilter}`) : t('filters.allStatuses')}</Select.Value>
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
                              <Select.ItemText>{t('filters.allStatuses')}</Select.ItemText>
                            </Select.Item>
                            {statusOptions.map((item) => (
                              <Select.Item key={item.id} value={item.id} className="posts-select-item">
                                <Select.ItemIndicator className="select-indicator">
                                  <Check size={14} />
                                </Select.ItemIndicator>
                                <Select.ItemText>{item.name}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                )}

                {view === 'feed' && tags.length > 0 && (
                  <div className="filter-group">
                    <Select.Root value={tagFilterId || 'all'} onValueChange={(value) => setTagFilterId(value === 'all' ? '' : value)}>
                      <Select.Trigger className="filter-select filter-chip" aria-label={t('filters.tag')}>
                        <Hash size={14} className="filter-icon" />
                        <Select.Value>{selectedTagName}</Select.Value>
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
                              <Select.ItemText>{t('filters.allTags')}</Select.ItemText>
                            </Select.Item>
                            {tags.map((item) => (
                              <Select.Item key={item.id} value={item.id} className="posts-select-item">
                                <Select.ItemIndicator className="select-indicator">
                                  <Check size={14} />
                                </Select.ItemIndicator>
                                <Select.ItemText>{item.name}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                )}

                {canManageTags && (
                  <button className="btn-secondary filter-chip" type="button" onClick={() => setTagModalOpen(true)}>
                    <Hash size={14} />
                    <span>{t('filters.manageTags')}</span>
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

        {(canReview || canSeeTrash) && (
          <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border-subtle)]" role="tablist">
            {feedTabs.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] ${
                  view === key
                    ? 'border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}

        {view === 'review' ? (
          <PostReviewQueue groupId={scopeGroup} onChanged={() => void loadPosts()} />
        ) : view === 'trash' ? (
          <PostTrashView
            groupId={scopeGroup}
            canRestore={canPostPermission('restore')}
            canPurge={canPostPermission('purge')}
            onRestored={() => void loadPosts()}
          />
        ) : loading ? (
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
              const excerpt = getFormattedExcerpt(post.body, 150);
              const pinned = post.isPinned;

              const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPost(post.id);
                }
              };

              return (
                <article key={post.uuid} className="post-card">
                  <div className="post-card-header">
                    <div className="post-card-author">
                      <Avatar.Root className="post-avatar">
                        <Avatar.Fallback className="post-avatar-fallback">{authorName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                      </Avatar.Root>
                      <div className="post-author-info">
                        <span className="post-author-name inline-flex items-center gap-1.5">
                          {authorName}
                          {!post.isRead && (
                            <span className="size-2 rounded-full bg-[var(--accent)]" title={t('unreadPost')} aria-label={t('unreadPost')} />
                          )}
                        </span>
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
                            <DropdownMenu.Item className="posts-dropdown-item" onClick={() => void copyPostLink(post.id)}>
                              <Copy size={14} />
                              <span>{t('actions.copyLink')}</span>
                            </DropdownMenu.Item>
                            {canPin && post.status === 'published' && (
                              <DropdownMenu.Item
                                className="posts-dropdown-item"
                                disabled={pinBusyId === post.uuid}
                                onClick={() => void togglePin(post)}
                              >
                                {post.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                <span>{post.isPinned ? t('actions.unpin') : t('actions.pin')}</span>
                              </DropdownMenu.Item>
                            )}
                            {/* ── Edit menu item (Silent Policy: hidden if no permission) ── */}
                            {(() => {
                              const currentUserId = user?.id || (user as any)?.user_id;
                              const canEdit = isGroupScope
                                ? canModifyGroupPost(
                                    currentUserId,
                                    post.authorId,
                                    activeGroupPermissions || {}
                                  )
                                : canModifyGlobalPost(
                                    currentUserId,
                                    post.authorId,
                                    systemPermissions
                                  );
                              if (!canEdit) return null;
                              return (
                                <DropdownMenu.Item className="posts-dropdown-item" onClick={() => openPostEditor(post.id)}>
                                  <Pencil size={14} />
                                  <span>{t('actions.edit')}</span>
                                </DropdownMenu.Item>
                              );
                            })()}
                            <DropdownMenu.Separator className="posts-dropdown-separator" />
                            {/* ── Delete menu item (Silent Policy: hidden if no permission) ── */}
                            {(() => {
                              const currentUserId = user?.id || (user as any)?.user_id;
                              const canDelete = isGroupScope
                                ? canDeleteGroupPost(
                                    currentUserId,
                                    post.authorId,
                                    activeGroupPermissions || {}
                                  )
                                : canDeleteGlobalPost(
                                    currentUserId,
                                    post.authorId,
                                    systemPermissions
                                  );
                              if (!canDelete) return null;
                              return (
                                <DropdownMenu.Item
                                  className="posts-dropdown-item danger"
                                  onClick={() => setDeletingPostId(post.id)}
                                >
                                  <Trash2 size={14} />
                                  <span>{t('actions.delete')}</span>
                                </DropdownMenu.Item>
                              );
                            })()}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </div>

                  <div className="post-card-body" role="link" tabIndex={0} onKeyDown={onCardKeyDown} onClick={() => openPost(post.id)}>
                    <h3 className="post-card-title">{titleLabel}</h3>
                    {excerpt.text && <p className="post-card-excerpt">{excerpt.text}</p>}
                    {(excerpt.hasCode || excerpt.hasImage) && (
                      <div className="post-card-content-hints">
                        {excerpt.hasCode && (
                          <span className="content-hint">
                            <Code size={11} />
                            {t('contentHints.hasCode')}
                          </span>
                        )}
                        {excerpt.hasImage && (
                          <span className="content-hint">
                            <ImageIcon size={11} />
                            {t('contentHints.hasImage')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="post-card-footer">
                    <div className="post-card-tags">
                      {categoryLabel && (
                        <span className="post-category-badge">
                          <Tag size={11} />
                          {categoryLabel}
                        </span>
                      )}
                      {post.tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className="post-category-badge"
                          onClick={() => setTagFilterId(tag.id)}
                        >
                          <Hash size={11} />
                          {tag.name}
                        </button>
                      ))}
                    </div>

                    <div className="post-card-stats">
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

        <PostTagManagerModal
          open={tagModalOpen}
          groupId={scopeGroup}
          tags={tags}
          onClose={() => setTagModalOpen(false)}
          onChanged={() => void loadTags()}
        />

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
