'use client';

import {useLocale} from 'next-intl';
import {sortTags} from './tags';

export const TAG_CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs text-[var(--text-primary)]';

/** Read-only tag chips, in the UI language's alphabetical order. Renders nothing for an untagged record. */
export default function MinutesTagChips({tags, className}: {tags?: string[] | null; className?: string}) {
  const locale = useLocale();
  if (!tags || tags.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {sortTags(tags, locale).map((tag) => (
        <li key={tag} className={TAG_CHIP_CLASS}>
          <span className="truncate">{tag}</span>
        </li>
      ))}
    </ul>
  );
}
