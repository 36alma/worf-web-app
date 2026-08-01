import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Clock,
  FileUp,
  ListTodo,
  Minus,
  Plus,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Zap
} from 'lucide-react';
import {callWorfApi} from '@/lib/server/worf';
import {getServerAccessToken} from '@/lib/utils/cookies';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import {buttonVariants} from '@/components/ui/Button';

async function getGroupCount() {
  const token = await getServerAccessToken();
  if (!token) return 0;

  try {
    const {status, data: raw} = await callWorfApi('/v1/group/getusergroups', {
      method: 'POST',
      token
    });

    if (status < 200 || status >= 300) {
      return 0;
    }

    const results: any[] = [];
    const traverse = (item: any) => {
      if (!item || typeof item === 'function') return;
      if (Array.isArray(item)) {
        item.forEach(traverse);
        return;
      }
      if (typeof item === 'object') {
        const keys = Object.keys(item);
        const idKey = keys.find((k) => k.toLowerCase().endsWith('id') || k.toLowerCase() === 'id');
        const id = idKey ? item[idKey] : null;

        if (id && id !== 'undefined' && id !== 'null') {
          results.push(item);
          return;
        }
        Object.values(item).forEach(traverse);
      }
    };

    traverse(raw);
    return new Set(
      results.map((r) => {
        const keys = Object.keys(r);
        const key = keys.find((item) => item.toLowerCase().endsWith('id') || item.toLowerCase() === 'id');
        return String(r[key!]);
      })
    ).size;
  } catch {
    return 0;
  }
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const groupCount = await getGroupCount();

  const cards = [
    {
      label: t('active_groups'),
      value: groupCount.toString(),
      icon: Users,
      iconClass: 'bg-surface-2 text-fg-secondary',
      trendIcon: TrendingUp,
      trend: t('vs_last_month')
    },
    {
      label: t('open_tasks'),
      value: '0',
      icon: CheckSquare,
      iconClass: 'bg-info-bg text-info',
      trendIcon: Minus,
      trend: t('no_change')
    },
    {
      label: t('upcoming_events'),
      value: '0',
      icon: CalendarDays,
      iconClass: 'bg-success-bg text-success',
      trendIcon: Minus,
      trend: t('no_events_scheduled')
    }
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <h1 className="text-title text-fg">{t('title')}</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const TrendIcon = card.trendIcon;
          return (
            <Card key={card.label} interactive className="p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`inline-flex size-9 items-center justify-center rounded-md ${card.iconClass}`}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <span className="text-[13px] text-fg-secondary">{card.label}</span>
              </div>
              <div className="mb-2 text-[28px] font-medium leading-none text-fg">{card.value}</div>
              <div className="flex items-center gap-1 text-caption text-fg-muted">
                <TrendIcon size={14} strokeWidth={1.75} />
                <span>{card.trend}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="mb-5 flex gap-4">
          <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-secondary">
            <Sparkles size={24} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="mb-1 text-base font-medium text-fg">{t('welcome')}</h3>
            <p className="text-[13px] leading-[1.5] text-fg-secondary">
              {t('welcome_description')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="../groups" className={buttonVariants({variant: 'primary'})}>
            <Plus size={16} strokeWidth={1.75} />
            {t('create_first_group')}
          </Link>
          <Link href="../profile" className={buttonVariants({variant: 'ghost'})}>
            <BookOpen size={16} strokeWidth={1.75} />
            {t('read_documentation')}
          </Link>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-section text-fg">
              <Activity size={16} strokeWidth={1.75} />
              <span>{t('recent_activity')}</span>
            </div>
            <button type="button" className="rounded-md px-2 py-1 text-caption text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg">
              {t('view_all')}
            </button>
          </div>
          <EmptyState icon={<Clock size={20} strokeWidth={1.75} className="text-fg-muted" />}>
            {t('no_recent_activity')}
          </EmptyState>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-section text-fg">
              <Zap size={16} strokeWidth={1.75} />
              <span>{t('quick_actions')}</span>
            </div>
          </div>
          <div className="space-y-1">
            {[
              {label: t('actions.create_group'), desc: t('actions.create_group_desc'), icon: UserPlus},
              {label: t('actions.add_task'), desc: t('actions.add_task_desc'), icon: ListTodo},
              {label: t('actions.schedule_event'), desc: t('actions.schedule_event_desc'), icon: CalendarPlus},
              {label: t('actions.create_post'), desc: t('actions.create_post_desc'), icon: FileUp}
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} type="button" className="flex w-full items-center gap-3 rounded-md bg-transparent p-3 text-left transition-colors hover:bg-surface-hover">
                  <div className="inline-flex size-9 items-center justify-center rounded-md bg-surface-2 text-fg-secondary">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="block text-[13px] font-medium text-fg">{item.label}</span>
                    <span className="block text-caption text-fg-muted">{item.desc}</span>
                  </div>
                  <ArrowRight size={16} strokeWidth={1.75} className="ml-auto text-fg-muted" />
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
