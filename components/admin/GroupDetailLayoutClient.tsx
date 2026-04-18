'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getAllGroups } from '@/lib/api/groups';
import Skeleton from '@/components/ui/Skeleton';

interface GroupInfo {
  id: string;
  name: string;
  description: string;
}

interface GroupDetailLayoutClientProps {
  groupId: string;
  children: ReactNode;
}

const matchesGroupId = (candidate: unknown, target: string): boolean => {
  if (typeof candidate !== 'string') return false;
  return candidate === target;
};

const extractGroupsFromPayload = (payload: unknown): Array<Record<string, unknown>> => {
  if (!payload) return [];
  const data = payload as Record<string, unknown>;

  const directCandidates = [
    payload,
    data.data,
    data.groups,
    (data.data as Record<string, unknown> | undefined)?.groups
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>;
    }
  }

  const collected: Array<Record<string, unknown>> = [];
  const walk = (input: unknown) => {
    if (!input || typeof input !== 'object') return;
    if (Array.isArray(input)) {
      input.forEach(walk);
      return;
    }

    const record = input as Record<string, unknown>;
    if (typeof record.group_id === 'string' || typeof record.id === 'string') {
      collected.push(record);
    }

    Object.values(record).forEach(walk);
  };

  walk(payload);
  return collected;
};

export default function GroupDetailLayoutClient({ groupId, children }: GroupDetailLayoutClientProps) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGroup = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllGroups();
      const groups = extractGroupsFromPayload(response.data);
      const foundGroup = groups.find((g) => matchesGroupId(String(g.group_id ?? g.id ?? ''), groupId));

      if (foundGroup) {
        setGroup({
          id: String(foundGroup.group_id ?? foundGroup.id ?? groupId),
          name: String(foundGroup.group_name ?? foundGroup.name ?? groupId),
          description: String(foundGroup.group_description ?? foundGroup.description ?? '')
        });
      } else {
        setGroup(null);
      }
    } catch (error) {
      console.error('Failed to load group:', error);
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-slate-400">
          {t('group_not_found')}
        </div>
        <div>
          <Link
            href={`/${locale}/admin/groups`}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            ← {t('back_to_groups')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/admin/groups`}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              {t('groups')}
            </Link>
            <span className="text-slate-400">/</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-100 mt-2">{group.name}</h2>
          {group.description && (
            <p className="text-sm text-slate-400 mt-1">{group.description}</p>
          )}
        </div>
      </div>

      <div className="border-b border-[var(--border)]" />

      {children}
    </div>
  );
}
