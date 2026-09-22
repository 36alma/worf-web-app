'use client';

import {FormEvent, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import FieldError from '@/components/ui/FieldError';
import {Input} from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import {buildPostEditorI18n} from '@/components/posts/postEditorI18n';
import {normalizeCategories, normalizeSinglePost, type PostCategory} from '@/components/posts/PostEditorScreen';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {requiredText} from '@/lib/validation';
import {createGroupPost, getGroupPost, getGroupPostCategories, modifyGroupPost} from '@/lib/api/posts';

const NO_CATEGORY = 'none';

export interface PostFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  groupId: string;
  /** Required in `edit` mode. */
  postId?: string;
  onClose: () => void;
  /** Fired after a successful save, before `onClose`. `id` is empty if the server did not echo it. */
  onSaved?: (post: {id: string; title: string}) => void;
}

/** Group post create/edit form in a modal — same fields, editor and API calls as the full-page PostEditorScreen. */
export default function PostFormModal({open, mode, groupId, postId, onClose, onSaved}: PostFormModalProps) {
  const formT = useTranslations('posts.form');
  const editT = useTranslations('posts.edit');
  const editorT = useTranslations('editor');
  const commonT = useTranslations('common');

  const isEdit = mode === 'edit' && Boolean(postId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const schemas = useMemo(() => ({title: requiredText(120)}), []);
  const {errors, validateField, validateAll} = useFieldValidation(schemas);
  const editorI18n = useMemo(() => buildPostEditorI18n((key) => editorT(key as never)), [editorT]);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const categoriesResponse = await getGroupPostCategories({group_id: groupId, limit: 200});
        const loaded = normalizeCategories(categoriesResponse.data);
        let snapshot = {title: '', body: '', categoryId: ''};
        if (isEdit && postId) {
          snapshot = normalizeSinglePost((await getGroupPost(groupId, postId)).data);
        }
        if (!mounted) return;
        setCategories(loaded);
        setTitle(snapshot.title);
        setBody(snapshot.body);
        setCategoryId(snapshot.categoryId);
      } catch {
        if (mounted) toast.error(editT('loadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [open, groupId, isEdit, postId, editT]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!validateAll({title}) || !trimmedBody || submitting) return;

    setSubmitting(true);
    try {
      if (isEdit && postId) {
        await modifyGroupPost({
          group_id: groupId,
          post_id: postId,
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined
        });
        onSaved?.({id: postId, title: trimmedTitle});
      } else {
        const {data} = await createGroupPost({
          group_id: groupId,
          title: trimmedTitle,
          body: trimmedBody,
          category_id: categoryId || undefined
        });
        const created = (data?.data ?? data) as Record<string, unknown> | undefined;
        onSaved?.({id: String(created?.post_id ?? created?.id ?? ''), title: trimmedTitle});
      }
      toast.success(editT('saveSuccess'));
      onClose();
    } catch {
      toast.error(editT('saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={isEdit ? editT('pageTitle') : formT('postTitle')} onClose={() => !submitting && onClose()}>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-[var(--text-secondary)]">{formT('postTitle')}</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={(event) => validateField('title', event.target.value)}
              placeholder={formT('postTitlePlaceholder')}
              maxLength={120}
              autoFocus
            />
            <FieldError messages={errors.title} />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-[var(--text-secondary)]">{formT('category')}</label>
            <Select value={categoryId || NO_CATEGORY} onValueChange={(value) => setCategoryId(value === NO_CATEGORY ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder={formT('category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>{formT('noCategory')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-[var(--text-secondary)]">{formT('content')}</label>
            <MarkdownEditor value={body} onChange={setBody} placeholder={editorT('placeholder')} rows={12} i18n={editorI18n} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              {commonT('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || !canSubmit}>
              {submitting ? editT('saving') : isEdit ? editT('updatePost') : editT('publishPost')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
