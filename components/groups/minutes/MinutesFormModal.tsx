'use client';

import {useTranslations} from 'next-intl';
import Modal from '@/components/ui/Modal';
import MinutesHeaderForm, {type MinutesHeaderFormValues} from './MinutesHeaderForm';

export interface MinutesFormModalProps {
  open: boolean;
  title: string;
  groupId: string;
  /** Set when editing an existing record. */
  minutesId?: string;
  initial?: Partial<MinutesHeaderFormValues>;
  submitting?: boolean;
  onSubmit: (values: MinutesHeaderFormValues) => Promise<void>;
  onClose: () => void;
}

/** The minutes header form (subject, date, location, minute taker) in a modal. */
export default function MinutesFormModal({
  open,
  title,
  groupId,
  minutesId,
  initial,
  submitting,
  onSubmit,
  onClose
}: MinutesFormModalProps) {
  const t = useTranslations('group_minutes');
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <MinutesHeaderForm
        groupId={groupId}
        minutesId={minutesId}
        initial={initial}
        onSubmit={onSubmit}
        submitLabel={t('form.save')}
        submitting={submitting}
      />
    </Modal>
  );
}
