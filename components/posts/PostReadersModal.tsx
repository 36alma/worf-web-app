'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import {getPostReaders} from '@/lib/api/posts';
import {findArray, numberField} from '@/lib/posts/model';
import {formatDateTime} from '@/components/posts/PostReadScreen';

const PAGE_SIZE = 50;

interface Reader {
  key: string;
  name: string;
  readAt: string;
}

interface PostReadersModalProps {
  open: boolean;
  groupId?: string;
  postId: string;
  onClose: () => void;
}

export default function PostReadersModal({open, groupId, postId, onClose}: PostReadersModalProps) {
  const t = useTranslations('posts.readers');
  const locale = useLocale();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setError(false);
    getPostReaders(groupId, postId, page, PAGE_SIZE)
      .then((response) => {
        if (!mounted) return;
        const rows = findArray(response.data, ['readers']).map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            key: `${page}-${index}`,
            name: String(row.name ?? row.full_name ?? ''),
            readAt: String(row.read_at ?? '')
          };
        });
        setReaders((current) => (page === 1 ? rows : [...current, ...rows]));
        setTotal(numberField(response.data, ['total_readers'], rows.length));
      })
      .catch(() => mounted && setError(true))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [groupId, open, page, postId]);

  useEffect(() => {
    if (!open) setPage(1);
  }, [open]);

  return (
    <Modal open={open} title={t('title')} badge={total} onClose={onClose}>
      <div>
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">{t('privacyNote')}</p>
        {error ? (
          <p className="text-sm text-[var(--danger)]">{t('loadError')}</p>
        ) : readers.length === 0 && !loading ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {readers.map((reader) => (
              <li key={reader.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-[var(--text-primary)]">{reader.name || t('deletedUser')}</span>
                <time className="text-xs text-[var(--text-tertiary)]">{formatDateTime(reader.readAt, locale, '')}</time>
              </li>
            ))}
          </ul>
        )}
        {loading && <p className="mt-2 text-sm text-[var(--text-tertiary)]">{t('loading')}</p>}
        {!loading && readers.length < total && (
          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="ghost" onClick={() => setPage((current) => current + 1)}>
              {t('loadMore')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
