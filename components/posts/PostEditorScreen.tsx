'use client';

import Link from 'next/link';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileText,
  Globe,
  Hash,
  Link2,
  Loader2,
  PenLine,
  Save,
  Send,
  Settings2,
  Tag,
  Type,
  Undo2
} from 'lucide-react';
import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import MarkdownRenderer from '@/components/posts/MarkdownRenderer';
import PostLinksPicker from '@/components/posts/PostLinksPicker';
import PostPublishSettings, {type PublishSettingsValue} from '@/components/posts/PostPublishSettings';
import PostTagPicker from '@/components/posts/PostTagPicker';
import {buildPostEditorI18n} from '@/components/posts/postEditorI18n';
import Button from '@/components/ui/Button';
import FieldError from '@/components/ui/FieldError';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {usePostScope} from '@/hooks/usePostScope';
import {requiredText} from '@/lib/validation';
import {
  createPost,
  getGlobalPostCategories,
  getGroupPostCategories,
  getGroupPostReviewSettings,
  getPost,
  getPostTags,
  modifyPost,
  submitPostReview,
  withdrawPostReview,
  type PostWriteFields,
  type PostWriteStatus
} from '@/lib/api/posts';
import {
  httpStatus,
  normalizePost,
  normalizeTagList,
  readData,
  type PostLink,
  type PostReview,
  type PostStatus,
  type PostTag
} from '@/lib/posts/model';
import {browserTimeZone, isInFuture, isoToLocalInput, localInputToIso} from '@/lib/utils/zonedTime';

type RawObject = Record<string, unknown>;

export interface PostCategory {
  id: string;
  name: string;
}

interface Snapshot {
  title: string;
  body: string;
  categoryId: string;
}

interface LocalDraftSnapshot extends Snapshot {
  savedAt: string;
}

interface PostEditorScreenProps {
  scope: 'global' | 'group';
  groupId?: string;
  postId?: string;
}

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

