'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import {buildMinutesEditorI18n} from '../minutesEditorI18n';
import {buildMentionExtension} from './mentionExtension';
import {SlashCommand, type ActionTrigger} from './slashCommandExtension';
import {CommandChip} from './commandChipExtension';
import SlashCommandFlow from './SlashCommandFlow';
import {useChipOpener} from './useChipOpener';
import {useEditorContext} from './editorContext';
import type {PaletteCommand} from '@/lib/api/palette';
import {loadPaletteCatalog} from './paletteCatalog';
import type {ChipRef} from './entities';

export interface MinutesContentEditorProps {
  groupId: string;
  /** The minutes being edited — excluded from `/minutes` references (no self-reference). */
  minutesId?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * The Word-document-style rich text editor for an agenda item's `content_html` —
 * TipTap (via MarkdownEditor) plus `@mention` and the `/` commands (task, event, post,
 * minutes, file) driven by the permission-filtered catalog from `/v1/palette/list-commands`.
 */
export default function MinutesContentEditor({groupId, minutesId, value, onChange, placeholder}: MinutesContentEditorProps) {
  const t = useTranslations('group_minutes');
  const editorI18n = buildMinutesEditorI18n((key) => t(key as any));
  const ctx = useEditorContext(groupId, minutesId);
  const {open: openChip} = useChipOpener();

  const [commands, setCommands] = useState<PaletteCommand[]>([]);
  const [trigger, setTrigger] = useState<ActionTrigger | null>(null);

  // Extensions must stay referentially stable across renders (MarkdownEditor's useEditor only reads
  // them on mount), so anything that changes is read through `live`. `live` is created in the SAME
  // memo as the extensions: paired by construction (separate refs can diverge under StrictMode's
  // double render, leaving the extension reading a catalog nobody updates).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const {extraExtensions, live} = useMemo(() => {
    const live = {commands: [] as PaletteCommand[], openChip: (_ref: ChipRef) => {}};
    return {
      live,
      extraExtensions: [
        buildMentionExtension({groupId, emptyLabel: t('editor.mentions.empty')}),
        SlashCommand.configure({
          emptyLabel: t('editor.commands.empty'),
          getCommands: () => live.commands,
          onActionTrigger: setTrigger
        }),
        CommandChip.configure({onOpen: (ref) => live.openChip(ref)})
      ]
    };
  }, []);
  live.openChip = (ref) => openChip(ref);

  // Catalog: on mount and on group change; force-reloaded after any 403 (roles can change meanwhile).
  // Shared/deduplicated — see paletteCatalog.ts.
  const loadCatalog = useCallback(
    async (force = false) => {
      const next = await loadPaletteCatalog(groupId, force);
      live.commands = next;
      setCommands(next);
    },
    [groupId, live]
  );

  useEffect(() => {
    void loadCatalog(false);
  }, [loadCatalog]);

  return (
    <>
      <MarkdownEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        i18n={editorI18n}
        extraExtensions={extraExtensions}
      />
      <SlashCommandFlow
        ctx={ctx}
        commands={commands}
        trigger={trigger}
        onFinished={() => setTrigger(null)}
        onForbidden={() => void loadCatalog(true)}
      />
    </>
  );
}
