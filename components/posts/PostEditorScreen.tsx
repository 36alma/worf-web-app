'use client';

import Link from 'next/link';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import {ArrowLeft, Check, ChevronDown, Eye, FileText, Globe, Loader2, PenLine, Save, Send, Tag, Type} from 'lucide-react';
import {FormEvent, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import Button from '@/components/ui/Button';
import {
  createGlobalPost,
  createGroupPost,
  getGlobalPost,
  getGlobalPostCategories,
  getGroupPost,
  getGroupPostCategories,
  modifyGlobalPost,
  modifyGroupPost
} from '@/lib/api/posts';

type RawObject = Record<string, unknown>;
type PostStatus = 'draft' | 'published' | 'scheduled';

interface PostCategory {
  id: string;
  name: string;
}

interface Snapshot {
  title: string;
  body: string;
  categoryId: string;
  status: PostStatus;
}

interface PostEditorScreenProps {
  scope: 'global' | 'group';
  groupId?: string;
  postId?: string;
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
        name: String(row.name ?? row.category_name ?? id)
      };
    })
    .filter((row): row is PostCategory => Boolean(row));
};

const normalizeSinglePost = (payload: unknown): Snapshot => {
  const source = readData(payload);

  if (!source || typeof source !== 'object') {
    return {title: '', body: '', categoryId: '', status: 'draft'};
  }

  const root = source as RawObject;
  const nestedPost = root.post && typeof root.post === 'object' ? (root.post as RawObject) : root;
  const nestedCategory = root.category && typeof root.category === 'object' ? (root.category as RawObject) : null;
  const statusValue = String(nestedPost.status ?? root.status ?? root.post_status ?? 'draft').toLowerCase();
  const normalizedStatus: PostStatus = statusValue === 'published' || statusValue === 'scheduled' ? statusValue : 'draft';

  return {
    title: String(nestedPost.title ?? root.title ?? ''),
    body: String(nestedPost.content ?? nestedPost.body ?? root.content ?? root.body ?? ''),
    categoryId: String(
      nestedCategory?.category_id ??
        nestedCategory?.post_category_id ??
        nestedCategory?.id ??
        nestedPost.category_id ??
        nestedPost.post_category_id ??
        root.post_category_id ??
        root.category_id ??
        ''
    ),
    status: normalizedStatus
  };
};

const trimSnapshot = (value: Snapshot): Snapshot => ({
  title: value.title.trim(),
  body: value.body.trim(),
  categoryId: value.categoryId,
  status: value.status
});

