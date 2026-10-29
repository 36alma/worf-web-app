'use client';

import {CheckSquare, FileText, Flag, Paperclip, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {PostLinkType} from '@/lib/api/posts';
import type {PostLink} from '@/lib/posts/model';

const ICONS: Record<PostLinkType, React.ReactNode> = {
  task: <CheckSquare size={12} />,
  sprint: <Flag size={12} />,
  minutes: <FileText size={12} />,
  file: <Paperclip size={12} />
};

interface PostLinkChipsProps {
  links: PostLink[];
  onOpen?: (link: PostLink) => void;
  onRemove?: (link: PostLink) => void;
}

export default function PostLinkChips({links, onOpen, onRemove}: PostLinkChipsProps) {
  const t = useTranslations('posts.links');
  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {links.map((link) => (
        <li
          key={`${link.type}:${link.id}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-0.5 pl-2 pr-1 text-[13px] text-[var(--text-secondary)]"
        >
          <button
            type="button"
            disabled={!onOpen}
            onClick={() => onOpen?.(link)}
            title={t(`types.${link.type}`)}
            className="inline-flex min-w-0 items-center gap-1 enabled:hover:text-[var(--text-primary)] disabled:cursor-default"
          >
            {ICONS[link.type]}
            <span className="truncate">{link.label}</span>
          </button>
          {onRemove ? (
            <button
              type="button"
              aria-label={t('remove')}
              onClick={() => onRemove(link)}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-[var(--bg-hover)]"
            >
              <X size={11} />
            </button>
          ) : (
            <span className="w-1" />
          )}
        </li>
      ))}
    </ul>
  );
}
