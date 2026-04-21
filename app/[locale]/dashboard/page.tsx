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
      iconClass: 'text-[var(--accent)] bg-[var(--accent-subtle)]',
      trendIcon: TrendingUp,
      trend: t('vs_last_month')
    },
    {
      label: t('open_tasks'),
      value: '0',
      icon: CheckSquare,
      iconClass: 'text-[var(--info)] bg-[rgba(59,130,246,0.1)]',
      trendIcon: Minus,
      trend: t('no_change')
    },
    {
      label: t('upcoming_events'),
      value: '0',
      icon: CalendarDays,
      iconClass: 'text-[var(--success)] bg-[rgba(44,182,125,0.1)]',
      trendIcon: Minus,
      trend: t('no_events_scheduled')
    }
  ];

  return (
    <div className="space-y-4">
      <h1 className="display-font text-2xl text-[var(--text-primary)]">{t('title')}</h1>

      <div className="stats-grid grid gap-4 lg:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const TrendIcon = card.trendIcon;
          return (
            <section
              key={card.label}
              className="stat-card rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[#2a2a2a]"
              style={{animation: `fadeInUp 300ms ease-out ${index * 60}ms backwards`}}
            >
              <div className="stat-header mb-4 flex items-center gap-2.5">
                <div className={`stat-icon-wrapper inline-flex h-9 w-9 items-center justify-center rounded-[8px] ${card.iconClass}`}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <span className="stat-label text-[13px] font-normal text-[var(--text-secondary)]">{card.label}</span>
              </div>
              <div className="stat-value mb-2 text-[32px] font-semibold leading-none text-[var(--text-primary)]">{card.value}</div>
              <div className="stat-trend flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <TrendIcon size={14} strokeWidth={1.75} />
                <span>{card.trend}</span>
              </div>
            </section>
          );
        })}
      </div>

      <section className="welcome-card rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <div className="welcome-content mb-5 flex gap-4">
          <div className="welcome-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-subtle)] text-[var(--accent)]">
            <Sparkles size={24} strokeWidth={1.75} />
          </div>
          <div className="welcome-text">
            <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">{t('welcome')}</h3>
            <p className="text-[13px] leading-[1.5] text-[var(--text-secondary)]">
              {t('welcome_description')}
            </p>
          </div>
        </div>
        <div className="welcome-actions flex flex-wrap gap-2.5">
          <Link
            href="../groups"
            className="inline-flex h-[var(--btn-height-md)] items-center gap-2 rounded-[var(--btn-radius)] bg-[var(--accent)] px-3 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={16} strokeWidth={1.75} />
            {t('create_first_group')}
          </Link>
          <Link
            href="../profile"
            className="inline-flex h-[var(--btn-height-md)] items-center gap-2 rounded-[var(--btn-radius)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <BookOpen size={16} strokeWidth={1.75} />
            {t('read_documentation')}
          </Link>
        </div>
      </section>

      <div className="dashboard-grid mt-4 grid gap-4 xl:grid-cols-2">
        <section className="panel rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <div className="panel-header mb-5 flex items-center justify-between">
            <div className="panel-title flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Activity size={16} strokeWidth={1.75} />
              <span>{t('recent_activity')}</span>
            </div>
            <button type="button" className="rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
              {t('view_all')}
            </button>
          </div>
          <div className="empty-state flex flex-col items-center justify-center px-5 py-10 text-center">
            <Clock size={32} strokeWidth={1.75} className="empty-icon mb-3 text-[var(--border-hover)]" />
            <p className="empty-text mb-1 text-sm text-[var(--text-secondary)]">{t('no_recent_activity')}</p>
            <p className="empty-subtext text-xs text-[var(--text-tertiary)]">{t('activity_hint')}</p>
          </div>
        </section>

        <section className="panel rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <div className="panel-header mb-4 flex items-center justify-between">
            <div className="panel-title flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Zap size={16} strokeWidth={1.75} />
              <span>{t('quick_actions')}</span>
            </div>
          </div>
          <div className="quick-actions space-y-1">
            {[
              {label: t('actions.create_group'), desc: t('actions.create_group_desc'), icon: UserPlus},
              {label: t('actions.add_task'), desc: t('actions.add_task_desc'), icon: ListTodo},
              {label: t('actions.schedule_event'), desc: t('actions.schedule_event_desc'), icon: CalendarPlus},
              {label: t('actions.create_post'), desc: t('actions.create_post_desc'), icon: FileUp}
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} type="button" className="quick-action-item flex w-full items-center gap-3 rounded-[8px] bg-transparent p-3 text-left hover:bg-[var(--bg-hover)]">
                  <div className="qa-icon inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="qa-label block text-[13px] font-medium text-[var(--text-primary)]">{item.label}</span>
                    <span className="qa-desc block text-xs text-[var(--text-tertiary)]">{item.desc}</span>
                  </div>
                  <ArrowRight size={16} strokeWidth={1.75} className="qa-arrow ml-auto text-[var(--border-hover)]" />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
