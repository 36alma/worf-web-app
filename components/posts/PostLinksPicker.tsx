'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Check, Plus, Search} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PostLinkChips from '@/components/posts/PostLinkChips';
import {ENTITY_ADAPTERS} from '@/components/groups/minutes/editor/entities';
import type {PostLinkType} from '@/lib/api/posts';
import {getSprintList} from '@/lib/api/sprints';
import {MAX_LINKS_PER_POST, type PostLink} from '@/lib/posts/model';

const LINK_TYPES: PostLinkType[] = ['task', 'sprint', 'minutes', 'file'];
const MAX_PAGES = 4;

interface Option {
  id: string;
  label: string;
  subtitle?: string;
}

interface PostLinksPickerProps {
  groupId: string;
  value: PostLink[];
  disabled?: boolean;
  onChange: (links: PostLink[]) => void;
}

const loadOptions = async (groupId: string, locale: string, type: PostLinkType): Promise<Option[]> => {
  if (type === 'sprint') {
    const response = await getSprintList({group_id: groupId, limit: 200});
    const data = response.data?.data || response.data || [];
    const list = (Array.isArray(data.sprints) ? data.sprints : Array.isArray(data) ? data : []) as Record<string, unknown>[];
    return list.map((sprint) => ({id: String(sprint.id), label: String(sprint.sprint_name ?? sprint.id), subtitle: String(sprint.status ?? '')}));
  }
  const adapter = ENTITY_ADAPTERS[type];
  const out: Option[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const {items, hasMore} = await adapter.list({groupId, locale}, page);
    out.push(...items.map((item) => ({id: item.id, label: item.label, subtitle: item.subtitle})));
    if (!hasMore) break;
  }
  return out;
};

/** Links of a group post to its task / sprint / minutes / file (max 10). */
export default function PostLinksPicker({groupId, value, disabled, onChange}: PostLinksPickerProps) {
  const t = useTranslations('posts.links');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PostLinkType>('task');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setFailed(false);
    loadOptions(groupId, locale, type)
      .then((list) => mounted && setOptions(list))
      .catch(() => {
        if (!mounted) return;
        setOptions([]);
        setFailed(true);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [groupId, locale, open, type]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  const isSelected = (id: string) => value.some((link) => link.type === type && link.id === id);
  const full = value.length >= MAX_LINKS_PER_POST;

  const toggle = (option: Option) => {
    if (isSelected(option.id)) onChange(value.filter((link) => !(link.type === type && link.id === option.id)));
    else if (!full) onChange([...value, {type, id: option.id, label: option.label}]);
  };

  return (
    <div className="space-y-2">
      <PostLinkChips links={value} onRemove={disabled ? undefined : (link) => onChange(value.filter((item) => item !== link))} />
      {!disabled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-[var(--border-default)] px-2.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <Plus size={12} /> {t('add')}
        </button>
      )}

      <Modal
        open={open}
        title={t('pickerTitle')}
        badge={`${value.length}/${MAX_LINKS_PER_POST}`}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setOpen(false)}>
              {t('done')}
            </Button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1">
          {LINK_TYPES.map((linkType) => (
            <button
              key={linkType}
              type="button"
              onClick={() => {
                setType(linkType);
                setQuery('');
              }}
              className={`rounded-md px-3 py-1.5 text-[13px] ${
                linkType === type ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {t(`types.${linkType}`)}
            </button>
          ))}
        </div>
        <label className="mb-3 flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3">
          <Search size={14} className="text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        {full && <p className="mb-2 text-xs text-[var(--warning)]">{t('limit', {max: MAX_LINKS_PER_POST})}</p>}
        {loading ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('loading')}</p>
        ) : failed ? (
          <p className="text-sm text-[var(--danger)]">{t('loadError')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('empty')}</p>
        ) : (
          <ul className="max-h-[50dvh] divide-y divide-[var(--border-subtle)] overflow-y-auto">
            {filtered.map((option) => {
              const active = isSelected(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={!active && full}
                    onClick={() => toggle(option)}
                    className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[var(--text-primary)]">{option.label}</span>
                      {option.subtitle && <span className="block truncate text-xs text-[var(--text-tertiary)]">{option.subtitle}</span>}
                    </span>
                    {active && <Check size={14} className="shrink-0 text-[var(--accent)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}
