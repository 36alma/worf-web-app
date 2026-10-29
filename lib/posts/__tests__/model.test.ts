import {describe, expect, it} from 'vitest';
import {normalizeComment, normalizePost, normalizeReactionCounts, normalizeReactionState} from '../model';
import {diffLines} from '@/lib/utils/lineDiff';
import {isoToLocalInput, localInputToIso} from '@/lib/utils/zonedTime';

describe('normalizePost', () => {
  it('reads a get response', () => {
    const post = normalizePost({
      post: {
        post_id: 'enc1',
        post_uuid: 'uuid-1',
        title: 'Hello',
        content: '<p>x</p>',
        status: 'pending_review',
        is_read: false,
        is_pinned: true,
        review: {decision: 'REJECTED', comment: 'fix it', decided_at: '2026-10-01T10:00:00Z'},
        tags: [{tag_id: 't1', name: 'News'}],
        links: [{type: 'task', id: 'k1', label: 'WORF-1'}, {type: 'bogus', id: 'x'}],
        author: {id: 'u1', name: 'Anna'},
        comments_enabled: false
      }
    });
    expect(post).toMatchObject({
      id: 'enc1',
      uuid: 'uuid-1',
      status: 'pending_review',
      isRead: false,
      isPinned: true,
      isAuthorView: true,
      commentsEnabled: false,
      author: 'Anna',
      authorId: 'u1',
      review: {decision: 'rejected', comment: 'fix it'}
    });
    expect(post?.tags).toEqual([{id: 't1', name: 'News'}]);
    expect(post?.links).toEqual([{type: 'task', id: 'k1', label: 'WORF-1'}]);
  });

  it('defaults unknown status to published and marks non-author view', () => {
    const post = normalizePost({post_id: 'a', status: 'weird'});
    expect(post?.status).toBe('published');
    expect(post?.isAuthorView).toBe(false);
    expect(post?.isRead).toBe(true);
  });
});

describe('reactions', () => {
  it('accepts both dict and list shapes', () => {
    expect(normalizeReactionCounts({like: 2, bogus: 1})).toEqual({like: 2});
    expect(normalizeReactionCounts([{emoji: 'sad', count: 3}])).toEqual({sad: 3});
  });

  it('falls back to the full reaction list', () => {
    expect(normalizeReactionState({reactions: {}, my_reactions: ['like']}).available).toHaveLength(6);
  });
});

describe('normalizeComment', () => {
  it('keeps deleted placeholders and replies', () => {
    const comment = normalizeComment({
      comment_id: 'c1',
      author: null,
      deleted: true,
      content: '',
      replies: [{comment_id: 'c2', author: {id: 'u', name: 'B'}, content: 'hi', is_mine: true}]
    });
    expect(comment?.author).toBeNull();
    expect(comment?.deleted).toBe(true);
    expect(comment?.replies[0]).toMatchObject({id: 'c2', isMine: true});
  });
});

describe('zonedTime', () => {
  it('adds the zone offset (winter and summer)', () => {
    expect(localInputToIso('2026-11-01T09:00', 'Europe/Budapest')).toBe('2026-11-01T09:00:00+01:00');
    expect(localInputToIso('2026-07-01T09:00', 'Europe/Budapest')).toBe('2026-07-01T09:00:00+02:00');
    expect(localInputToIso('2026-07-01T09:00', 'UTC')).toBe('2026-07-01T09:00:00+00:00');
    expect(localInputToIso('', 'UTC')).toBe('');
  });

  it('round-trips to wall clock', () => {
    expect(isoToLocalInput('2026-11-01T08:00:00Z', 'Europe/Budapest')).toBe('2026-11-01T09:00');
  });
});

describe('diffLines', () => {
  it('marks added and removed lines', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
      {kind: 'same', text: 'a'},
      {kind: 'removed', text: 'b'},
      {kind: 'added', text: 'x'},
      {kind: 'same', text: 'c'}
    ]);
  });
});
