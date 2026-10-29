'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import {Textarea} from '@/components/ui/Textarea';

const MAX_LENGTH = 1000;

interface RejectReviewModalProps {
  open: boolean;
  postTitle: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (comment: string) => void;
}

/** The reviewer's reason is mandatory (1–1000 characters) and is shown to the author. */
export default function RejectReviewModal({open, postTitle, busy, onCancel, onConfirm}: RejectReviewModalProps) {
  const t = useTranslations('posts.review');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) setComment('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={t('rejectTitle')}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button variant="danger" onClick={() => onConfirm(comment.trim())} disabled={busy || !comment.trim()} loading={busy}>
            {t('reject')}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--text-secondary)]">{t('rejectDescription', {title: postTitle})}</p>
      <Textarea
        value={comment}
        maxLength={MAX_LENGTH}
        rows={5}
        autoFocus
        placeholder={t('rejectPlaceholder')}
        onChange={(event) => setComment(event.target.value)}
      />
      <p className="mt-1 text-right text-xs text-[var(--text-tertiary)]">
        {comment.length}/{MAX_LENGTH}
      </p>
    </Modal>
  );
}
