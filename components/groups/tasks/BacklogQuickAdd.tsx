'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {BookOpen, Calendar, User} from 'lucide-react';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';

export interface BacklogQuickAddProps {
  onCreate: (summary: string) => Promise<void> | void;
}

// Inline "quick add" row at the bottom of a sprint/backlog block (Jira-style).
export default function BacklogQuickAdd({onCreate}: BacklogQuickAddProps) {
  const t = useTranslations('tasks');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const summary = value.trim();
    if (!summary || submitting) return;

    setSubmitting(true);
    try {
      await onCreate(summary);
      setValue('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-border px-3 py-2">
      <BookOpen size={16} className="shrink-0 text-success" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSubmit();
        }}
        placeholder={t('backlog.quickAddPlaceholder')}
        className="h-8 flex-1 border-transparent bg-transparent px-1 focus-visible:border-border-focus focus-visible:bg-surface-input"
      />
      <Calendar size={14} className="hidden shrink-0 text-fg-muted sm:block" aria-hidden />
      <User size={14} className="hidden shrink-0 text-fg-muted sm:block" aria-hidden />
      <Button size="sm" variant="secondary" disabled={!value.trim() || submitting} onClick={handleSubmit}>
        {t('backlog.create')}
      </Button>
    </div>
  );
}