export const normalizeCategories = (payload: unknown): PostCategory[] => {
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

export const normalizeSinglePost = (payload: unknown): Snapshot => {
  const post = normalizePost(payload);
  return post ? {title: post.title, body: post.body, categoryId: post.categoryId} : {title: '', body: '', categoryId: ''};
};

const trimSnapshot = (value: Snapshot): Snapshot => ({
  title: value.title.trim(),
  body: value.body.trim(),
  categoryId: value.categoryId
});

const ALL_STATUSES: PostWriteStatus[] = ['published', 'draft', 'scheduled', 'archived'];
// With mandatory review the member may only keep drafts; publishing goes through `submit`.
const REVIEW_STATUSES: PostWriteStatus[] = ['draft', 'archived'];

const sectionHeaderClass =
  'form-section-header mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-[13px] font-semibold text-[var(--text-secondary)]';

const createdPostId = (payload: unknown): string => {
  const post = normalizePost(payload);
  if (post) return post.id;
  const root = readData(payload) as RawObject | null;
  return String(root?.post_id ?? '');
};

export default function PostEditorScreen({scope, groupId = '', postId = ''}: PostEditorScreenProps) {
  const locale = useLocale();
  const postsT = useTranslations('posts');
  const formT = useTranslations('posts.form');
  const editT = useTranslations('posts.edit');
  const actionsT = useTranslations('posts.actions');
  const publishT = useTranslations('posts.publish');
  const reviewT = useTranslations('posts.review');
  const tagsT = useTranslations('posts.tags');
  const linksT = useTranslations('posts.links');
  const editorT = useTranslations('editor');
  const router = useRouter();

  const scopeGroupId = scope === 'group' ? groupId : '';
  const postScope = usePostScope(scopeGroupId);

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
  const backHref = scope === 'group' ? `/${locale}/groups/${encodeURIComponent(groupId)}/posts` : `/${locale}/posts`;
  const previewHref =
    scope === 'group' ? `/${locale}/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(resolvedPostId)}` : `/${locale}/posts/${encodeURIComponent(resolvedPostId)}`;
  const draftStorageKey = useMemo(() => {
    const targetId = isEdit ? resolvedPostId : 'new';
    return `worf:post-editor:draft:${scope}:${groupId || 'global'}:${targetId}`;
  }, [groupId, isEdit, resolvedPostId, scope]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [tags, setTags] = useState<PostTag[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [links, setLinks] = useState<PostLink[]>([]);
  const [settings, setSettings] = useState<PublishSettingsValue>(() => ({
    status: 'published',
    publishAt: '',
    expiresAt: '',
    timeZone: browserTimeZone(),
    commentsEnabled: true
  }));
  const [originalStatus, setOriginalStatus] = useState<PostStatus | null>(null);
  const [hadExpiry, setHadExpiry] = useState(false);
  const [review, setReview] = useState<PostReview | null>(null);
  const [requiresReview, setRequiresReview] = useState<boolean | null>(null);
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const [settingErrors, setSettingErrors] = useState<{publishAt?: string; expiresAt?: string}>({});
  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot>({title: '', body: '', categoryId: ''});
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState('');
  const [saveIntent, setSaveIntent] = useState<'draft' | 'publish' | 'submit' | null>(null);
  const draftRestoredRef = useRef(false);

  const isPending = originalStatus === 'pending_review';
  const canReview = postScope.can('review');
  const canManageReview = postScope.can('reviewManage');
  const reviewGate = scope === 'group' && requiresReview === true && !canReview;
  const statuses = reviewGate ? REVIEW_STATUSES : ALL_STATUSES;

  const currentSnapshot = useMemo(() => trimSnapshot({title, body, categoryId}), [title, body, categoryId]);
  const hasChanges = useMemo(() => JSON.stringify(currentSnapshot) !== JSON.stringify(trimSnapshot(initialSnapshot)), [currentSnapshot, initialSnapshot]);
  const canSubmit = useMemo(() => title.trim().length > 0 && body.trim().length > 0, [title, body]);
  const titleSchemas = useMemo(() => ({title: requiredText(120)}), []);
  const {errors: titleErrors, validateField: validateTitle, validateAll: validateTitleAll, clearError: clearTitleError} =
    useFieldValidation(titleSchemas);

  useEffect(() => {
    let mounted = true;
    const targetGroup = scope === 'group' && groupId ? groupId : undefined;

    const load = async () => {
      try {
        setLoading(true);
        const [categoriesResponse, tagsResponse] = await Promise.all([
          targetGroup ? getGroupPostCategories({group_id: targetGroup, limit: 200}) : getGlobalPostCategories({limit: 200}),
          getPostTags(targetGroup).catch(() => null)
        ]);

        if (mounted) {
          setCategories(normalizeCategories(categoriesResponse.data));
          setTags(tagsResponse ? normalizeTagList(tagsResponse.data) : []);
        }

        if (isEdit) {
          const post = normalizePost((await getPost(targetGroup, resolvedPostId)).data);
          if (mounted && post) {
            const zone = browserTimeZone();
            const snapshot = {title: post.title, body: post.body, categoryId: post.categoryId};
            setTitle(post.title);
            setBody(post.body);
            setCategoryId(post.categoryId);
            setTagIds(post.tags.map((tag) => tag.id));
            setLinks(post.links);
            setOriginalStatus(post.status);
            setReview(post.review);
            setHadExpiry(Boolean(post.expiresAt));
            setSettings({
              status: post.status === 'pending_review' ? 'draft' : post.status,
              publishAt: isoToLocalInput(post.publishAt, zone),
              expiresAt: isoToLocalInput(post.expiresAt, zone),
              timeZone: zone,
              commentsEnabled: post.commentsEnabled
            });
            // Tags are re-resolved against the scope list, but keep names for any not in it.
            setTags((current) => [...current, ...post.tags.filter((tag) => !current.some((item) => item.id === tag.id))]);
            setInitialSnapshot(snapshot);
          }
        } else if (mounted) {
          setInitialSnapshot({title: '', body: '', categoryId: ''});
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

  // The mandatory-review flag is only readable with `group.post.review.manage`; everyone else learns it from a 403.
  useEffect(() => {
    if (scope !== 'group' || !groupId || !canManageReview) return;
    let mounted = true;
    getGroupPostReviewSettings(groupId)
      .then((response) => {
        const root = readData(response.data) as RawObject | null;
        if (mounted) setRequiresReview(root?.require_post_review === true);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [canManageReview, groupId, scope]);

  useEffect(() => {
    if (reviewGate && !REVIEW_STATUSES.includes(settings.status)) {
      setSettings((current) => ({...current, status: 'draft'}));
    }
  }, [reviewGate, settings.status]);

  useEffect(() => {
    draftRestoredRef.current = false;
  }, [draftStorageKey]);

  useEffect(() => {
    if (loading || draftRestoredRef.current || typeof window === 'undefined' || isPending) {
      return;
    }

    draftRestoredRef.current = true;

    const savedDraft = window.localStorage.getItem(draftStorageKey);
    if (!savedDraft) {
      return;
    }

    try {
      const parsed = JSON.parse(savedDraft) as Partial<LocalDraftSnapshot>;
      const restored: Snapshot = {
        title: typeof parsed.title === 'string' ? parsed.title : '',
        body: typeof parsed.body === 'string' ? parsed.body : '',
        categoryId: typeof parsed.categoryId === 'string' ? parsed.categoryId : ''
      };

      if (JSON.stringify(trimSnapshot(restored)) === JSON.stringify(trimSnapshot(initialSnapshot))) {
        return;
      }

      setTitle(restored.title);
      setBody(restored.body);
      setCategoryId(restored.categoryId);
      toast.success(editT('draftRestored'));
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, editT, initialSnapshot, isPending, loading]);

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

  const handleLocalDraftSave = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const draftPayload: LocalDraftSnapshot = {
      ...currentSnapshot,
      savedAt: new Date().toISOString()
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
    setSaveIntent('draft');
    toast.success(editT('draftSavedLocal'));
    window.setTimeout(() => setSaveIntent((current) => (current === 'draft' ? null : current)), 600);
  };

  /** Validates the schedule/expiry pair and returns the extra write fields, or `null` on error. */
  const buildWriteFields = (status: PostWriteStatus): PostWriteFields | null => {
    const errors: {publishAt?: string; expiresAt?: string} = {};
    const publishAt = status === 'scheduled' ? localInputToIso(settings.publishAt, settings.timeZone) : '';
    const expiresAt = localInputToIso(settings.expiresAt, settings.timeZone);

    if (status === 'scheduled' && (!publishAt || !isInFuture(publishAt))) {
      errors.publishAt = publishT('errors.publishAtFuture');
    }
    if (expiresAt && !isInFuture(expiresAt)) {
      errors.expiresAt = publishT('errors.expiresAtFuture');
    } else if (expiresAt && publishAt && new Date(expiresAt) <= new Date(publishAt)) {
      errors.expiresAt = publishT('errors.expiresAfterPublish');
    }

    setSettingErrors(errors);
    if (errors.publishAt || errors.expiresAt) return null;

    return {
      status,
      tag_ids: tagIds,
      comments_enabled: settings.commentsEnabled,
      ...(publishAt ? {publish_at: publishAt} : {}),
      ...(expiresAt ? {expires_at: expiresAt} : isEdit && hadExpiry ? {clear_expires_at: true} : {}),
      ...(scope === 'group' ? {links: links.map(({type, id}) => ({type, id}))} : {})
    };
  };

  /** Creates or modifies the post; resolves to its id, throws the API error. */
  const persist = async (fields: PostWriteFields): Promise<string> => {
    const targetGroup = scope === 'group' && groupId ? groupId : undefined;
    const content = {title: title.trim(), body: body.trim(), category_id: categoryId || undefined, ...fields};

    if (isEdit) {
      await modifyPost(targetGroup, {post_id: resolvedPostId, ...content});
      return resolvedPostId;
    }
    const response = await createPost(targetGroup, content);
    return createdPostId(response.data);
  };

  const finishSave = (status: PostStatus, message: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftStorageKey);
    }
    completeSave({title: title.trim(), body: body.trim(), categoryId});
    setOriginalStatus(status);
    setHadExpiry(Boolean(settings.expiresAt));
    toast.success(message);
    if (!isEdit || status === 'pending_review') {
      router.push(backHref);
      router.refresh();
    }
  };

  const validateContent = () => validateTitleAll({title}) && Boolean(body.trim());

  const handleSave = async () => {
    if (!validateContent()) return;
    const fields = buildWriteFields(settings.status);
    if (!fields) return;

    try {
      setSubmitting(true);
      setSaveIntent('publish');
      await persist(fields);
      finishSave(settings.status, editT(`saved_${settings.status}`));
    } catch (error) {
      // A group with mandatory review refuses direct publish/schedule for non-reviewers.
      if (httpStatus(error) === 403 && scope === 'group' && !canReview && (settings.status === 'published' || settings.status === 'scheduled')) {
        setRequiresReview(true);
        setReviewPromptOpen(true);
      } else {
        toast.error(editT('saveError'));
      }
    } finally {
      setSubmitting(false);
      setSaveIntent(null);
    }
  };

  const handleSubmitForReview = async () => {
    setReviewPromptOpen(false);
    if (!validateContent()) return;
    const fields = buildWriteFields('draft');
    if (!fields) return;

    try {
      setSubmitting(true);
      setSaveIntent('submit');
      const id = await persist(fields);
      await submitPostReview(scope === 'group' ? groupId : undefined, id);
      finishSave('pending_review', reviewT('submitted'));
    } catch {
      toast.error(reviewT('submitError'));
    } finally {
      setSubmitting(false);
      setSaveIntent(null);
    }
  };

  const handleWithdraw = async () => {
    try {
      setSubmitting(true);
      await withdrawPostReview(scope === 'group' ? groupId : undefined, resolvedPostId);
      setOriginalStatus('draft');
      setSettings((current) => ({...current, status: 'draft'}));
      toast.success(reviewT('withdrawn'));
    } catch {
      toast.error(reviewT('withdrawError'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    if (reviewGate) {
      await handleSubmitForReview();
      return;
    }
    await handleSave();
  };

  const primaryLabel = reviewGate
    ? reviewT('submit')
    : settings.status === 'published'
      ? isEdit && originalStatus === 'published'
        ? editT('updatePost')
        : editT('publishPost')
      : editT(`submit_${settings.status}`);

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
            {originalStatus && (
              <span className={`post-status-badge status-${originalStatus}`}>{postsT(`status.${originalStatus}`)}</span>
            )}
          </div>
          <p className="page-subtitle mt-1 text-[13px] text-[var(--text-tertiary)]">
            {submitting ? editT('saving') : hasChanges ? editT('unsavedChanges') : `${editT('saved')}${lastSavedAt ? ` - ${lastSavedAt}` : ''}`}
          </p>
        </div>

        <div className="page-actions editor-page-actions flex flex-wrap items-center gap-2 justify-end">
          <Button
            variant="secondary"
            className="w-full flex-1 p-2 sm:w-auto sm:flex-none"
            startIcon={<ArrowLeft size={16} strokeWidth={1.75} />}
            onClick={() => navigateWithUnsavedGuard(backHref)}
          >
            {actionsT('back')}
          </Button>
          {isEdit && (
            <Button
              variant="secondary"
              className="w-full flex-1 p-2 sm:w-auto sm:flex-none"
              startIcon={<Eye size={16} strokeWidth={1.75} />}
              onClick={() => window.open(previewHref, '_blank', 'noopener,noreferrer')}
            >
              {editT('preview')}
            </Button>
          )}
          {isPending ? (
            <Button
              variant="secondary"
              className="w-full flex-1 p-2 sm:w-auto sm:flex-none"
              startIcon={<Undo2 size={16} strokeWidth={1.75} />}
              onClick={() => void handleWithdraw()}
              disabled={submitting}
            >
              {reviewT('withdraw')}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                type="button"
                className="w-full flex-1 p-2 sm:w-auto sm:flex-none"
                startIcon={saveIntent === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={1.75} />}
                onClick={handleLocalDraftSave}
                disabled={loading || submitting}
              >
                {editT('saveDraft')}
              </Button>
              <Button
                type="submit"
                form="post-editor-form"
                className="w-full flex-1 p-2 sm:w-auto sm:flex-none"
                disabled={!canSubmit || submitting || loading}
                startIcon={
                  submitting && saveIntent !== 'draft' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : reviewGate ? (
                    <ClipboardCheck size={16} strokeWidth={1.75} />
                  ) : (
                    <Send size={16} strokeWidth={1.75} />
                  )
                }
              >
                {primaryLabel}
              </Button>
            </>
          )}
        </div>
      </div>

      {isPending ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-secondary)]">
          <ClipboardCheck size={16} className="mt-0.5 shrink-0" />
          {reviewT('pendingLocked')}
        </div>
      ) : (
        <>
          {review?.decision === 'rejected' && review.comment && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-secondary)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">{reviewT('rejectedBanner')}</p>
                <p className="mt-1 whitespace-pre-wrap">{review.comment}</p>
              </div>
            </div>
          )}
          {reviewGate && <p className="text-sm text-[var(--text-secondary)]">{reviewT('requiredNotice')}</p>}
          <p className="text-sm text-[var(--text-secondary)]">{editT('draftNotice')}</p>
        </>
      )}

      <form id="post-editor-form" className="post-form space-y-6" onSubmit={onSubmit}>
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">{editT('loading')}</p>
        ) : (
          <fieldset disabled={isPending} className="space-y-6">
            <section className="form-section">
              <div className={sectionHeaderClass}>
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
                    onChange={(event) => {
                      setTitle(event.target.value);
                      clearTitleError('title');
                    }}
                    onBlur={(event) => validateTitle('title', event.target.value)}
                    placeholder={formT('postTitlePlaceholder')}
                    className="form-input h-10 w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)] focus:shadow-[0_0_0_2px_rgba(255,107,44,0.08)]"
                    maxLength={120}
                  />
                  <FieldError messages={titleErrors.title} />
                </div>
              </div>

              <div className="form-row mb-4">
                <div className="form-group">
                  <Label.Root className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Tag size={14} strokeWidth={1.75} />
                    {formT('category')}
                  </Label.Root>
                  <Select.Root value={categoryId || 'none'} onValueChange={(value) => setCategoryId(value === 'none' ? '' : value)} disabled={isPending}>
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
              </div>

              <div className="form-row">
                <div className="form-group">
                  <Label.Root className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Hash size={14} strokeWidth={1.75} />
                    {tagsT('label')}
                  </Label.Root>
                  <PostTagPicker tags={tags} value={tagIds} disabled={isPending} onChange={setTagIds} />
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className={sectionHeaderClass}>
                <Settings2 size={16} strokeWidth={1.75} />
                <span>{publishT('section')}</span>
              </div>
              <PostPublishSettings
                value={settings}
                statuses={statuses}
                disabled={isPending}
                errors={settingErrors}
                onChange={(patch) => {
                  setSettings((current) => ({...current, ...patch}));
                  setSettingErrors({});
                }}
              />
            </section>

            {scope === 'group' && groupId && (
              <section className="form-section">
                <div className={sectionHeaderClass}>
                  <Link2 size={16} strokeWidth={1.75} />
                  <span>{linksT('section')}</span>
                </div>
                <PostLinksPicker groupId={groupId} value={links} disabled={isPending} onChange={setLinks} />
              </section>
            )}

            <section className="form-section">
              <div className={sectionHeaderClass}>
                <PenLine size={16} strokeWidth={1.75} />
                <span>{formT('content')}</span>
              </div>

              {isPending ? (
                <MarkdownRenderer content={body} className="opacity-80" />
              ) : (
                <MarkdownEditor
                  value={body}
                  onChange={setBody}
                  placeholder={editorT('placeholder')}
                  rows={26}
                  i18n={buildPostEditorI18n((key) => editorT(key as never))}
                />
              )}
            </section>
          </fieldset>
        )}
      </form>

      <ConfirmDialog
        open={reviewPromptOpen}
        title={reviewT('requiredTitle')}
        message={reviewT('requiredPrompt')}
        confirmLabel={reviewT('submit')}
        onCancel={() => setReviewPromptOpen(false)}
        onConfirm={() => void handleSubmitForReview()}
      />

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
