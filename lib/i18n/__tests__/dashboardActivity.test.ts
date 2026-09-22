import {describe, expect, it} from 'vitest';
import type {ActivityItem} from '@/lib/types/dashboard';
import {describeActivity, type ActivityTranslator} from '../dashboardActivity';

/** A stub that echoes the key and the values, and knows only the keys it is given. */
const translator = (known: string[]): ActivityTranslator => {
  const t = ((key: string, values?: Record<string, string | number>) =>
    `${key}${values ? `|${JSON.stringify(values)}` : ''}`) as ActivityTranslator;
  t.has = (key) => known.includes(key);
  return t;
};

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  type: 'task.status_changed',
  actor: {user_id: 'enc-u', fullname: 'Nagy Béla'},
  occurred_at: '2026-09-20T09:12:00Z',
  entity: {type: 'task', id: 'enc-t', title: 'Plakát', key: 'WORF-42'},
  group_id: 'enc-g',
  group_name: 'DÖK',
  old_value: 'IN_PROGRESS',
  new_value: 'DONE',
  ...over
});

const identity = (_type: string, value: string) => value;

describe('describeActivity', () => {
  const t = translator([
    'events.task.status_changed',
    'events.task.status_changed_plain',
    'events.task.priority_changed',
    'events.task.priority_changed_plain',
    'events.task.created',
    'events.minutes.approved'
  ]);

  it('uses the with-values sentence when the change carries both values', () => {
    const text = describeActivity(t, item(), (_type, v) => v.toLowerCase());
    expect(text).toContain('events.task.status_changed|');
    expect(text).toContain('"from":"in_progress"');
    expect(text).toContain('"to":"done"');
    expect(text).toContain('"actor":"Nagy Béla"');
    expect(text).toContain('"title":"Plakát"');
  });

  it('falls back to the plain sentence when a value is missing', () => {
    expect(describeActivity(t, item({old_value: null}), identity)).toContain('events.task.status_changed_plain|');
    expect(describeActivity(t, item({type: 'task.priority_changed', new_value: null}), identity)).toContain(
      'events.task.priority_changed_plain|'
    );
  });

  it('does not use the plain variant for actions that never carry values', () => {
    expect(describeActivity(t, item({type: 'task.created', old_value: null, new_value: null}), identity)).toContain(
      'events.task.created|'
    );
  });

  it('names a missing actor as someone', () => {
    const text = describeActivity(t, item({type: 'minutes.approved', actor: null}), identity);
    expect(text).toContain('"actor":"someone"');
  });

  it('treats a blank actor name as missing', () => {
    expect(describeActivity(t, item({actor: {user_id: 'x', fullname: '  '}}), identity)).toContain('"actor":"someone"');
  });

  it('reads sensibly for an action this build has no sentence for', () => {
    const text = describeActivity(t, item({type: 'task.brand_new_action', old_value: null, new_value: null}), identity);
    expect(text).toContain('events.unknown|');
    expect(text).toContain('"title":"Plakát"');
  });

  it('passes the entity type and value to the value translator', () => {
    const seen: Array<[string, string]> = [];
    describeActivity(t, item(), (type, value) => {
      seen.push([type, value]);
      return value;
    });
    expect(seen).toEqual([
      ['task.status_changed', 'IN_PROGRESS'],
      ['task.status_changed', 'DONE']
    ]);
  });
});
