import {describe, expect, it} from 'vitest';
import {
  buildImportParticipantsPayload,
  downgradeProblemWitnesses,
  findImportParticipantProblems
} from '../importParticipants';
import type {MinutesImportParticipantProposal} from '../types';

const row = (over: Partial<MinutesImportParticipantProposal>): MinutesImportParticipantProposal => ({
  display_name: 'Kiss Anna',
  role: 'ATTENDEE',
  ...over
});

const eligible = new Set(['u-anna', 'u-bela']);

describe('findImportParticipantProblems', () => {
  it('has nothing to say about plain attendees, assigned or not', () => {
    const problems = findImportParticipantProblems({
      participants: [row({}), row({user_id: 'u-anna'})],
      minuteTakerId: 'u-me',
      eligibleWitnessIds: eligible
    });
    expect(problems.size).toBe(0);
  });

  it('refuses a witness that is only a name', () => {
    const problems = findImportParticipantProblems({
      participants: [row({role: 'WITNESS'})],
      minuteTakerId: 'u-me',
      eligibleWitnessIds: eligible
    });
    expect(problems.get(0)).toBe('witness_needs_member');
  });

  it('refuses the minute taker as a witness', () => {
    const problems = findImportParticipantProblems({
      participants: [row({role: 'WITNESS', user_id: 'u-anna'})],
      minuteTakerId: 'u-anna',
      eligibleWitnessIds: eligible
    });
    expect(problems.get(0)).toBe('witness_is_minute_taker');
  });

  it('refuses a witness the candidate list does not contain', () => {
    const problems = findImportParticipantProblems({
      participants: [row({role: 'WITNESS', user_id: 'u-zoli'}), row({role: 'WITNESS', user_id: 'u-bela'})],
      minuteTakerId: 'u-me',
      eligibleWitnessIds: eligible
    });
    expect(problems.get(0)).toBe('witness_not_eligible');
    expect(problems.has(1)).toBe(false);
  });

  it('does not judge eligibility while the candidate list is unknown (failed / truncated)', () => {
    const problems = findImportParticipantProblems({
      participants: [row({role: 'WITNESS', user_id: 'u-zoli'})],
      minuteTakerId: 'u-me',
      eligibleWitnessIds: null
    });
    expect(problems.size).toBe(0);
  });

  it('flags the second appearance of the same member', () => {
    const problems = findImportParticipantProblems({
      participants: [row({user_id: 'u-anna'}), row({role: 'CHAIR', user_id: 'u-anna'})],
      minuteTakerId: 'u-me',
      eligibleWitnessIds: eligible
    });
    expect(problems.has(0)).toBe(false);
    expect(problems.get(1)).toBe('duplicate_member');
  });

  it('keeps the witness problem over the duplicate one on the same row', () => {
    const problems = findImportParticipantProblems({
      participants: [row({user_id: 'u-anna'}), row({role: 'WITNESS', user_id: 'u-anna'})],
      minuteTakerId: 'u-anna',
      eligibleWitnessIds: eligible
    });
    expect(problems.get(1)).toBe('witness_is_minute_taker');
  });
});

describe('buildImportParticipantsPayload', () => {
  it('sends only the user_id for an assigned row and only the name for an unassigned one', () => {
    expect(
      buildImportParticipantsPayload([
        row({role: 'WITNESS', user_id: 'u-anna', display_name: 'Anna K.'}),
        row({role: 'ATTENDEE', display_name: 'Külsős Károly'})
      ])
    ).toEqual([
      {role: 'WITNESS', user_id: 'u-anna'},
      {role: 'ATTENDEE', display_name: 'Külsős Károly'}
    ]);
  });
});

describe('downgradeProblemWitnesses', () => {
  it('turns only the witnesses that break a witness rule into attendees', () => {
    const participants = [row({role: 'WITNESS'}), row({role: 'WITNESS', user_id: 'u-bela'}), row({role: 'CHAIR'})];
    const problems = findImportParticipantProblems({participants, minuteTakerId: 'u-me', eligibleWitnessIds: eligible});
    expect(downgradeProblemWitnesses(participants, problems).map((p) => p.role)).toEqual(['ATTENDEE', 'WITNESS', 'CHAIR']);
  });

  it('leaves a duplicated witness alone — a role change would not make the member unique', () => {
    const participants = [row({user_id: 'u-bela'}), row({role: 'WITNESS', user_id: 'u-bela'})];
    const problems = findImportParticipantProblems({participants, minuteTakerId: 'u-me', eligibleWitnessIds: eligible});
    expect(problems.get(1)).toBe('duplicate_member');
    expect(downgradeProblemWitnesses(participants, problems)[1].role).toBe('WITNESS');
  });
});
