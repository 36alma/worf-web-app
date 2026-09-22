'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {ArrowRight, CalendarPlus, FileUp, ListTodo, UserPlus, Zap, type LucideIcon} from 'lucide-react';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import {useUserGroups} from '@/hooks/useUserGroups';
import {useAuthStore} from '@/lib/store/authStore';
import {cn} from '@/lib/utils/cn';
import type {SupportedLocale} from '@/app/[locale]/groups/[groupId]/calendar/types';
import {useDashboard} from './DashboardProvider';
import {EventCreateFlow, PostCreateFlow, TaskCreateFlow} from './QuickCreateFlows';

type CreateAction = 'task' | 'event' | 'post';

const ROW_CLASS =
  'flex w-full items-center gap-3 rounded-md bg-transparent p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50';

/**
 * The shortcuts: a group is picked first (skipped when there is only one), then the module's own create modal opens.
 * "Create group" goes to the groups page, where groups are created.
 */
export default function QuickActionsCard() {
  const t = useTranslations('dashboard');
  const tq = useTranslations('dashboard.quick');
  const locale = useLocale();
  const calendarLocale: SupportedLocale = locale === 'en' ? 'en' : 'hu';
  const user = useAuthStore((s) => s.user);
  const {refresh} = useDashboard();
  const {groups, loading: groupsLoading} = useUserGroups(!!user);

  /** The action waiting for the user to pick a group. */
  const [picking, setPicking] = useState<CreateAction | null>(null);
  const [flow, setFlow] = useState<{action: CreateAction; groupId: string} | null>(null);

  const start = (action: CreateAction) => {
    if (groups.length === 0) {
      toast.error(tq('no_groups'));
      return;
    }
    if (groups.length === 1) setFlow({action, groupId: groups[0].id});
    else setPicking(action);
  };

  const closeFlow = () => setFlow(null);

  const actions: {key: CreateAction; label: string; desc: string; icon: LucideIcon}[] = [
    {key: 'task', label: t('actions.add_task'), desc: t('actions.add_task_desc'), icon: ListTodo},
    {key: 'event', label: t('actions.schedule_event'), desc: t('actions.schedule_event_desc'), icon: CalendarPlus},
    {key: 'post', label: t('actions.create_post'), desc: t('actions.create_post_desc'), icon: FileUp}
  ];

  const rowBody = (Icon: LucideIcon, label: string, desc: string) => (
    <>
      <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-secondary">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        <span className="block text-caption text-fg-muted">{desc}</span>
      </div>
      <ArrowRight size={16} strokeWidth={1.75} className="ml-auto shrink-0 text-fg-muted" />
    </>
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-section text-fg">
          <Zap size={16} strokeWidth={1.75} />
          <span>{t('quick_actions')}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Link href={`/${locale}/groups`} className={ROW_CLASS}>
          {rowBody(UserPlus, t('actions.create_group'), t('actions.create_group_desc'))}
        </Link>
        {actions.map(({key, label, desc, icon}) => (
          <button key={key} type="button" className={ROW_CLASS} disabled={!user || groupsLoading} onClick={() => start(key)}>
            {rowBody(icon, label, desc)}
          </button>
        ))}
      </div>

      <Modal open={!!picking} title={tq('pick_group')} onClose={() => setPicking(null)}>
        <div className="px-4 pb-4 pt-3 md:px-6">
          <p className="mb-3 text-caption text-fg-muted">{tq('pick_group_hint')}</p>
          <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  className={cn(ROW_CLASS, 'text-[13px] text-fg')}
                  onClick={() => {
                    if (picking) setFlow({action: picking, groupId: group.id});
                    setPicking(null);
                  }}
                >
                  <span className="truncate">{group.name}</span>
                  <ArrowRight size={16} strokeWidth={1.75} className="ml-auto shrink-0 text-fg-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {flow?.action === 'task' && (
        <TaskCreateFlow
          key={flow.groupId}
          groupId={flow.groupId}
          onClose={closeFlow}
          onDone={() => refresh('tasks', 'summary', 'activity')}
        />
      )}
      {flow?.action === 'event' && (
        <EventCreateFlow
          key={flow.groupId}
          groupId={flow.groupId}
          locale={calendarLocale}
          onClose={closeFlow}
          onDone={() => refresh('events', 'summary')}
        />
      )}
      {flow?.action === 'post' && <PostCreateFlow key={flow.groupId} groupId={flow.groupId} onClose={closeFlow} onDone={() => undefined} />}
    </Card>
  );
}
