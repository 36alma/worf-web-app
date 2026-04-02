import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {AlertTriangle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Button from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({open, title, message, onCancel, onConfirm}: ConfirmDialogProps) {
  const t = useTranslations('common');

  return (
    <AlertDialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/60" />
        <AlertDialog.Content className="dialog-content fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
          <AlertDialog.Title className="mb-2 flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <AlertTriangle size={18} strokeWidth={1.75} className="text-[var(--warning)]" />
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mb-4 text-sm text-[var(--text-secondary)]">{message}</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" onClick={onCancel} startIcon={<AlertTriangle size={16} strokeWidth={1.75} />}>
                {t('cancel')}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {t('confirm')}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
