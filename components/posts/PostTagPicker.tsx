'use client';

import * as Popover from '@radix-ui/react-popover';
import {Check, Hash, Plus, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {MAX_TAGS_PER_POST, type PostTag} from '@/lib/posts/model';

interface PostTagPickerProps {
  tags: PostTag[];
  value: string[];
  disabled?: boolean;
  onChange: (tagIds: string[]) => void;
}

export default function PostTagPicker({tags, value, disabled, onChange}: PostTagPickerProps) {
  const t = useTranslations('posts.tags');
  const selected = value.map((id) => tags.find((tag) => tag.id === id) ?? {id, name: id});
  const full = value.length >= MAX_TAGS_PER_POST;

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((current) => current !== id));
    else if (!full) onChange([...value, id]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] py-0.5 pl-2 pr-1 text-[13px] text-[var(--text-secondary)]"
        >
          <Hash size={11} />
          {tag.name}
          {!disabled && (
            <button
              type="button"
              aria-label={t('remove')}
              onClick={() => toggle(tag.id)}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-[var(--bg-hover)]"
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}

      {!disabled && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-[var(--border-default)] px-2.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Plus size={12} /> {t('add')}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 max-h-72 w-64 overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-lg"
            >
              {tags.length === 0 ? (
                <p className="p-2 text-xs text-[var(--text-tertiary)]">{t('noneDefined')}</p>
              ) : (
                tags.map((tag) => {
                  const active = value.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={!active && full}
                      onClick={() => toggle(tag.id)}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                    >
                      <span className="truncate">#{tag.name}</span>
                      {active && <Check size={13} />}
                    </button>
                  );
                })
              )}
              {full && <p className="px-2 pb-1 pt-2 text-xs text-[var(--text-tertiary)]">{t('limit', {max: MAX_TAGS_PER_POST})}</p>}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
