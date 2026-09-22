// @vitest-environment jsdom
import React, {StrictMode} from 'react';
import {describe, it, expect, vi, beforeAll} from 'vitest';
import {render, waitFor, act} from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((k: string) => k, {has: () => false}),
  useLocale: () => 'hu'
}));
vi.mock('@/lib/api/palette', async (orig) => {
  const actual = await orig<typeof import('@/lib/api/palette')>();
  return {
    ...actual,
    listPaletteCommands: vi.fn().mockResolvedValue({
      data: {commands: [{name: 'task', title: 'Feladat', description: 'd', actions: [{action: 'create', title: 'Új'}]}]}
    })
  };
});
vi.mock('@/lib/api/minutes', () => ({searchMentionUsers: vi.fn()}));
vi.mock('@/lib/api/groups', () => ({getGroupMembers: vi.fn().mockResolvedValue({data: []})}));

import MinutesContentEditor from '@/components/groups/minutes/editor/MinutesContentEditor';
import {EntityModalProvider} from '@/components/groups/minutes/editor/EntityModalProvider';

beforeAll(() => {
  Range.prototype.getClientRects = () => ({length: 0, item: () => null, [Symbol.iterator]: function* () {}}) as any;
  Range.prototype.getBoundingClientRect = () => ({left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0}) as any;
  (document as any).elementFromPoint = () => null;
});

describe('MinutesContentEditor slash menu', () => {
  it('opens the menu on "/" (StrictMode)', async () => {
    const {container} = render(
      <StrictMode>
        <EntityModalProvider groupId="g1">
          <MinutesContentEditor groupId="g1" value="" onChange={() => {}} />
        </EntityModalProvider>
      </StrictMode>
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const pm = container.querySelector('.ProseMirror') as HTMLElement;
    expect(pm).not.toBeNull();
    const editor = (pm as any).editor;
    expect(editor).toBeTruthy();
    await act(async () => {
      editor.commands.focus();
      editor.commands.insertContent('/');
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(document.querySelector('.suggestion-dropdown')).not.toBeNull();
    expect(document.querySelector('.suggestion-dropdown')?.textContent).toContain('Feladat');

    // choosing the command writes "/task " and opens the action modal
    await act(async () => {
      const item = document.querySelector('.suggestion-dropdown-item') as HTMLElement;
      item.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(editor.getText()).toContain('/task ');
    expect(document.body.textContent).toContain('Új');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // "Új" hands over to the task page's own create modal (not a generic form)
    await act(async () => {
      (document.querySelector('[role="menuitem"]') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(document.body.textContent).toContain('page.createTitle');
    expect(document.body.textContent).toContain('form.createLabel');
  });
});
