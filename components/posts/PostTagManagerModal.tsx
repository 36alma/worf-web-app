'use client';

import {FormEvent, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Hash, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import {createPostTag, deletePostTag} from '@/lib/api/posts';
import {httpStatus, type PostTag} from '@/lib/posts/model';

interface PostTagManagerModalProps {
  open: boolean;
  groupId?: string;
  tags: PostTag[];
  onClose: () => void;
  onChanged: () => void;
}

export default function PostTagManagerModal({open, groupId, tags, onClose, onChanged}: PostTagManagerModalProps) {
  const t = useTranslations('posts.tags');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<PostTag | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Uniqueness is case-insensitive on the backend.
    if (tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(t('duplicate'));
      return;
    }
    setBusy(true);
    try {
      await createPostTag(groupId, trimmed);
      setName('');
      toast.success(t('created'));
      onChanged();
    } catch (error) {
      toast.error(httpStatus(error) === 409 ? t('duplicate') : t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    const tag = deleting;
    setDeleting(null);
    if (!tag) return;
    try {
      await deletePostTag(groupId, tag.id);
      toast.success(t('deleted'));
      onChanged();
    } catch {
      toast.error(t('deleteError'));
    }
  };

  return (
    <Modal open={open} title={t('modalTitle')} badge={tags.length} onClose={onClose}>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('namePlaceholder')}
          maxLength={64}
          disabled={busy}
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
        />
        <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
          {t('create')}
        </Button>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {tags.length === 0 && <li className="text-sm text-[var(--text-tertiary)]">{t('empty')}</li>}
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] py-1 pl-2.5 pr-1 text-[13px] text-[var(--text-secondary)]"
          >
            <Hash size={12} />
            {tag.name}
            <button
              type="button"
              aria-label={t('delete')}
              onClick={() => setDeleting(tag)}
              className="ml-1 inline-flex size-6 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('deleteTitle')}
        message={t('deleteMessage', {name: deleting?.name ?? ''})}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
      />
    </Modal>
  );
}
