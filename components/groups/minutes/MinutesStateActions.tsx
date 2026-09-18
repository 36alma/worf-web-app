'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {finalizeMinutes, reviseMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesStatus} from './types';

export interface MinutesStateActionsProps {
  groupId: string;
  minutesId: string;
  status: MinutesStatus;
  canFinalize: boolean;
  canRevise: boolean;
  onFinalized: () => void;
}

export default function MinutesStateActions({
  groupId,
  minutesId,
  status,
  canFinalize,
  canRevise,
  onFinalized
}: MinutesStateActionsProps) {
  const t = useTranslations('group_minutes');
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const handleFinalize = async () => {
    if (!window.confirm(t('state.finalize_confirm'))) return;
    setBusy(true);
    try {
      await finalizeMinutes({group_id: groupId, minutes_id: minutesId});
      onFinalized();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = async () => {
    if (!window.confirm(t('state.revise_confirm'))) return;
    setBusy(true);
    try {
      const {data} = await reviseMinutes({group_id: groupId, minutes_id: minutesId});
      const newMinutesId = (data as {new_minutes_id: string}).new_minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(newMinutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      {status === 'DRAFT' && canFinalize && (
        <Button variant="primary" disabled={busy} onClick={handleFinalize}>
          {t('state.finalize')}
        </Button>
      )}
      {status === 'APPROVED' && canRevise && (
        <Button variant="secondary" disabled={busy} onClick={handleRevise}>
          {t('state.revise')}
        </Button>
      )}
    </div>
  );
}
