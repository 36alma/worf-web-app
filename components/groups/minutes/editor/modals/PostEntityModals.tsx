'use client';

import {useRef, useState} from 'react';
import PostFormModal from '@/components/posts/PostFormModal';
import PostViewModal from '@/components/posts/PostViewModal';
import type {ChipRef} from '../entities';
import {useOpenErrorToast, type EntityHostProps} from './shared';

/** `PostViewModal` to open a chip, `PostFormModal` to create/edit (also reachable from the view). */
export default function PostEntityModals({ctx, request, onDone}: EntityHostProps) {
  const reportOpenError = useOpenErrorToast();
  const createdRef = useRef<ChipRef[]>([]);
  const [phase, setPhase] = useState<'view' | 'form'>(request.mode === 'view' ? 'view' : 'form');
  const postId = request.mode === 'modify' ? request.item.id : request.mode === 'view' ? request.ref.id : undefined;

  if (phase === 'view' && postId) {
    return (
      <PostViewModal
        open
        groupId={ctx.groupId}
        postId={postId}
        onClose={() => onDone()}
        onEdit={() => setPhase('form')}
        onDeleted={() => onDone()}
        onLoadError={(error) => {
          reportOpenError(error);
          onDone();
        }}
      />
    );
  }

  return (
    <PostFormModal
      open
      mode={postId ? 'edit' : 'create'}
      groupId={ctx.groupId}
      postId={postId}
      onSaved={(post) => {
        if (!postId && post.id) createdRef.current = [{type: 'post', id: post.id, label: post.title}];
      }}
      onClose={() => onDone(createdRef.current)}
    />
  );
}
