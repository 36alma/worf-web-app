'use client';

import CalendarView from '@/components/calendar/CalendarView';
import { useTranslations } from 'next-intl';

export default function CalendarPage() {
  const t = useTranslations('calendar');

  return (
    <section className="space-y-4">
      <h1 className="display-font text-[var(--text-primary)] text-2xl">{t('page.title')}</h1>
      <CalendarView />
    </section>
  );
}
