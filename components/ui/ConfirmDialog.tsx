import {useTranslations} from 'next-intl';
import Modal from './Modal';
import Button from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const t = useTranslations('common');

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-slate-300">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('confirm')}
        </Button>
      </div>
    </Modal>
  );
}
