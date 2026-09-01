'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FieldError from '@/components/ui/FieldError';
import { filenameSchema } from '@/lib/validation/schemas';
import { sanitizeFilename } from '@/lib/utils/formatFiles';

const nameFormSchema = z.object({ name: filenameSchema });
type NameFormValues = z.infer<typeof nameFormSchema>;

export interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

export default function NameDialog({ open, title, label, initialValue, submitLabel, onSubmit, onClose }: NameDialogProps) {
  const t = useTranslations('files');
  const tv = useTranslations('validation');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<NameFormValues>({ resolver: zodResolver(nameFormSchema), defaultValues: { name: initialValue ?? '' } });

  useEffect(() => {
    if (open) {
      reset({ name: initialValue ?? '' });
      setSuggestion(null);
    }
  }, [open, initialValue, reset]);

  const onValid = handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values.name);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Modal open={open} title={title} onClose={() => (isSubmitting ? undefined : onClose())}>
      <form onSubmit={onValid} className="space-y-4">
        <div>
          <label htmlFor="name-dialog-input" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </label>
          <input
            id="name-dialog-input"
            {...register('name', {
              onChange: (event) => {
                const value = event.target.value as string;
                const cleaned = sanitizeFilename(value);
                setSuggestion(cleaned !== value ? cleaned : null);
              },
            })}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:border-border-focus disabled:opacity-50"
          />
          <FieldError messages={errors.name?.message ? tv(errors.name.message as never) : undefined} />
          {suggestion && (
            <button
              type="button"
              onClick={() => {
                setValue('name', suggestion, { shouldValidate: true });
                setSuggestion(null);
              }}
              className="mt-1.5 text-left text-xs text-[var(--accent)] hover:underline"
            >
              {t('nameDialog.sanitizeSuggestion', { suggestion })}
            </button>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('upload.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
