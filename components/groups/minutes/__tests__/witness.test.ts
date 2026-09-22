import {describe, expect, it} from 'vitest';
import type {GroupUser} from '@/components/groups/tasks/types';
import type {MinutesParticipant} from '../types';
import {getWitnessState, resolveCurrentUserId} from '../witness';

const participant = (over: Partial<MinutesParticipant>): MinutesParticipant => ({
  id: 'p1',
  minutes_id: 'm1',
  role: 'WITNESS',
  user_id: 'u1',
  display_name: null,
  approval_status: 'PENDING',
  ...over
});

const members: GroupUser[] = [
  {user_id: 'enc-anna', full_name: 'Kiss Anna', email: 'Anna@Example.com', username: 'anna'},
  {user_id: 'enc-bela', full_name: 'Nagy Béla', email: 'bela@example.com', username: 'bela'}
];

describe('resolveCurrentUserId', () => {
  it('prefers the id from the profile', () => {
    expect(resolveCurrentUserId({id: 'enc-me', email: 'anna@example.com'}, members)).toBe('enc-me');
  });

  it('accepts user_id when id is missing', () => {
    expect(resolveCurrentUserId({user_id: 'enc-me'}, members)).toBe('enc-me');
  });

  it('falls back to the group member with the same e-mail (case-insensitive)', () => {
    expect(resolveCurrentUserId({email: ' anna@example.COM '}, members)).toBe('enc-anna');
  });

  it('falls back to the username when there is no e-mail match', () => {
    expect(resolveCurrentUserId({email: 'other@example.com', username: 'Bela'}, members)).toBe('enc-bela');
  });

  it('returns null when nothing matches', () => {
    expect(resolveCurrentUserId({email: 'nobody@example.com'}, members)).toBeNull();
    expect(resolveCurrentUserId(null, members)).toBeNull();
    expect(resolveCurrentUserId({}, [])).toBeNull();
  });
});

describe('getWitnessState', () => {
  const participants = [
    participant({id: 'p1', user_id: 'u1', approval_status: 'APPROVED'}),
    participant({id: 'p2', user_id: 'u2'}),
    participant({id: 'p3', role: 'ATTENDEE', user_id: 'u3'})
  ];

  it('lets a registered witness with the permission vote while awaiting approval', () => {
    const s = getWitnessState({status: 'PENDING_APPROVAL', participants, currentUserId: 'u2', canApprove: true});
    expect(s.canVote).toBe(true);
    expect(s.self?.id).toBe('p2');
    expect(s.witnesses).toHaveLength(2);
    expect(s.approvedCount).toBe(1);
  });

  it('still lets an already-approved witness change the vote', () => {
    const s = getWitnessState({status: 'PENDING_APPROVAL', participants, currentUserId: 'u1', canApprove: true});
    expect(s.canVote).toBe(true);
  });

  it('does not offer voting to a non-witness (attendee, stranger, unknown user)', () => {
    for (const currentUserId of ['u3', 'nobody', null]) {
      const s = getWitnessState({status: 'PENDING_APPROVAL', participants, currentUserId, canApprove: true});
      expect(s.canVote).toBe(false);
      expect(s.selfWithoutPermission).toBe(false);
    }
  });

  it('does not offer voting outside PENDING_APPROVAL', () => {
    for (const status of ['DRAFT', 'APPROVED', 'ARCHIVED'] as const) {
      expect(getWitnessState({status, participants, currentUserId: 'u2', canApprove: true}).canVote).toBe(false);
    }
  });

  it('flags a witness whose role lacks group.minutes.approve', () => {
    const s = getWitnessState({status: 'PENDING_APPROVAL', participants, currentUserId: 'u2', canApprove: false});
    expect(s.canVote).toBe(false);
    expect(s.selfWithoutPermission).toBe(true);
  });

  it('lists witnesses that have no user_id as external', () => {
    const withExternal = [...participants, participant({id: 'p4', user_id: null, display_name: 'Külsős Kata'})];
    const s = getWitnessState({status: 'PENDING_APPROVAL', participants: withExternal, currentUserId: 'u2', canApprove: true});
    expect(s.externalWitnesses.map((w) => w.id)).toEqual(['p4']);
  });

  describe('with the server-side viewer block', () => {
    it('lets the viewer vote even when the caller id could not be resolved', () => {
      const s = getWitnessState({
        status: 'PENDING_APPROVAL',
        participants,
        currentUserId: null,
        canApprove: false,
        viewer: {is_witness: true, can_vote: true, my_approval_status: 'PENDING'}
      });
      expect(s.canVote).toBe(true);
      expect(s.isWitness).toBe(true);
      expect(s.myApprovalStatus).toBe('PENDING');
      expect(s.self).toBeNull();
    });

    it('wins over the local guess when the server says the caller cannot vote', () => {
      const s = getWitnessState({
        status: 'PENDING_APPROVAL',
        participants,
        currentUserId: 'u2',
        canApprove: true,
        viewer: {is_witness: true, can_vote: false, my_approval_status: 'PENDING'}
      });
      expect(s.canVote).toBe(false);
      expect(s.selfWithoutPermission).toBe(false);
      expect(s.self?.id).toBe('p2');
    });

    it('keeps the buttons for a witness who already approved', () => {
      const s = getWitnessState({
        status: 'PENDING_APPROVAL',
        participants,
        currentUserId: 'u1',
        canApprove: true,
        viewer: {is_witness: true, can_vote: true, my_approval_status: 'APPROVED'}
      });
      expect(s.canVote).toBe(true);
      expect(s.myApprovalStatus).toBe('APPROVED');
    });

    it('reports a non-witness viewer as such', () => {
      const s = getWitnessState({
        status: 'PENDING_APPROVAL',
        participants,
        currentUserId: 'u2',
        canApprove: true,
        viewer: {is_witness: false, can_vote: false, my_approval_status: null}
      });
      expect(s.isWitness).toBe(false);
      expect(s.canVote).toBe(false);
      expect(s.myApprovalStatus).toBeNull();
    });
  });
});
