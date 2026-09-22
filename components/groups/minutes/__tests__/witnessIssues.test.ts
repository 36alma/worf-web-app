import {describe, expect, it} from 'vitest';
import type {MinutesParticipant} from '../types';
import {collectWitnessFlags, countWarnings} from '../witnessIssues';

const participant = (over: Partial<MinutesParticipant>): MinutesParticipant => ({
  id: 'p1',
  minutes_id: 'm1',
  role: 'WITNESS',
  user_id: 'u1',
  approval_status: 'PENDING',
  is_eligible: true,
  eligibility_issue: null,
  ...over
});

describe('collectWitnessFlags', () => {
  it('flags a witness the server calls ineligible, with its reason', () => {
    const flags = collectWitnessFlags([
      participant({id: 'a'}),
      participant({id: 'b', is_eligible: false, eligibility_issue: 'minutes.witness_not_eligible'})
    ]);
    expect([...flags.entries()]).toEqual([['b', 'witness_not_eligible']]);
  });

  it('keeps an unknown reason as a flag without a code', () => {
    const flags = collectWitnessFlags([participant({id: 'b', is_eligible: false, eligibility_issue: 'minutes.newer'})]);
    expect(flags.has('b')).toBe(true);
    expect(flags.get('b')).toBeNull();
  });

  it('never flags a non-witness, whatever its is_eligible says', () => {
    expect(collectWitnessFlags([participant({id: 'x', role: 'ATTENDEE', is_eligible: false})]).size).toBe(0);
    expect(collectWitnessFlags([participant({id: 'x', role: 'ATTENDEE', is_eligible: null})]).size).toBe(0);
  });

  it('adds the witnesses a refused finalize named, and drops ones that are gone', () => {
    const flags = collectWitnessFlags(
      [participant({id: 'a'}), participant({id: 'b'})],
      [
        {participantId: 'b', code: 'witness_requires_registered_user'},
        {participantId: 'removed', code: 'witness_not_eligible'}
      ]
    );
    expect([...flags.entries()]).toEqual([['b', 'witness_requires_registered_user']]);
  });

  it('lets the finalize issue refine the code, but keeps the persistent one when it has none', () => {
    const persistent = participant({id: 'a', is_eligible: false, eligibility_issue: 'minutes.witness_not_eligible'});
    expect(collectWitnessFlags([persistent], [{participantId: 'a', code: 'witness_is_minute_taker'}]).get('a')).toBe(
      'witness_is_minute_taker'
    );
    expect(collectWitnessFlags([persistent], [{participantId: 'a', code: null}]).get('a')).toBe('witness_not_eligible');
  });

  it('is empty for an older server that sends no eligibility at all', () => {
    const legacy = {id: 'a', minutes_id: 'm1', role: 'WITNESS', user_id: 'u1'} as MinutesParticipant;
    expect(collectWitnessFlags([legacy]).size).toBe(0);
  });
});

describe('countWarnings', () => {
  it('counts the flagged witnesses of a revise / restore answer', () => {
    expect(
      countWarnings({
        warnings: [
          {participant_id: 'p1', code: 'minutes.witness_not_eligible'},
          {participant_id: 'p2', code: 'x'}
        ]
      })
    ).toBe(2);
  });

  it('is zero for an empty, missing or malformed list', () => {
    expect(countWarnings({warnings: []})).toBe(0);
    expect(countWarnings({})).toBe(0);
    expect(countWarnings(undefined)).toBe(0);
    expect(countWarnings({warnings: [null, {code: 'x'}]})).toBe(0);
  });
});
