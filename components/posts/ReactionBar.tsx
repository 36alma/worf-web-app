'use client';

import * as Popover from '@radix-ui/react-popover';
import {SmilePlus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {PostReactionEmoji} from '@/lib/api/posts';
import {REACTION_EMOJI, REACTION_KEYS, type ReactionCounts} from '@/lib/posts/model';

interface ReactionBarProps {
  counts: ReactionCounts;
  mine: PostReactionEmoji[];
  available?: PostReactionEmoji[];
  /** Without permission the totals are shown read-only. */
  canReact: boolean;
  busy?: boolean;
  onToggle: (emoji: PostReactionEmoji, on: boolean) => void;
}

export default function ReactionBar({counts, mine, available = REACTION_KEYS, canReact, busy, onToggle}: ReactionBarProps) {
  const t = useTranslations('posts.reactions');
  const used = available.filter((emoji) => (counts[emoji] ?? 0) > 0 || mine.includes(emoji));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {used.map((emoji) => {
        const active = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={!canReact || busy}
            aria-pressed={active}
            title={t(emoji)}
            onClick={() => onToggle(emoji, !active)}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors disabled:cursor-default ${
              active
                ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] enabled:hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span aria-hidden>{REACTION_EMOJI[emoji]}</span>
            <span>{Math.max(counts[emoji] ?? 0, active ? 1 : 0)}</span>
          </button>
        );
      })}

      {canReact && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label={t('add')}
              className="inline-flex size-7 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <SmilePlus size={14} strokeWidth={1.75} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={4}
              className="z-50 flex gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-lg"
            >
              {available.map((emoji) => {
                const active = mine.includes(emoji);
                return (
                  <Popover.Close asChild key={emoji}>
                    <button
                      type="button"
                      title={t(emoji)}
                      aria-pressed={active}
                      onClick={() => onToggle(emoji, !active)}
                      className={`inline-flex size-8 items-center justify-center rounded-full text-base transition-transform hover:scale-110 ${
                        active ? 'bg-[var(--bg-active)]' : ''
                      }`}
                    >
                      {REACTION_EMOJI[emoji]}
                    </button>
                  </Popover.Close>
                );
              })}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
