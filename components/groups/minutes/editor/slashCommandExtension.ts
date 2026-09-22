import {Extension, type Editor} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import type {EditorState} from '@tiptap/pm/state';
import Suggestion, {type SuggestionOptions} from '@tiptap/suggestion';
import {isCommandName, type CommandName, type PaletteCommand} from '@/lib/api/palette';
import {createSuggestionRender} from './suggestionDropdown';

export interface ActionTrigger {
  editor: Editor;
  command: CommandName;
  /** Range of the `/name ` trigger text (removed or replaced by the flow). */
  range: {from: number; to: number};
  rect: {left: number; bottom: number};
}

export interface SlashCommandOptions {
  /** Current permission-filtered catalog (read lazily — it changes with the group/role). */
  getCommands: () => PaletteCommand[];
  emptyLabel: string;
  onActionTrigger: (trigger: ActionTrigger) => void;
}

const TRIGGER_RE = /(?:^|\s)\/(\w+) $/;

const textBeforeCursor = (state: EditorState): string | null => {
  const {$from, empty} = state.selection;
  return empty ? $from.parent.textBetween(0, $from.parentOffset, undefined, '￼') : null;
};

/**
 * `/` (at paragraph start or after whitespace) opens the command menu from the server catalog.
 * Choosing one writes `/name ` into the text; the trailing space (typed or inserted) then opens the
 * action picker via `onActionTrigger`. The server never executes commands — see lib/api/palette.ts.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',
  addOptions() {
    return {getCommands: () => [], emptyLabel: '', onActionTrigger: () => {}};
  },
  addProseMirrorPlugins() {
    const extension = this;
    // The menu opens the action picker itself; the text watcher below must not fire a second time for it.
    let openedByMenu = false;
    const suggestion: Omit<SuggestionOptions<PaletteCommand>, 'editor'> = {
      char: '/',
      allow: () => extension.options.getCommands().length > 0,
      items: ({query}) => {
        const q = query.toLowerCase();
        return extension.options
          .getCommands()
          .filter((c) => c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
      },
      render: createSuggestionRender<PaletteCommand>({
        getLabel: (c) => c.title,
        getSubLabel: (c) => c.description,
        emptyLabel: extension.options.emptyLabel
      }),
      command: ({editor, range, props}) => {
        openedByMenu = true;
        editor
          .chain()
          .focus()
          .insertContentAt(range, {type: 'text', text: `/${props.name} `})
          .run();
        const to = range.from + props.name.length + 2;
        const coords = editor.view.coordsAtPos(Math.min(to, editor.state.doc.content.size));
        extension.options.onActionTrigger({
          editor,
          command: props.name,
          range: {from: range.from, to},
          rect: {left: coords.left, bottom: coords.bottom}
        });
      }
    };

    const triggerPlugin = new Plugin({
      view: () => ({
        update: (view, prevState) => {
          if (view.state.doc.eq(prevState.doc)) return;
          if (openedByMenu) {
            openedByMenu = false;
            return;
          }
          const before = textBeforeCursor(view.state);
          const match = before ? TRIGGER_RE.exec(before) : null;
          if (!match) return;
          const prevBefore = textBeforeCursor(prevState);
          if (prevBefore && TRIGGER_RE.test(prevBefore)) return;
          const name = match[1];
          if (!isCommandName(name) || !extension.options.getCommands().some((c) => c.name === name)) return;
          const to = view.state.selection.from;
          const coords = view.coordsAtPos(to);
          extension.options.onActionTrigger({
            editor: extension.editor,
            command: name,
            range: {from: to - (name.length + 2), to},
            rect: {left: coords.left, bottom: coords.bottom}
          });
        }
      })
    });

    return [Suggestion({editor: this.editor, ...suggestion}), triggerPlugin];
  }
});
