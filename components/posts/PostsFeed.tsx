'use client';

import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {getUserGroups} from '@/lib/api/groups';
import {
  createGlobalPost,
  createGroupPost,
  getGlobalPosts,
  getGroupPosts,
  modifyGroupPost
} from '@/lib/api/posts';
import {getGroupPermissions} from '@/lib/api/permissions';
import {hasPermissionRequirement} from '@/lib/permissions/access';
import {usePermissionStore} from '@/lib/store/permissionStore';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

type RawObject = Record<string, unknown>;

interface GroupItem {
  id: string;
  name: string;
}

interface PostItem {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
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

const normalizePosts = (payload: unknown): PostItem[] => {
  const source = readData(payload);
  const arrayValue = findArrayValue(source);

  return arrayValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as RawObject;
      const id = String(row.post_id ?? row.id ?? '');
      if (!id) {
        return null;
      }

      return {
        id,
        title: String(row.title ?? ''),
        body: String(row.body ?? row.content ?? ''),
        author: String(row.author_name ?? row.username ?? row.author ?? ''),
        createdAt: String(row.created_at ?? row.create_time ?? row.date ?? '')
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
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

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

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

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

  const resetCreateForm = () => {
    setCreateTitle('');
    setCreateBody('');
  };

  const resetEditForm = () => {
    setEditingPost(null);
    setEditTitle('');
    setEditBody('');
  };

  const onCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedTitle = createTitle.trim();
    const trimmedBody = createBody.trim();
    if (!trimmedTitle || !trimmedBody) {
      return;
    }

    try {
      setCreateSubmitting(true);
      if (isGroupScope && activeGroupId) {
        if (!canCreateInScope) {
          toast.error('Nincs jogod csoport poszt letrehozasra');
          return;
        }

        await createGroupPost({
          group_id: activeGroupId,
          title: trimmedTitle,
          body: trimmedBody
        });
      } else {
        if (!canCreateInScope) {
          toast.error('Nincs jogod globalis poszt letrehozasra');
          return;
        }

        await createGlobalPost({
          title: trimmedTitle,
          body: trimmedBody
        });
      }

      resetCreateForm();
      setCreateOpen(false);
      await loadPosts();
      toast.success('Poszt letrehozva');
    } catch {
      toast.error('Poszt letrehozas sikertelen');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const onStartEdit = (post: PostItem) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditBody(post.body);
  };

  const onEditSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingPost || !activeGroupId || !canEditInScope) {
      return;
    }

    const trimmedTitle = editTitle.trim();
    const trimmedBody = editBody.trim();
    if (!trimmedTitle || !trimmedBody) {
      return;
    }

    try {
      setEditSubmitting(true);
      await modifyGroupPost({
        group_id: activeGroupId,
        post_id: editingPost.id,
        title: trimmedTitle,
        body: trimmedBody
      });
      resetEditForm();
      await loadPosts();
      toast.success('Poszt frissitve');
    } catch {
      toast.error('Poszt szerkesztese sikertelen');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-font text-2xl">{mode === 'group' ? 'Group Posts' : t('title')}</h1>
        <div className="flex items-center gap-2">
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
          {canCreateInScope && (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Create Post
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="surface rounded-xl p-4 text-sm text-slate-300">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="surface rounded-xl p-4 text-sm text-slate-300">No posts yet.</div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <article key={post.id} className="surface card-animate rounded-xl p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="display-font text-lg">{post.title || 'Untitled post'}</h3>
                  <p className="text-xs text-slate-400">
                    {post.author || 'Unknown author'}
                    {post.createdAt ? ` • ${formatDate(post.createdAt, locale)}` : ''}
                  </p>
                </div>
                {canEditInScope && (
                  <Button type="button" variant="ghost" onClick={() => onStartEdit(post)}>
                    Edit
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{post.body || '-'}</p>
            </article>
          ))}
        </div>
      )}

      <Modal open={createOpen} title="Create Post" onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={onCreateSubmit}>
          <input
            value={createTitle}
            onChange={(event) => setCreateTitle(event.target.value)}
            placeholder="Post title"
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            maxLength={120}
          />
          <textarea
            value={createBody}
            onChange={(event) => setCreateBody(event.target.value)}
            placeholder="Write your post..."
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            rows={5}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSubmitting}>
              {createSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingPost)} title="Edit Post" onClose={resetEditForm}>
        <form className="space-y-3" onSubmit={onEditSubmit}>
          <input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="Post title"
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            maxLength={120}
          />
          <textarea
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            placeholder="Write your post..."
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            rows={5}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetEditForm} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={editSubmitting || !canEditInScope}>
              {editSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
