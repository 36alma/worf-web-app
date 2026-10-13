import {Flag} from 'lucide-react';
import clsx from 'clsx';
import {PRIORITY_LABELS, STATUS_LABELS} from './types';

/** Egy státusz/prioritás pill színe: `color` a pont/ikon színe, `bg` a halvány háttér. */
interface PillTone {
  color: string;
  bg: string;
}

const STATUS_TONES: Record<string, PillTone> = {
  TODO: {color: '#9395a0', bg: 'rgba(147, 149, 160, 0.14)'},
  IN_PROGRESS: {color: '#5aa2f0', bg: 'rgba(90, 162, 240, 0.14)'},
  IN_REVIEW: {color: '#a98af0', bg: 'rgba(169, 138, 240, 0.14)'},
  DONE: {color: '#5fc27a', bg: 'rgba(95, 194, 122, 0.14)'},
  BLOCKED: {color: '#ee5d5a', bg: 'rgba(238, 93, 90, 0.14)'}
};

const PRIORITY_TONES: Record<string, PillTone> = {
  HIGHEST: {color: '#f4577a', bg: 'rgba(244, 87, 122, 0.14)'},
  HIGH: {color: '#ee5d5a', bg: 'rgba(238, 93, 90, 0.14)'},
  MEDIUM: {color: '#e8b04a', bg: 'rgba(232, 176, 74, 0.14)'},
  LOW: {color: '#6fa8e8', bg: 'rgba(111, 168, 232, 0.14)'},
  LOWEST: {color: '#9395a0', bg: 'rgba(147, 149, 160, 0.14)'}
};

const FALLBACK_TONE: PillTone = {color: '#9395a0', bg: 'rgba(147, 149, 160, 0.14)'};

const pillCls = 'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium text-[var(--text-value,#e8e8ec)]';

export function StatusPill({status, className}: {status: string; className?: string}) {
  const tone = STATUS_TONES[status] ?? FALLBACK_TONE;
  return (
    <span className={clsx(pillCls, className)} style={{backgroundColor: tone.bg}}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: tone.color}} />
      <span className="truncate">{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</span>
    </span>
  );
}

export function PriorityPill({priority, className}: {priority: string | null | undefined; className?: string}) {
  const key = !priority || priority === 'NORMAL' ? 'MEDIUM' : priority;
  const tone = PRIORITY_TONES[key] ?? FALLBACK_TONE;
  const filled = key === 'HIGH' || key === 'HIGHEST';
  return (
    <span className={clsx(pillCls, className)} style={{backgroundColor: tone.bg}}>
      <Flag aria-hidden size={13} className="shrink-0" style={{color: tone.color}} fill={filled ? tone.color : 'none'} />
      <span className="truncate">{PRIORITY_LABELS[key] ?? key}</span>
    </span>
  );
}
