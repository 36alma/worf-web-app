'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Download, FileDown, Paperclip, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {buildDownloadUrl, requestDownload} from '@/lib/api/files';
import {uploadFile} from '@/lib/utils/uploadFile';
import {exportMinutesPdf, linkAttachment, unlinkAttachment} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesAttachment} from './types';

export interface AttachmentsPanelProps {
  groupId: string;
  minutesId: string;
  attachments: MinutesAttachment[];
  canManage: boolean;
  onChange: (attachments: MinutesAttachment[]) => void;
}

export default function AttachmentsPanel({groupId, minutesId, attachments, canManage, onChange}: AttachmentsPanelProps) {
  const t = useTranslations('group_minutes');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async (file: File) => {
    setBusy(true);
    try {
      const fileId = await uploadFile(file, {scope: 'group', groupId});
      const {data} = await linkAttachment({group_id: groupId, minutes_id: minutesId, file_id: fileId, label: file.name});
      const attachmentId = (data as {attachment_id: string}).attachment_id;
      onChange([...attachments, {id: attachmentId, minutes_id: minutesId, file_id: fileId, label: file.name}]);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (attachmentId: string) => {
    if (!window.confirm(t('attachments.remove_confirm'))) return;
    try {
      await unlinkAttachment({group_id: groupId, attachment_id: attachmentId});
      onChange(attachments.filter((a) => a.id !== attachmentId));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const {data} = await requestDownload(fileId);
      window.open(buildDownloadUrl(data.download_token), '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleExportPdf = async () => {
    setBusy(true);
    try {
      const {data} = await exportMinutesPdf({group_id: groupId, minutes_id: minutesId});
      const fileId = (data as {file_id: string}).file_id;
      onChange([...attachments, {id: `pdf-${fileId}`, minutes_id: minutesId, file_id: fileId, label: 'Exportált PDF'}]);
      toast.success(t('attachments.exported'));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('attachments.title')}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={handleExportPdf} startIcon={<FileDown className="h-4 w-4" />}>
            {t('attachments.export_pdf')}
          </Button>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              startIcon={<Paperclip className="h-4 w-4" />}
            >
              {t('attachments.add')}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />
      <ul className="space-y-1 text-sm text-[var(--text-primary)]">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between">
            <span>{a.label ?? a.file_id}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleDownload(a.file_id)}>
                <Download className="h-4 w-4" />
              </Button>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => handleRemove(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
