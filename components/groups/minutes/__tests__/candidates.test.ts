import {describe, expect, it} from 'vitest';
import {parseMinuteTakerCandidates} from '../useMinuteTakerCandidates';
import {parseWitnessCandidates} from '../useWitnessCandidates';

describe('parseMinuteTakerCandidates', () => {
  it('reads user_id, username and full_name', () => {
    expect(
      parseMinuteTakerCandidates({candidates: [{user_id: 'u1', username: 'kiss.anna', full_name: 'Kiss Anna'}]})
    ).toEqual([{user_id: 'u1', username: 'kiss.anna', full_name: 'Kiss Anna'}]);
  });

  it('drops rows without a user_id and survives a missing / odd payload', () => {
    expect(parseMinuteTakerCandidates({candidates: [{username: 'x'}, null, 'str', {user_id: '  '}]})).toEqual([]);
    expect(parseMinuteTakerCandidates({})).toEqual([]);
    expect(parseMinuteTakerCandidates(undefined)).toEqual([]);
  });
});

describe('parseWitnessCandidates', () => {
  it('keeps the participant link of a member who is already on the record', () => {
    expect(
      parseWitnessCandidates({
        candidates: [
          {user_id: 'u1', username: 'a', full_name: 'A', participant_id: null, participant_role: null},
          {user_id: 'u2', username: 'b', full_name: 'B', participant_id: 'p9', participant_role: 'ATTENDEE'}
        ]
      })
    ).toEqual([
      {user_id: 'u1', username: 'a', full_name: 'A', participant_id: null, participant_role: null},
      {user_id: 'u2', username: 'b', full_name: 'B', participant_id: 'p9', participant_role: 'ATTENDEE'}
    ]);
  });
});
