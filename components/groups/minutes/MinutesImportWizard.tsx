'use client';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {AlertTriangle, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {useGroupMembers} from '@/hooks/useGroupMembers';
import MinutesContentEditor from './editor/MinutesContentEditor';
import {EntityModalProvider} from './editor/EntityModalProvider';
import ImportParticipantsReview from './ImportParticipantsReview';
import MinuteTakerSelect from './MinuteTakerSelect';
import {
  buildImportParticipantsPayload,
  downgradeProblemWitnesses,
  findImportParticipantProblems,
  type ImportParticipantProblem
} from './importParticipants';
import {fromLocalInput, toLocalInput} from './minutesDates';
import {useWitnessCandidates} from './useWitnessCandidates';
import {analyzeMinutesImport, confirmMinutesImport} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import {uploadFile} from '@/lib/utils/uploadFile';
import type {MinutesImportProposal} from './types';

export interface MinutesImportWizardProps {
  groupId: string;
}

type WizardStep = 'upload' | 'analyzing' | 'review';

export default function MinutesImportWizard({groupId}: MinutesImportWizardProps) {
  const t = useTranslations('group_minutes');
  const router = useRouter();
  const locale = useLocale();
  const [step, setStep] = useState<WizardStep>('upload');
  const [sourceFileId, setSourceFileId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MinutesImportProposal | null>(null);
  const [minuteTakerId, setMinuteTakerId] = useState('');
  const [importDisabled, setImportDisabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const members = useGroupMembers(groupId);

  // A witness has to be a registered, eligible member. There is no record yet, so the candidates are the
  // group-level list (it needs `group.minutes.modify`; without it the request fails and every member is offered).
  const hasWitnessRow = proposal?.participants.some((p) => p.role === 'WITNESS') ?? false;
  const witnessList = useWitnessCandidates(groupId, undefined, {enabled: step === 'review' && hasWitnessRow});
  // Only conclusive when the whole list came back — a truncated one (50 cap) would name eligible members ineligible.
  const eligibleWitnessIds = useMemo(
    () =>
      witnessList.loaded && !witnessList.failed && !witnessList.truncated
        ? new Set(witnessList.candidates.map((c) => c.user_id))
        : null,
    [witnessList.loaded, witnessList.failed, witnessList.truncated, witnessList.candidates]
  );
  const problems = useMemo(
    () =>
      proposal
        ? findImportParticipantProblems({participants: proposal.participants, minuteTakerId, eligibleWitnessIds})
        : new Map<number, ImportParticipantProblem>(),
    [proposal, minuteTakerId, eligibleWitnessIds]
  );
  const witnessProblemCount = [...problems.values()].filter((problem) => problem !== 'duplicate_member').length;

  const handleFileSelected = async (file: File) => {
    setStep('analyzing');
    try {
      const fileId = await uploadFile(file, {scope: 'group', groupId});
      setSourceFileId(fileId);
      const {data} = await analyzeMinutesImport({group_id: groupId, file_id: fileId});
      const analyzed = (data as {proposal: MinutesImportProposal}).proposal;
      setProposal({...analyzed, meeting_date: toLocalInput(analyzed.meeting_date) || analyzed.meeting_date});
      setStep('review');
    } catch (error: any) {
      if (error?.response?.status === 503) {
        setImportDisabled(true);
        toast.error(t('import.disabled'));
      } else {
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
      }
      setStep('upload');
    }
  };

  const updateAgendaItem = (index: number, patch: Partial<MinutesImportProposal['agenda_items'][number]>) => {
    if (!proposal) return;
    const agenda_items = proposal.agenda_items.map((item, i) => (i === index ? {...item, ...patch} : item));
    setProposal({...proposal, agenda_items});
  };

  const removeAgendaItem = (index: number) => {
    if (!proposal) return;
    setProposal({...proposal, agenda_items: proposal.agenda_items.filter((_, i) => i !== index)});
  };

  const downgradeWitnesses = () => {
    if (!proposal) return;
    setProposal({...proposal, participants: downgradeProblemWitnesses(proposal.participants, problems)});
  };

  const handleConfirm = async () => {
    if (!proposal || !minuteTakerId || problems.size > 0) return;
    setSubmitting(true);
    try {
      const {data} = await confirmMinutesImport({
        group_id: groupId,
        subject: proposal.subject,
        meeting_date: fromLocalInput(proposal.meeting_date),
        minute_taker_id: minuteTakerId,
        location: proposal.location,
        source_file_id: sourceFileId ?? undefined,
        agenda_items: proposal.agenda_items,
        participants: buildImportParticipantsPayload(proposal.participants)
      });
      const minutesId = (data as {minutes_id: string}).minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(minutesId)}`);
    } catch (error) {
      // The participant rules run before anything is created, so a refusal leaves no half-built minutes behind.
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setSubmitting(false);
    }
  };

  if (importDisabled) {
    return <p className="text-sm text-[var(--text-secondary)]">{t('import.disabled')}</p>;
  }

  return (
    <EntityModalProvider groupId={groupId}>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('import.title')}</h1>

        {step === 'upload' && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">{t('import.upload_hint')}</p>
            <input
              type="file"
              accept=".doc,.docx,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
              }}
            />
          </div>
        )}

        {step === 'analyzing' && <p className="text-sm text-[var(--text-secondary)]">{t('import.analyzing')}</p>}

        {step === 'review' && proposal && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.subject')}</label>
              <Input value={proposal.subject} onChange={(e) => setProposal({...proposal, subject: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.meeting_date')}</label>
              <Input
                type="datetime-local"
                value={proposal.meeting_date}
                onChange={(e) => setProposal({...proposal, meeting_date: e.target.value})}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.location')}</label>
              <Input
                value={proposal.location ?? ''}
                onChange={(e) => setProposal({...proposal, location: e.target.value})}
              />
            </div>

            {/* The AI proposal never contains a minute taker, but `import/confirm` requires one. */}
            <MinuteTakerSelect groupId={groupId} value={minuteTakerId} onChange={setMinuteTakerId} />

            <div className="space-y-2">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('participants.title')}</h2>
              {proposal.participants.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('import.no_participants')}</p>
              ) : (
                <>
                  <p className="text-xs text-[var(--text-tertiary)]">{t('import.assign_hint')}</p>
                  <ImportParticipantsReview
                    participants={proposal.participants}
                    problems={problems}
                    members={members}
                    witnessCandidates={witnessList.candidates}
                    witnessCandidatesFailed={witnessList.failed}
                    minuteTakerId={minuteTakerId}
                    onChange={(participants) => setProposal({...proposal, participants})}
                  />
                </>
              )}

              {hasWitnessRow && witnessList.failed && (
                <p className="text-xs text-[var(--text-tertiary)]">{t('import.witness_candidates_unavailable')}</p>
              )}
              {hasWitnessRow && witnessList.truncated && (
                <p className="text-xs text-[var(--text-tertiary)]">{t('participants.witness_truncated')}</p>
              )}

              {witnessProblemCount > 0 && (
                <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">{t('import.witness_blocked', {count: witnessProblemCount})}</span>
                  <Button variant="secondary" size="sm" onClick={downgradeWitnesses}>
                    {t('import.witness_downgrade')}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('agenda.title')}</h2>
              {proposal.agenda_items.map((item, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
                  <div className="flex items-center gap-2">
                    <Input value={item.title} onChange={(e) => updateAgendaItem(index, {title: e.target.value})} />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('agenda.remove')}
                      onClick={() => removeAgendaItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <MinutesContentEditor
                    groupId={groupId}
                    value={item.content_html ?? ''}
                    onChange={(value) => updateAgendaItem(index, {content_html: value})}
                  />
                </div>
              ))}
            </div>

            {proposal.confidence_notes && (
              <p className="text-xs italic text-[var(--text-secondary)]">
                {t('import.confidence_notes')}: {proposal.confidence_notes}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => setStep('upload')}>
                {t('import.back')}
              </Button>
              <Button
                variant="primary"
                loading={submitting}
                disabled={submitting || !minuteTakerId || problems.size > 0}
                onClick={handleConfirm}
              >
                {t('import.confirm')}
              </Button>
              {!minuteTakerId && <span className="text-xs text-[var(--text-tertiary)]">{t('import.needs_minute_taker')}</span>}
              {minuteTakerId && problems.size > 0 && (
                <span className="text-xs text-[var(--text-tertiary)]">{t('import.fix_participants', {count: problems.size})}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </EntityModalProvider>
  );
}
