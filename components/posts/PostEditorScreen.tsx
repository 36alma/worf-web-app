'use client';

import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import {ArrowLeft, Check, ChevronDown, FileText, Globe, PenLine, Send, Tag, Type} from 'lucide-react';
import {FormEvent, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import Button from '@/components/ui/Button';
import {
  createGlobalPost,
  createGroupPost,
  getGlobalPostCategories,
  getGroupPost,
  getGroupPostCategories,
  modifyGroupPost
} from '@/lib/api/posts';

type RawObject = Record<string, unknown>;

interface PostCategory {
  id: string;
  name: string;
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

const normalizeSinglePost = (payload: unknown): {title: string; body: string; categoryId: string} => {
  const source = readData(payload);

  if (!source || typeof source !== 'object') {
    return {title: '', body: '', categoryId: ''};
  }

  const root = source as RawObject;
  const nestedPost = root.post && typeof root.post === 'object' ? (root.post as RawObject) : root;
  const nestedCategory =
    root.category && typeof root.category === 'object' ? (root.category as RawObject) : null;

  return {
    title: String(nestedPost.title ?? root.title ?? ''),
    body: String(nestedPost.content ?? nestedPost.body ?? root.content ?? root.body ?? ''),
    categoryId: String(nestedCategory?.category_id ?? root.post_category_id ?? root.category_id ?? '')
  };
};

export default function PostEditorScreen({scope, groupId = '', postId = ''}: PostEditorScreenProps) {
  const locale = useLocale();
  const t = useTranslations('posts.editor');
  const editorT = useTranslations('editor');
  const router = useRouter();
  const isEdit = Boolean(postId);
  const backHref = scope === 'group' ? `/${locale}/groups/${groupId}/posts` : `/${locale}/posts`;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('draft');

  const canSubmit = useMemo(() => title.trim().length > 0 && body.trim().length > 0, [title, body]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const categoriesResponse =
          scope === 'group' && groupId
            ? await getGroupPostCategories({group_id: groupId, limit: 200})
            : await getGlobalPostCategories({limit: 200});

        if (mounted) {
          setCategories(normalizeCategories(categoriesResponse.data));
        }

        if (isEdit) {
          if (scope !== 'group' || !groupId) {
            toast.error(t('toast_global_edit_not_supported_now'));
            router.replace(backHref);
            return;
          }

          const postResponse = await getGroupPost(groupId, postId);
          const normalized = normalizeSinglePost(postResponse.data);

          if (mounted) {
            setTitle(normalized.title);
            setBody(normalized.body);
            setCategoryId(normalized.categoryId);
          }
        }
      } catch {
        toast.error(t('toast_load_error'));
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
  }, [backHref, groupId, isEdit, postId, router, scope, t]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      return;
    }

    try {
      setSubmitting(true);

      if (isEdit) {
        if (scope !== 'group' || !groupId) {
          toast.error(t('toast_global_edit_not_supported'));
          return;
        }

        await modifyGroupPost({
          group_id: groupId,
          post_id: postId,
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined
        });
        toast.success(t('toast_updated'));
      } else if (scope === 'group' && groupId) {
        await createGroupPost({
          group_id: groupId,
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined
        });
        toast.success(t('toast_group_created'));
      } else {
        await createGlobalPost({
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined
        });
        toast.success(t('toast_global_created'));
      }

      router.push(backHref);
      router.refresh();
    } catch {
      toast.error(t('toast_save_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div className="page-title-section min-w-0">
          <div className="page-title-row flex items-center gap-2">
            <h1 className="page-title text-[20px] font-semibold leading-[1.3] text-[var(--text-primary)]">
              {isEdit ? t('edit_title') : t('create_title')}
            </h1>
            {scope === 'global' && (
              <span className="scope-badge inline-flex items-center gap-1 rounded-[6px] bg-[rgba(136,136,136,0.10)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.03em] text-[var(--text-secondary)]">
                <Globe size={12} strokeWidth={1.75} />
                {t('scope_global')}
              </span>
            )}
          </div>
          <p className="page-subtitle mt-1 text-[13px] text-[var(--text-tertiary)]">{isEdit ? t('subtitle_edit') : t('subtitle_create')}</p>
        </div>

        <div className="page-actions editor-page-actions flex items-center gap-2">
          <Button variant="secondary" className="p-2" startIcon={<ArrowLeft size={16} strokeWidth={1.75} />} onClick={() => router.push(backHref)}>
            {t('back')}
          </Button>
          <Button
            type="submit"
            form="post-editor-form"
            className="p-2"
            disabled={!canSubmit || submitting || loading}
            startIcon={<Send size={16} strokeWidth={1.75} />}
          >
            {submitting ? t('saving') : t('publish')}
          </Button>
        </div>
      </div>

      <form id="post-editor-form" className="post-form space-y-6" onSubmit={onSubmit}>
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">{t('loading')}</p>
        ) : (
          <>
            <section className="form-section">
              <div className="form-section-header mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 text-[13px] font-semibold text-[var(--text-secondary)]">
                <FileText size={16} strokeWidth={1.75} />
                <span>{t('basics')}</span>
              </div>

              <div className="form-row mb-4">
                <div className="form-group">
                  <Label.Root htmlFor="post-title" className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Type size={14} strokeWidth={1.75} />
                    {t('title_label')}
                  </Label.Root>
                  <input
                    id="post-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t('title_placeholder')}
                    className="form-input h-10 w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)] focus:shadow-[0_0_0_2px_rgba(255,107,44,0.08)]"
                    maxLength={120}
                  />
                </div>
              </div>

              <div className="form-row form-row-2col grid gap-4 md:grid-cols-2">
                <div className="form-group">
                  <Label.Root className="form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <Tag size={14} strokeWidth={1.75} />
                    {t('category_label')}
                  </Label.Root>
                  <Select.Root value={categoryId || 'none'} onValueChange={(value) => setCategoryId(value === 'none' ? '' : value)}>
                    <Select.Trigger className="select-trigger inline-flex h-10 w-full items-center justify-between rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)]">
                      <Select.Value placeholder={t('category_placeholder')} />
                      <Select.Icon>
                        <ChevronDown size={16} strokeWidth={1.75} />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="select-content dropdown-content z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                        <Select.Viewport className="select-viewport p-1">
                          <Select.Item value="none" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{t('no_category')}</Select.ItemText>
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
                    {t('status_label')}
                  </Label.Root>
                  <Select.Root value={status} onValueChange={setStatus}>
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
                            <Select.ItemText>{t('status_draft')}</Select.ItemText>
                          </Select.Item>
                          <Select.Item value="published" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{t('status_published')}</Select.ItemText>
                          </Select.Item>
                          <Select.Item value="scheduled" className="select-item cursor-pointer rounded-[6px] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-active)]">
                            <Select.ItemText>{t('status_scheduled')}</Select.ItemText>
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
                <span>{t('content')}</span>
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
    </section>
  );
}
