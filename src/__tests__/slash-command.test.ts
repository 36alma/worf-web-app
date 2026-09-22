// @vitest-environment jsdom
import {describe, it, expect, vi} from 'vitest';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {SlashCommand} from '@/components/groups/minutes/editor/slashCommandExtension';
import {CommandChip} from '@/components/groups/minutes/editor/commandChipExtension';

const commands = [
  {name: 'task', title: 'Feladat', description: 'd', actions: [{action: 'create', title: 'Új'}]}
] as any;

function setup(getCommands = () => commands) {
  Range.prototype.getClientRects = () => ({length: 0, item: () => null, [Symbol.iterator]: function* () {}}) as any;
  Range.prototype.getBoundingClientRect = () => ({left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0}) as any;
  (document as any).elementFromPoint = () => null;
  const onActionTrigger = vi.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [
      StarterKit,
      SlashCommand.configure({emptyLabel: 'none', getCommands, onActionTrigger}),
      CommandChip
    ],
    content: '<p></p>'
  });
  return {editor, onActionTrigger};
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('slash command', () => {
  it('opens the menu on "/"', async () => {
    const {editor} = setup();
    editor.commands.focus();
    editor.commands.insertContent('/');
    await tick();
    expect(document.querySelector('.suggestion-dropdown')).not.toBeNull();
  });

  it('typing "/task " fires the action trigger', async () => {
    const {editor, onActionTrigger} = setup();
    editor.commands.focus();
    editor.commands.insertContent('/task');
    await tick();
    editor.commands.insertContent(' ');
    await tick();
    expect(onActionTrigger).toHaveBeenCalledTimes(1);
    expect(onActionTrigger.mock.calls[0][0].command).toBe('task');
  });
});
