import {describe, expect, it} from 'vitest';
import {parseUserGroups} from '../userGroups';

describe('parseUserGroups', () => {
  it('reads group_id / group_name from a wrapped list', () => {
    expect(parseUserGroups({data: {group_users: [{group_id: 'g1=', group_name: 'DÖK'}]}})).toEqual([
      {id: 'g1=', name: 'DÖK'}
    ]);
  });

  it('accepts a bare array and the id / name field names', () => {
    expect(parseUserGroups([{id: 'g2', name: 'Klub'}])).toEqual([{id: 'g2', name: 'Klub'}]);
  });

  it('decodes a percent-encoded id and falls back to the id as the name', () => {
    expect(parseUserGroups({groups: [{group_id: 'g3%3D'}]})).toEqual([{id: 'g3=', name: 'g3='}]);
  });

  it('skips rows without an id and survives an empty payload', () => {
    expect(parseUserGroups({groups: [{group_name: 'x'}, null]})).toEqual([]);
    expect(parseUserGroups(undefined)).toEqual([]);
    expect(parseUserGroups({})).toEqual([]);
  });
});
