/** Component tests for calendar list, event modal validation and layout states. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarProvider } from '@/src/contexts/CalendarContext';
import CalendarList from '@/src/components/calendar/CalendarList';
import CalendarLayout from '@/src/components/calendar/CalendarLayout';
import { EventSchema } from '@/src/components/calendar/EventModal';

describe('calendar components', () => {
  it('renders CalendarList title', () => {
    const html = renderToStaticMarkup(
      <CalendarProvider groupId="group-1" token="token">
        <CalendarList groupId="group-1" />
      </CalendarProvider>
    );
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
    const html = renderToStaticMarkup(
      <CalendarProvider groupId="group-1" token="token">
        <CalendarLayout groupId="group-1" />
      </CalendarProvider>
    );
    expect(html).toContain('Válassz vagy hozz létre naptárat');
  });
});
