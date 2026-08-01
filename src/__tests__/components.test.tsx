/** Component tests for calendar list, event modal validation and layout states. */
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { CalendarProvider } from '@/src/contexts/CalendarContext';
import CalendarList from '@/src/components/calendar/CalendarList';
import CalendarLayout from '@/src/components/calendar/CalendarLayout';
import { EventSchema } from '@/src/components/calendar/EventModal';
import messages from '@/messages/hu.json';

/** Wrap in the i18n + calendar providers a server render needs (ConfirmDialog uses useTranslations). */
function renderWithProviders(node: ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="hu" messages={messages}>
      <CalendarProvider groupId="group-1" token="token">
        {node}
      </CalendarProvider>
    </NextIntlClientProvider>
  );
}

describe('calendar components', () => {
  it('renders CalendarList title', () => {
    const html = renderWithProviders(<CalendarList groupId="group-1" />);
    expect(html).toContain('Naptárak');
  });

  it('validates EventModal form model', () => {
    const result = EventSchema.safeParse({
      kind: 'event',
      name: 'Valid event',
      all_day: false,
      start_at: '2026-04-07T11:00:00Z',
      end_at: '2026-04-07T10:00:00Z'
    });
    expect(result.success).toBe(false);
  });

  it('shows empty-state in CalendarLayout when no selected calendar', () => {
    const html = renderWithProviders(<CalendarLayout groupId="group-1" />);
    expect(html).toContain('Válassz vagy hozz létre naptárat');
  });
});
