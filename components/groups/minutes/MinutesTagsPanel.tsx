'use client';

import {useEffect, useId, useState, type FormEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Tag, X} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {TAG_CHIP_CLASS} from './MinutesTagChips';
import {checkTagAdditions, parseTagInput, sortTags, tagKey} from './tags';
import {MINUTES_TAG_MAX_LENGTH, MINUTES_TAGS_PER_MINUTES, type MinutesTagCount} from './types';
import {addMinutesTags, listMinutesTags, removeMinutesTags} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface MinutesTagsPanelProps {
  groupId: string;
  minutesId: string;
  tags: string[];
  /** `group.minutes.modify` — tags are metadata, so they stay editable in every status and on archived minutes. */
  canEdit: boolean;
  /** The server's answer after an add / remove (the tags as they are now). */
  onChange: (tags: string[]) => void;
}

/** The record's tags with add (comma-separated, group tags offered as suggestions) and remove. */
export default function MinutesTagsPanel({groupId, minutesId, tags, canEdit, onChange}: MinutesTagsPanelProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const listId = useId();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!canEdit) return;
    let mounted = true;
    listMinutesTags({group_id: groupId})
      .then(({data}) => mounted && setSuggestions(((data as {tags?: MinutesTagCount[]}).tags ?? []).map((tag) => tag.name)))
      .catch(() => mounted && setSuggestions([]));
    return () => {
      mounted = false;
    };
  }, [groupId, canEdit]);

  if (!canEdit && tags.length === 0) return null;

  const own = new Set(tags.map(tagKey));
  const options = suggestions.filter((name) => !own.has(tagKey(name)));
  const full = tags.length >= MINUTES_TAGS_PER_MINUTES;

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const additions = parseTagInput(input, tags);
    if (additions.length === 0) {
      setInput('');
      return;
    }
    // The server refuses the whole request over one bad tag / the 10-tag limit, so say it before asking.
    const problem = checkTagAdditions(tags, additions);
    if (problem) {
      toast.error(
        problem === 'limit'
          ? t('tags.too_many', {max: MINUTES_TAGS_PER_MINUTES})
          : t('tags.invalid', {length: MINUTES_TAG_MAX_LENGTH})
      );
      return;
    }
    setBusy(true);
    try {
      const {data} = await addMinutesTags({group_id: groupId, minutes_id: minutesId, tags: additions});
      onChange((data as {tags?: string[]}).tags ?? [...tags, ...additions]);
      setInput('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (tag: string) => {
    setBusy(true);
    try {
      const {data} = await removeMinutesTags({group_id: groupId, minutes_id: minutesId, tags: [tag]});
      onChange((data as {tags?: string[]}).tags ?? tags.filter((existing) => tagKey(existing) !== tagKey(tag)));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
        <Tag className="h-4 w-4 text-[var(--text-tertiary)]" />
        {t('tags.title')}
      </h2>

      {tags.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{t('tags.empty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {sortTags(tags, locale).map((tag) => (
            <li key={tag} className={TAG_CHIP_CLASS}>
              <span className="truncate">{tag}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={t('tags.remove', {tag})}
                  className="rounded-full p-0.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  onClick={() => void handleRemove(tag)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              value={input}
              list={listId}
              disabled={busy || full}
              placeholder={t('tags.add_placeholder')}
              aria-label={t('tags.add_placeholder')}
              onChange={(event) => setInput(event.target.value)}
            />
            <datalist id={listId}>
              {options.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <Button type="submit" variant="secondary" loading={busy} disabled={busy || full || !input.trim()}>
              {t('tags.add')}
            </Button>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            {full
              ? t('tags.limit_reached', {max: MINUTES_TAGS_PER_MINUTES})
              : t('tags.hint', {max: MINUTES_TAGS_PER_MINUTES, length: MINUTES_TAG_MAX_LENGTH})}
          </p>
        </form>
      )}
    </div>
  );
}
