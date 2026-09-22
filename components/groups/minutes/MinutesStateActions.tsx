'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {Undo2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {Switch} from '@/components/ui/Switch';
import {finalizeMinutes, recallMinutes, reviseMinutes} from '@/lib/api/minutes';
import {
  extractMinutesErrorCode,
  extractMinutesErrorIssues,
  translateMinutesApiError,
  translateMinutesErrorCode,
  type MinutesErrorCode,
  type MinutesIssue
} from '@/lib/i18n/minutes';
import type {MinutesStatus} from './types';
import {countWarnings} from './witnessIssues';

/** A finalize that was refused, in a form the detail page can show as a persistent banner. */
export interface FinalizeIssue {
  code: MinutesErrorCode | null;
  message: string;
  /**
   * Every witness the server pinned the refusal on (`detail.issues[]`) — the page resolves them to names and
   * marks them in the Participants panel. Empty for the record-level rules (`minute_taker_*`, `witness_required`).
   */
  issues: MinutesIssue[];
}

export interface MinutesStateActionsProps {
  groupId: string;
  minutesId: string;
  status: MinutesStatus;
  canFinalize: boolean;
  canRevise: boolean;
  /** At least one WITNESS participant — `finalize` answers 422 without one. */
  hasWitness: boolean;
  /** The record has a minute taker — mandatory since the witness rules, older rows may not have one. */
  hasMinuteTaker: boolean;
  /** `get`'s `minute_taker_is_eligible`: `false` means the minute taker can no longer edit (`null`/absent: unknown). */
  minuteTakerEligible?: boolean | null;
  /** Witnesses flagged as no longer eligible — `finalize` would refuse the record over them. */
  ineligibleWitnessCount?: number;
  /** `archived_at != null` — `finalize` / `revise` answer 422 `minutes.archived_read_only` until it is unarchived. */
  archived?: boolean;
  onFinalized: () => void;
  /** A refused finalize (or `null` once it is cleared) — the page shows it above the content. */
  onIssue?: (issue: FinalizeIssue | null) => void;
}

type PendingConfirm = 'finalize' | 'recall' | 'revise' | null;

export default function MinutesStateActions({
  groupId,
  minutesId,
  status,
  canFinalize,
  canRevise,
  hasWitness,
  hasMinuteTaker,
  minuteTakerEligible,
  ineligibleWitnessCount = 0,
  archived = false,
  onFinalized,
  onIssue
}: MinutesStateActionsProps) {
  const t = useTranslations('group_minutes');
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<PendingConfirm>(null);
  /** "Notify the witnesses" — on by default, like the server. */
  const [notifyWitnesses, setNotifyWitnesses] = useState(true);

  const reportFinalizeError = (error: unknown) => {
    const code = extractMinutesErrorCode(error);
    const message = translateMinutesErrorCode(t, code) ?? translateMinutesApiError(t, error, 'errors.default');
    toast.error(message);
    onIssue?.({code, message, issues: extractMinutesErrorIssues(error)});
  };

  const handleFinalize = async () => {
    setBusy(true);
    onIssue?.(null);
    try {
      await finalizeMinutes({group_id: groupId, minutes_id: minutesId});
      toast.success(t('state.finalized_toast'));
      onFinalized();
    } catch (error) {
      reportFinalizeError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleRecall = async () => {
    setBusy(true);
    try {
      await recallMinutes({group_id: groupId, minutes_id: minutesId, notify: notifyWitnesses});
      toast.success(notifyWitnesses ? t('state.recalled_toast_notified') : t('state.recalled_toast'));
      onFinalized();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = async () => {
    setBusy(true);
    try {
      const {data} = await reviseMinutes({group_id: groupId, minutes_id: minutesId});
      const newMinutesId = (data as {new_minutes_id: string}).new_minutes_id;
      // Not an error: the new draft exists, it just carries witnesses that have to be replaced before finalizing.
      const warnings = countWarnings(data);
      if (warnings > 0) toast(t('state.warnings_toast', {count: warnings}), {icon: '⚠️', duration: 8000});
      router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(newMinutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const runConfirmed = () => {
    const action = confirming;
    setConfirming(null);
    if (action === 'finalize') void handleFinalize();
    if (action === 'recall') void handleRecall();
    if (action === 'revise') void handleRevise();
  };

  const confirmCopy: Record<Exclude<PendingConfirm, null>, {title: string; message: string; confirmLabel: string}> = {
    finalize: {title: t('state.finalize'), message: t('state.finalize_confirm'), confirmLabel: t('state.finalize')},
    recall: {title: t('state.recall'), message: t('state.recall_confirm'), confirmLabel: t('state.recall')},
    revise: {title: t('state.revise'), message: t('state.revise_confirm'), confirmLabel: t('state.revise')}
  };

  const blockers = [
    archived ? t('archive.blocked_finalize') : null,
    !hasWitness ? t('state.finalize_needs_witness') : null,
    !hasMinuteTaker ? t('state.finalize_needs_minute_taker') : null,
    hasMinuteTaker && minuteTakerEligible === false ? t('state.finalize_minute_taker_ineligible') : null,
    ineligibleWitnessCount > 0 ? t('state.finalize_witness_ineligible', {count: ineligibleWitnessCount}) : null
  ].filter((hint): hint is string => hint !== null);

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'DRAFT' && canFinalize && (
        <>
          <Button variant="primary" loading={busy} disabled={busy || blockers.length > 0} onClick={() => setConfirming('finalize')}>
            {t('state.finalize')}
          </Button>
          {blockers.map((hint) => (
            <p key={hint} className="max-w-xs text-right text-xs text-[var(--text-tertiary)]">
              {hint}
            </p>
          ))}
        </>
      )}

      {status === 'PENDING_APPROVAL' && canFinalize && (
        <>
          <Button
            variant="secondary"
            loading={busy}
            disabled={busy}
            startIcon={<Undo2 className="h-4 w-4" />}
            onClick={() => setConfirming('recall')}
          >
            {t('state.recall')}
          </Button>
          <p className="max-w-xs text-right text-xs text-[var(--text-tertiary)]">{t('state.recall_hint')}</p>
        </>
      )}

      {status === 'APPROVED' && canRevise && (
        <>
          <Button variant="secondary" loading={busy} disabled={busy || archived} onClick={() => setConfirming('revise')}>
            {t('state.revise')}
          </Button>
          {archived && (
            <p className="max-w-xs text-right text-xs text-[var(--text-tertiary)]">{t('archive.blocked_revise')}</p>
          )}
        </>
      )}

      {confirming && (
        <ConfirmDialog
          open
          title={confirmCopy[confirming].title}
          message={confirmCopy[confirming].message}
          confirmLabel={confirmCopy[confirming].confirmLabel}
          onCancel={() => setConfirming(null)}
          onConfirm={runConfirmed}
        >
          {confirming === 'recall' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
              <Switch checked={notifyWitnesses} onCheckedChange={setNotifyWitnesses} aria-label={t('state.recall_notify')} />
              <span>{t('state.recall_notify')}</span>
            </label>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
