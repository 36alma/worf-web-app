/** Render smoke tests: the eligibility marks and the import review show what the server told us. */
import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import messages from '@/messages/hu.json';
import type {GroupUser} from '@/components/groups/tasks/types';
import ImportParticipantsReview from '../ImportParticipantsReview';
import ParticipantsPanel from '../ParticipantsPanel';
import WitnessPanel from '../WitnessPanel';
import type {MinutesParticipant} from '../types';
import {getWitnessState} from '../witness';
import {collectWitnessFlags} from '../witnessIssues';

// The panels only call these from effects / handlers, which a static render never runs.
vi.mock('@/lib/api/minutes', () => ({}));
vi.mock('next/navigation', () => ({useRouter: () => ({push: () => undefined})}));

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="hu" messages={messages}>
      {node}
    </NextIntlClientProvider>
  );

const members: GroupUser[] = [
  {user_id: 'u-anna', full_name: 'Kiss Anna', email: 'anna@example.com', username: 'anna'},
  {user_id: 'u-bela', full_name: 'Nagy Béla', email: 'bela@example.com', username: 'bela'}
];

const witness = (over: Partial<MinutesParticipant>): MinutesParticipant => ({
  id: 'p1',
  minutes_id: 'm1',
  role: 'WITNESS',
  user_id: 'u-anna',
  approval_status: 'PENDING',
  is_eligible: true,
  eligibility_issue: null,
  ...over
});

describe('ParticipantsPanel', () => {
  it('marks a witness that is no longer eligible, with the reason the server gave', () => {
    const participants = [
      witness({id: 'ok', user_id: 'u-bela'}),
      witness({id: 'bad', is_eligible: false, eligibility_issue: 'minutes.witness_not_eligible'})
    ];
    const html = render(
      <ParticipantsPanel
        groupId="g1"
        minutesId="m1"
        participants={participants}
        members={members}
        editable={false}
        witnessFlags={collectWitnessFlags(participants)}
        onChange={() => undefined}
        onImported={() => undefined}
      />
    );
    expect(html).toContain('Kiss Anna');
    expect(html).toContain(messages.group_minutes.errors.code.witness_not_eligible);
    // Only the flagged row carries the amber highlight.
    expect(html.match(/border-amber-300/g)?.length).toBe(1);
  });

  it('marks nobody when every witness is eligible', () => {
    const participants = [witness({})];
    const html = render(
      <ParticipantsPanel
        groupId="g1"
        minutesId="m1"
        participants={participants}
        members={members}
        editable={false}
        witnessFlags={collectWitnessFlags(participants)}
        onChange={() => undefined}
        onImported={() => undefined}
      />
    );
    expect(html).not.toContain('border-amber-300');
  });
});

describe('WitnessPanel', () => {
  it('says the approval is stuck when a witness is ineligible while awaiting approval', () => {
    const participants = [witness({is_eligible: false, eligibility_issue: 'minutes.witness_not_eligible'})];
    const state = getWitnessState({
      status: 'PENDING_APPROVAL',
      participants,
      currentUserId: null,
      canApprove: false,
      viewer: {is_witness: false, can_vote: false, my_approval_status: null}
    });
    const html = render(
      <WitnessPanel
        status="PENDING_APPROVAL"
        state={state}
        members={members}
        witnessFlags={collectWitnessFlags(participants)}
      />
    );
    expect(html).toContain(messages.group_minutes.witness.ineligible);
    expect(html).toContain('vond vissza a lezárást');
  });
});

describe('ImportParticipantsReview', () => {
  it('shows the problem only on the row that has one', () => {
    const html = render(
      <ImportParticipantsReview
        participants={[
          {display_name: 'Kovács Károly', role: 'WITNESS'},
          {display_name: 'Szabó Sára', role: 'ATTENDEE', user_id: 'u-anna'}
        ]}
        problems={new Map([[0, 'witness_needs_member']])}
        members={members}
        witnessCandidates={[]}
        witnessCandidatesFailed={false}
        minuteTakerId=""
        onChange={() => undefined}
      />
    );
    expect(html).toContain('Kovács Károly');
    expect(html).toContain('Szabó Sára');
    expect(html).toContain(messages.group_minutes.import.witness_needs_member);
    expect(html.match(/border-amber-300/g)?.length).toBe(1);
    // (A Radix Select renders its selected label only after mounting in the browser, so the trigger is not asserted.)
  });
});
