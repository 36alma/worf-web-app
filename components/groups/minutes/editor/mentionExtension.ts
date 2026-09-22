import {mergeAttributes} from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import type {SuggestionOptions} from '@tiptap/suggestion';
import {searchMentionUsers} from '@/lib/api/minutes';
import {createSuggestionRender} from './suggestionDropdown';

export interface MentionUser {
  user_id: string;
  username: string;
  full_name: string;
}

/**
 * Renders/parses `<span data-mention-type="user" data-mention-id="...">@Label</span>`
 * per §3.1 of the meeting-minutes rich text editor spec (not TipTap's default
 * `data-type="mention" data-id="..."` shape).
 */
const MentionNode = Mention.extend({
  name: 'mention',
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-mention-id'),
        renderHTML: (attributes: {id?: string | null}) => (attributes.id ? {'data-mention-id': attributes.id} : {})
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => (element.textContent ?? '').replace(/^@/, '') || null,
        renderHTML: () => ({})
      }
    };
  },
  parseHTML() {
    return [{tag: 'span[data-mention-type="user"]'}];
  },
  renderHTML({node, HTMLAttributes}) {
    return ['span', mergeAttributes(HTMLAttributes, {'data-mention-type': 'user'}), `@${node.attrs.label ?? node.attrs.id}`];
  }
});

export interface BuildMentionExtensionOptions {
  groupId: string;
  emptyLabel: string;
}

export function buildMentionExtension({groupId, emptyLabel}: BuildMentionExtensionOptions) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const suggestion: Omit<SuggestionOptions<MentionUser>, 'editor'> = {
    char: '@',
    items: ({query}) =>
      new Promise((resolve) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          searchMentionUsers({group_id: groupId, query, limit: 8})
            .then(({data}) => resolve((data as {users?: MentionUser[]}).users ?? []))
            .catch(() => resolve([]));
        }, 200);
      }),
    render: createSuggestionRender<MentionUser>({
      getLabel: (u) => u.full_name || u.username,
      getSubLabel: (u) => (u.full_name ? u.username : undefined),
      emptyLabel
    }),
    command: ({editor, range, props}) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {type: 'mention', attrs: {id: props.user_id, label: props.full_name || props.username}},
          {type: 'text', text: ' '}
        ])
        .run();
    }
  };

  return MentionNode.configure({suggestion});
}