export default function PostEditorScreen({scope, groupId = '', postId = ''}: PostEditorScreenProps) {
  const locale = useLocale();
  const postsT = useTranslations('posts');
  const formT = useTranslations('posts.form');
  const editT = useTranslations('posts.edit');
  const actionsT = useTranslations('posts.actions');
  const editorT = useTranslations('editor');
  const router = useRouter();

  const resolvedPostId = useMemo(() => {
    const trimmed = postId.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
      return '';
    }

    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }, [postId]);

  const isEdit = Boolean(resolvedPostId);
  const backHref = scope === 'group' ? `/${locale}/groups/${groupId}/posts` : `/${locale}/posts`;
  const previewHref =
    scope === 'group' ? `/${locale}/groups/${groupId}/posts/${encodeURIComponent(resolvedPostId)}` : `/${locale}/posts/${encodeURIComponent(resolvedPostId)}`;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<PostStatus>('draft');
  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot>({title: '', body: '', categoryId: '', status: 'draft'});
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState('');
  const [saveIntent, setSaveIntent] = useState<'draft' | 'published' | null>(null);

  const currentSnapshot = useMemo(() => trimSnapshot({title, body, categoryId, status}), [title, body, categoryId, status]);
  const hasChanges = useMemo(() => JSON.stringify(currentSnapshot) !== JSON.stringify(trimSnapshot(initialSnapshot)), [currentSnapshot, initialSnapshot]);
  const canSubmit = useMemo(() => title.trim().length > 0 && body.trim().length > 0, [title, body]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const categoriesResponse =
          scope === 'group' && groupId ? await getGroupPostCategories({group_id: groupId, limit: 200}) : await getGlobalPostCategories({limit: 200});
        const loadedCategories = normalizeCategories(categoriesResponse.data);

        if (mounted) {
          setCategories(loadedCategories);
        }

        if (isEdit) {
          const postResponse =
            scope === 'group' && groupId ? await getGroupPost(groupId, resolvedPostId) : await getGlobalPost(resolvedPostId);
          const normalized = normalizeSinglePost(postResponse.data);

          if (mounted) {
            setTitle(normalized.title);
            setBody(normalized.body);
            setCategoryId(normalized.categoryId);
            setStatus(normalized.status);
            setInitialSnapshot(normalized);
          }
        } else if (mounted) {
          const fresh: Snapshot = {title: '', body: '', categoryId: '', status: 'draft'};
          setInitialSnapshot(fresh);
        }
      } catch {
        toast.error(editT('loadError'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [editT, groupId, isEdit, resolvedPostId, scope]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges || submitting) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges, submitting]);

  const navigateWithUnsavedGuard = (target: string) => {
    if (submitting) {
      return;
    }

    if (hasChanges) {
      setPendingNavigation(target);
      setUnsavedOpen(true);
      return;
    }

    router.push(target);
  };

  const completeSave = (saved: Snapshot) => {
    setInitialSnapshot(saved);
    const now = new Date();
    setLastSavedAt(
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now)
    );
  };

  const handleSave = async (nextStatus?: 'draft' | 'published') => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      return;
    }

    const persistedStatus: PostStatus = nextStatus ?? status;

    try {
      setSubmitting(true);
      setSaveIntent(nextStatus ?? 'published');

      if (isEdit) {
        if (scope === 'group' && groupId) {
          await modifyGroupPost({
            group_id: groupId,
            post_id: resolvedPostId,
            title: trimmedTitle,
            body: trimmedBody,
            category_id: categoryId || undefined,
            status: persistedStatus
          });
        } else {
          await modifyGlobalPost({
            post_id: resolvedPostId,
            title: trimmedTitle,
            body: trimmedBody,
            category_id: categoryId || undefined,
            status: persistedStatus
          });
        }
      } else if (scope === 'group' && groupId) {
        await createGroupPost({
          group_id: groupId,
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined,
          status: persistedStatus
        });
      } else {
        await createGlobalPost({
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined,
          status: persistedStatus
        });
      }

      setStatus(persistedStatus);
      completeSave({title: trimmedTitle, body: trimmedBody, categoryId, status: persistedStatus});
      toast.success(editT('saveSuccess'));

      if (!isEdit) {
        router.push(backHref);
        router.refresh();
      }
    } catch {
      toast.error(editT('saveError'));
    } finally {
      setSubmitting(false);
      setSaveIntent(null);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await handleSave('published');
  };

  return (
    <section className="space-y-6">
      <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/${locale}/dashboard`} className="hover:text-[var(--text-primary)]">
          Dashboard
        </Link>
        <ChevronDown size={14} className="breadcrumb-sep rotate-[-90deg]" />
        <Link href={backHref} className="hover:text-[var(--text-primary)]">
          {postsT('title')}
        </Link>
        <ChevronDown size={14} className="breadcrumb-sep rotate-[-90deg]" />
        <span className="breadcrumb-current">{editT('pageTitle')}</span>
      </nav>

      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div className="page-title-section min-w-0">
          <div className="page-title-row flex items-center gap-2">
            <h1 className="page-title flex items-center gap-2 text-[20px] font-semibold leading-[1.3] text-[var(--text-primary)]">
              <FileText size={20} />
              {isEdit ? editT('pageTitle') : postsT('editor.create_title')}
            </h1>
            {scope === 'global' && (
              <span className="scope-badge inline-flex items-center gap-1 rounded-[6px] bg-[rgba(136,136,136,0.10)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.03em] text-[var(--text-secondary)]">
                <Globe size={12} strokeWidth={1.75} />
                {postsT('detail.global')}
              </span>
            )}
          </div>
          <p className="page-subtitle mt-1 text-[13px] text-[var(--text-tertiary)]">
            {submitting ? editT('saving') : hasChanges ? editT('unsavedChanges') : `${editT('saved')}${lastSavedAt ? ` - ${lastSavedAt}` : ''}`}
          </p>
        </div>

        <div className="page-actions editor-page-actions flex items-center gap-2">
          <Button variant="secondary" className="p-2" startIcon={<ArrowLeft size={16} strokeWidth={1.75} />} onClick={() => navigateWithUnsavedGuard(backHref)}>
            {actionsT('back')}
          </Button>
          {isEdit && (
            <Button
              variant="secondary"
              className="p-2"
              startIcon={<Eye size={16} strokeWidth={1.75} />}
              onClick={() => window.open(previewHref, '_blank', 'noopener,noreferrer')}
            >
              {editT('preview')}
            </Button>
          )}
          <Button
            variant="secondary"
            className="p-2"
            startIcon={submitting && saveIntent === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={1.75} />}
            onClick={() => void handleSave('draft')}
            disabled={!canSubmit || loading || submitting}
          >
            {editT('saveDraft')}
          </Button>
          <Button
            type="submit"
            form="post-editor-form"
            className="p-2"
            disabled={!canSubmit || submitting || loading}
            startIcon={submitting && saveIntent === 'published' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.75} />}
          >
            {status === 'published' ? editT('updatePost') : editT('publishPost')}
          </Button>
        </div>
      </div>

      <form id="post-editor-form" className="post-form space-y-6" onSubmit={onSubmit}>
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">{editT('loading')}</p>
        ) : (
          <>
            <section className="form-section">
              <div className="form-section-header mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-[13px] font-semibold text-[var(--text-secondary)]">
                <FileText size={16} strokeWidth={1.75} />
                <span>{formT('basics')}</span>
              </div>

              <div className="form-row mb-4">
                <div className="form-group">
                  <Label.Root htmlFor="post-title" className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Type size={14} strokeWidth={1.75} />
                    {formT('postTitle')}
                  </Label.Root>
                  <input
                    id="post-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={formT('postTitlePlaceholder')}
                    className="form-input h-10 w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)] focus:shadow-[0_0_0_2px_rgba(255,107,44,0.08)]"
                    maxLength={120}
                  />
                </div>
              </div>

              <div className="form-row form-row-2col grid gap-4 md:grid-cols-2">
                <div className="form-group">
                  <Label.Root className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Tag size={14} strokeWidth={1.75} />
                    {formT('category')}
                  </Label.Root>
                  <Select.Root value={categoryId || 'none'} onValueChange={(value) => setCategoryId(value === 'none' ? '' : value)}>
                    <Select.Trigger className="select-trigger inline-flex h-10 w-full items-center justify-between rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)]">
                      <Select.Value placeholder={formT('category')} />
                      <Select.Icon>
                        <ChevronDown size={16} strokeWidth={1.75} />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="select-content dropdown-content z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                        <Select.Viewport className="select-viewport p-1">
                          <Select.Item value="none" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{formT('noCategory')}</Select.ItemText>
                          </Select.Item>
                          {categories.map((category) => (
                            <Select.Item key={category.id} value={category.id} className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                              <Select.ItemText>{category.name}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>

                <div className="form-group">
                  <Label.Root className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Check size={14} strokeWidth={1.75} />
                    {formT('status')}
                  </Label.Root>
                  <Select.Root value={status} onValueChange={(value) => setStatus(value as PostStatus)}>
                    <Select.Trigger className="select-trigger inline-flex h-10 w-full items-center justify-between rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)]">
                      <Select.Value />
                      <Select.Icon>
                        <ChevronDown size={16} strokeWidth={1.75} />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="select-content dropdown-content z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                        <Select.Viewport className="select-viewport p-1">
                          <Select.Item value="draft" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{postsT('status.draft')}</Select.ItemText>
                          </Select.Item>
                          <Select.Item value="published" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{postsT('status.published')}</Select.ItemText>
                          </Select.Item>
                          <Select.Item value="scheduled" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{postsT('status.scheduled')}</Select.ItemText>
                          </Select.Item>
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-header mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-[13px] font-semibold text-[var(--text-secondary)]">
                <PenLine size={16} strokeWidth={1.75} />
                <span>{formT('content')}</span>
              </div>

              <MarkdownEditor
                value={body}
                onChange={setBody}
                placeholder={editorT('placeholder')}
                rows={26}
                i18n={{
                  toolbar: {
                    paragraph: editorT('toolbar.paragraph'),
                    bold: editorT('toolbar.bold'),
                    italic: editorT('toolbar.italic'),
                    strikethrough: editorT('toolbar.strikethrough'),
                    heading1: editorT('toolbar.heading1'),
                    heading2: editorT('toolbar.heading2'),
                    alignLeft: editorT('toolbar.alignLeft'),
                    alignCenter: editorT('toolbar.alignCenter'),
                    alignRight: editorT('toolbar.alignRight'),
                    blockquote: editorT('toolbar.blockquote'),
                    bulletList: editorT('toolbar.bulletList'),
                    orderedList: editorT('toolbar.orderedList'),
                    taskList: editorT('toolbar.taskList'),
                    codeBlock: editorT('toolbar.codeBlock'),
                    horizontalRule: editorT('toolbar.horizontalRule'),
                    link: editorT('toolbar.link'),
                    image: editorT('toolbar.image'),
                    table: editorT('toolbar.table')
                  },
                  prompts: {
                    linkUrl: editorT('prompts.link_url'),
                    imageUrl: editorT('prompts.image_url')
                  },
                  autosave: {
                    saving: editorT('autosave.saving'),
                    saved: editorT('autosave.saved'),
                    atSuffix: editorT('autosave.at_suffix')
                  },
                  table: {
                    insertTable: editorT('table.insertTable'),
                    selectSize: editorT('table.selectSize'),
                    addRowBefore: editorT('table.addRowBefore'),
                    addRowAfter: editorT('table.addRowAfter'),
                    deleteRow: editorT('table.deleteRow'),
                    addColumnBefore: editorT('table.addColumnBefore'),
                    addColumnAfter: editorT('table.addColumnAfter'),
                    deleteColumn: editorT('table.deleteColumn'),
                    mergeCells: editorT('table.mergeCells'),
                    splitCell: editorT('table.splitCell'),
                    toggleHeader: editorT('table.toggleHeader'),
                    deleteTable: editorT('table.deleteTable'),
                    addRow: editorT('table.addRow'),
                    addColumn: editorT('table.addColumn'),
                    rowOperations: editorT('table.rowOperations'),
                    columnOperations: editorT('table.columnOperations'),
                    cellOperations: editorT('table.cellOperations')
                  }
                }}
              />
            </section>
          </>
        )}
      </form>

      <ConfirmDialog
        open={unsavedOpen}
        title={editT('unsavedTitle')}
        message={editT('unsavedDescription')}
        cancelLabel={editT('stayHere')}
        confirmLabel={editT('leaveWithout')}
        onCancel={() => {
          setUnsavedOpen(false);
          setPendingNavigation('');
        }}
        onConfirm={() => {
          const target = pendingNavigation;
          setUnsavedOpen(false);
          setPendingNavigation('');
          if (target) {
            router.push(target);
          }
        }}
      />
    </section>
  );
}
