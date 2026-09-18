'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import {buildMinutesEditorI18n} from './minutesEditorI18n';
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
  const editorI18n = buildMinutesEditorI18n((key) => t(key as any));
  const [step, setStep] = useState<WizardStep>('upload');
  const [sourceFileId, setSourceFileId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MinutesImportProposal | null>(null);
  const [importDisabled, setImportDisabled] = useState(false);

  const handleFileSelected = async (file: File) => {
    setStep('analyzing');
    try {
      const fileId = await uploadFile(file, {scope: 'group', groupId});
      setSourceFileId(fileId);
      const {data} = await analyzeMinutesImport({group_id: groupId, file_id: fileId});
      setProposal((data as {proposal: MinutesImportProposal}).proposal);
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

  const handleConfirm = async () => {
    if (!proposal) return;
    try {
      const {data} = await confirmMinutesImport({
        group_id: groupId,
        subject: proposal.subject,
        meeting_date: proposal.meeting_date,
        location: proposal.location,
        source_file_id: sourceFileId ?? undefined,
        agenda_items: proposal.agenda_items,
        participants: proposal.participants
      });
      const minutesId = (data as {minutes_id: string}).minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(minutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  if (importDisabled) {
    return <p className="text-sm text-[var(--text-secondary)]">{t('import.disabled')}</p>;
  }

  return (
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

          <div className="space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)]">{t('agenda.title')}</h2>
            {proposal.agenda_items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
                <Input value={item.title} onChange={(e) => updateAgendaItem(index, {title: e.target.value})} />
                <MarkdownEditor
                  value={item.discussion ?? ''}
                  onChange={(value) => updateAgendaItem(index, {discussion: value})}
                  i18n={editorI18n}
                />
                <MarkdownEditor
                  value={item.decision ?? ''}
                  onChange={(value) => updateAgendaItem(index, {decision: value})}
                  i18n={editorI18n}
                />
              </div>
            ))}
          </div>

          {proposal.confidence_notes && (
            <p className="text-xs italic text-[var(--text-secondary)]">
              {t('import.confidence_notes')}: {proposal.confidence_notes}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              {t('import.back')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('import.confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
