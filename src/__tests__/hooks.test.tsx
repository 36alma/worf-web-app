/** Hook-level tests for calendar provider and custom hooks. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarProvider } from '@/src/contexts/CalendarContext';
import { useCalendars } from '@/src/hooks/useCalendars';

function HookProbe() {
  const { calendars, selectedCalendarId } = useCalendars('group-123');
  return <div>{`count:${calendars.length}|selected:${selectedCalendarId ?? 'none'}`}</div>;
}

describe('calendar hooks', () => {
  it('renders hook output inside provider', () => {
    const html = renderToStaticMarkup(
      <CalendarProvider groupId="group-123" token="test-token">
        <HookProbe />
      </CalendarProvider>
    );
    expect(html).toContain('count:0');
    expect(html).toContain('selected:none');
  });
});
