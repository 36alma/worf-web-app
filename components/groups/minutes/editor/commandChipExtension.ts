import {Node, mergeAttributes} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import {isCommandName, type CommandName} from '@/lib/api/palette';

export interface CommandChipAttrs {
  commandType: CommandName | null;
  commandId?: string | null;
  label: string;
}

export interface CommandChipOptions {
  onOpen: (ref: {type: CommandName; id: string; label: string}) => void;
}

/**
 * Serializes exactly `<span data-command-type=".." data-command-id="..">label</span>` — the server
 * re-sanitizes on save and drops class/style/contenteditable/child elements, so the chip relies on
 * `data-*` only (styling via attribute selectors in globals.css, behavior via click delegation).
 * Only the five known types parse as chips; anything else (e.g. legacy `create_task`) stays text.
 */
export const CommandChip = Node.create<CommandChipOptions>({
  name: 'commandChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return {onOpen: () => {}};
  },
  addAttributes() {
    return {
      commandType: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-command-type'),
        renderHTML: (attributes: CommandChipAttrs) =>
          attributes.commandType ? {'data-command-type': attributes.commandType} : {}
      },
      commandId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-command-id'),
        renderHTML: (attributes: CommandChipAttrs) =>
          attributes.commandId ? {'data-command-id': attributes.commandId} : {}
      },
      label: {
        default: '',
        parseHTML: (element: HTMLElement) => (element.textContent ?? '').replace(/^✓\s*/, ''),
        renderHTML: () => ({})
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-command-type][data-command-id]',
        getAttrs: (element) =>
          isCommandName((element as HTMLElement).getAttribute('data-command-type')) ? null : false
      }
    ];
  },
  renderHTML({node, HTMLAttributes}) {
    return ['span', mergeAttributes(HTMLAttributes), node.attrs.label];
  },
  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            click: (_view, event) => {
              const ref = readChip(event.target);
              if (!ref) return false;
              event.preventDefault();
              extension.options.onOpen(ref);
              return true;
            }
          }
        }
      })
    ];
  }
});

/** Reads a chip from a click target; shared by the editor and the read-only renderer. */
export function readChip(target: EventTarget | null): {type: CommandName; id: string; label: string} | null {
  const el = (target as HTMLElement | null)?.closest?.('span[data-command-type][data-command-id]');
  if (!el) return null;
  const type = el.getAttribute('data-command-type');
  const id = el.getAttribute('data-command-id');
  if (!isCommandName(type) || !id) return null;
  return {type, id, label: el.textContent ?? ''};
}
