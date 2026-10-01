'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Plus, X} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {Switch} from '@/components/ui/Switch';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/Popover';
import {useUserGroups} from '@/hooks/useUserGroups';
import {translateNotificationCategory} from '@/lib/i18n/notifications';
import {
  getNotificationPreferences,
  resetNotificationPreferences,
  setNotificationPreferences
} from '@/lib/api/notifications';
import type {NotificationChannel, PreferencesResponse, PreferenceType} from '@/lib/types/notifications';

const ALL_CHANNELS: NotificationChannel[] = ['MAIL', 'PUSH', 'TELEGRAM', 'INBOX'];

function groupByCategory(types: PreferenceType[]) {
  const groups: {category: string; items: PreferenceType[]}[] = [];
  for (const type of types) {
    const last = groups.at(-1);
    if (last?.category === type.category) last.items.push(type);
    else groups.push({category: type.category, items: [type]});
  }
  return groups;
}

interface GroupExceptionPickerProps {
  channels: NotificationChannel[];
  channelLabel: (channel: NotificationChannel) => string;
  onAdd: (channel: NotificationChannel, groupId: string) => void;
}

function GroupExceptionPicker({channels, channelLabel, onAdd}: GroupExceptionPickerProps) {
  const t = useTranslations('notifications.preferences');
  const {groups} = useUserGroups();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<NotificationChannel>(channels[0]);
  const [groupId, setGroupId] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-xs text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Plus size={12} strokeWidth={2} />
          {t('group_exception_add')}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="space-y-2">
        <label className="block text-xs font-medium text-fg-secondary">
          {t('group_exception_pick')}
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-fg"
          >
            <option value="" disabled>
              {t('group_exception_pick')}
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        {channels.length > 1 && (
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as NotificationChannel)}
            className="w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-fg"
          >
            {channels.map((c) => (
              <option key={c} value={c}>
                {channelLabel(c)}
              </option>
            ))}
          </select>
        )}
        <Button
          size="sm"
          variant="primary"
          className="w-full"
          disabled={!groupId}
          onClick={() => {
            if (!groupId) return;
            onAdd(channel, groupId);
            setGroupId('');
            setOpen(false);
          }}
        >
          {t('group_exception_add')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function NotificationPreferencesClient() {
  const t = useTranslations('notifications');
  const tp = useTranslations('notifications.preferences');
  const [data, setData] = useState<PreferencesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    getNotificationPreferences()
      .then(({data: response}) => mounted && setData(response))
      .catch(() => mounted && toast.error(tp('load_error')))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channelLabel = (channel: NotificationChannel) =>
    channel === 'MAIL'
      ? tp('channel_mail')
      : channel === 'PUSH'
        ? tp('channel_push')
        : channel === 'TELEGRAM'
          ? tp('channel_telegram')
          : tp('channel_inbox');

  const optOutsByType = useMemo(() => {
    const map = new Map<string, PreferencesResponse['opt_outs']>();
    (data?.opt_outs ?? []).forEach((optOut) => {
      const list = map.get(optOut.notification_type) ?? [];
      list.push(optOut);
      map.set(optOut.notification_type, list);
    });
    return map;
  }, [data]);

  const isDisabled = (notificationType: string, channel: NotificationChannel, groupId?: string) =>
    (optOutsByType.get(notificationType) ?? []).some(
      (optOut) => optOut.channel === channel && (groupId ? optOut.group_id === groupId : optOut.group_id === null)
    );

  const applyChange = async (notificationType: string, channel: NotificationChannel, enabled: boolean, groupId?: string) => {
    const key = `${notificationType}|${channel}|${groupId ?? ''}`;
    setSavingKey(key);
    try {
      const {data: response} = await setNotificationPreferences({
        changes: [{notification_type: notificationType, channel, group_id: groupId, enabled}]
      });
      setData(response);
    } catch {
      toast.error(tp('save_error'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async () => {
    setResetOpen(false);
    try {
      const {data: response} = await resetNotificationPreferences({});
      setData(response);
    } catch {
      toast.error(tp('save_error'));
    }
  };

  if (loading || !data) {
    return (
      <Card className="p-5">
        <div className="skeleton-shimmer h-64 w-full rounded-md" />
      </Card>
    );
  }

  const groups = groupByCategory(data.types);

  return (
    <div className="space-y-4">
      {groups.map(({category, items}) => (
        <Card key={category} className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-fg">{translateNotificationCategory(t, category)}</h2>
          <div className="space-y-4">
            {items.map((type) => {
              const groupOptOuts = (optOutsByType.get(type.notification_type) ?? []).filter((o) => o.group_id !== null);
              return (
                <div key={type.notification_type} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-fg">{type.label}</span>
                    <div className="flex flex-wrap items-center gap-4">
                      {type.channels.map((channel) => {
                        const key = `${type.notification_type}|${channel}|`;
                        const checked = !isDisabled(type.notification_type, channel);
                        return (
                          <label key={channel} className="flex items-center gap-2 text-xs text-fg-secondary">
                            <Switch
                              checked={checked}
                              disabled={!type.configurable || savingKey === key}
                              onCheckedChange={(next) => applyChange(type.notification_type, channel, next)}
                            />
                            {channelLabel(channel)}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {!type.configurable && <p className="mt-1 text-xs text-fg-muted">{tp('not_configurable_hint')}</p>}

                  {type.configurable && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {groupOptOuts.map((optOut) => (
                        <span
                          key={`${optOut.channel}|${optOut.group_id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-secondary"
                        >
                          {optOut.group_name} · {channelLabel(optOut.channel)}
                          <button
                            type="button"
                            aria-label={tp('group_exception_remove')}
                            onClick={() => applyChange(type.notification_type, optOut.channel, true, optOut.group_id ?? undefined)}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-surface-1"
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        </span>
                      ))}
                      <GroupExceptionPicker
                        channels={type.channels}
                        channelLabel={channelLabel}
                        onAdd={(channel, groupId) => applyChange(type.notification_type, channel, false, groupId)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setResetOpen(true)}>
          {tp('reset_button')}
        </Button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={tp('reset_confirm_title')}
        message={tp('reset_confirm_body')}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleReset}
        confirmLabel={tp('reset_button')}
      />
    </div>
  );
}
