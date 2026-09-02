'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getUserGroups, getGroupMembers } from '@/lib/api/groups';
import { canGrantShareFlags, type ShareFlagSet } from '@/lib/permissions/filesGuard';
import Button from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';

export interface ShareUserEntry {
  user_id: string;
  user_name: string;
  can_view: boolean;
  can_download: boolean;
  can_upload?: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
}

interface SelectableGroup { id: string; name: string; }
interface SelectableMember { id: string; name: string; }

export interface ShareUserTabProps {
  shares: ShareUserEntry[];
  isLoading: boolean;
  myFlags: ShareFlagSet;
  showCanUpload?: boolean;
  isSharing: boolean;
  revokingUserId: string | null;
  onShare: (targetUserId: string, flags: ShareFlagSet) => Promise<void>;
  onRevoke: (targetUserId: string) => Promise<void>;
}

const FLAG_KEYS: Array<keyof ShareFlagSet> = ['can_view', 'can_download', 'can_upload', 'can_edit', 'can_delete', 'can_share'];

function readMembers(payload: unknown): SelectableMember[] {
  const source = payload && typeof payload === 'object' && 'data' in (payload as object) ? (payload as {data: unknown}).data : payload;
  const array = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['group_users', 'members', 'items', 'rows', 'result'].map((key) => (source as Record<string, unknown>)[key]).find(Array.isArray)
      : null;
  if (!Array.isArray(array)) return [];
  return array
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.user_id ?? row.id ?? '').trim();
      if (!id) return null;
      return { id, name: String(row.username ?? row.user_name ?? row.name ?? id) };
    })
    .filter((v): v is SelectableMember => v !== null);
}

export default function ShareUserTab({ shares, isLoading, myFlags, showCanUpload, isSharing, revokingUserId, onShare, onRevoke }: ShareUserTabProps) {
  const t = useTranslations('files');
  const [groups, setGroups] = useState<SelectableGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<SelectableMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [flags, setFlags] = useState<ShareFlagSet>({ can_view: true, can_download: true });

  useEffect(() => {
    getUserGroups().then((response) => {
      const source = (response as {data?: unknown}).data ?? response;
      const array = source && typeof source === 'object' ? (['group_users', 'groups', 'items', 'result'].map((k) => (source as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined) : undefined;
      setGroups((array ?? []).map((item) => {
        const row = item as Record<string, unknown>;
        return { id: String(row.group_id ?? row.id ?? ''), name: String(row.group_name ?? row.name ?? '') };
      }).filter((g) => g.id));
    }).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    setSelectedUserId('');
    if (!selectedGroupId) {
      setMembers([]);
      return;
    }
    getGroupMembers(selectedGroupId).then((response) => setMembers(readMembers(response))).catch(() => setMembers([]));
  }, [selectedGroupId]);

  const alreadySharedIds = new Set(shares.map((s) => s.user_id));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="">{t('share.user.selectGroupPlaceholder')}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={!selectedGroupId} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50">
          <option value="">{t('share.user.selectUserPlaceholder')}</option>
          {members.filter((m) => !alreadySharedIds.has(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        {FLAG_KEYS.filter((key) => key !== 'can_upload' || showCanUpload).map((key) => {
          const disabled = !canGrantShareFlags(myFlags, { [key]: true });
          return (
            <label key={key} className={`flex items-center gap-1.5 text-xs ${disabled ? 'opacity-40' : 'text-[var(--text-secondary)]'}`} title={disabled ? t('share.user.cannotGrant') : undefined}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={flags[key] === true}
                onChange={(e) => setFlags((current) => ({ ...current, [key]: e.target.checked }))}
              />
              {t(`share.user.flags.${key}` as never)}
            </label>
          );
        })}
      </div>

      <Button
        type="button"
        variant="primary"
        loading={isSharing}
        disabled={!selectedUserId}
        onClick={() => void onShare(selectedUserId, flags).then(() => { setSelectedUserId(''); setFlags({ can_view: true, can_download: true }); })}
      >
        {t('share.shareButton')}
      </Button>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t('share.sharedWith')}</p>
        {isLoading ? (
          <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ) : shares.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('share.noShares')}</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((share) => (
              <li key={share.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{share.user_name}</span>
                <Button type="button" variant="ghost" size="sm" loading={revokingUserId === share.user_id} onClick={() => void onRevoke(share.user_id)}>
                  {t('share.revokeButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
