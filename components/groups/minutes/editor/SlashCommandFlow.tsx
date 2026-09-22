'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {Input} from '@/components/ui/Input';
import type {ActionName, PaletteAction, PaletteCommand} from '@/lib/api/palette';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {ActionTrigger} from './slashCommandExtension';
import {ENTITY_ADAPTERS, type ChipRef, type EditorContext, type PickerItem} from './entities';
import {useEntityModals} from './EntityModalProvider';

export interface SlashCommandFlowProps {
  ctx: EditorContext;
  commands: PaletteCommand[];
  trigger: ActionTrigger | null;
  onFinished: () => void;
  /** Any action endpoint answered 403 — the host reloads the catalog. */
  onForbidden: () => void;
}

type Stage =
  | {kind: 'actions'}
  | {kind: 'picker'; action: Exclude<ActionName, 'create'>}
  /** The entity's own modal is open (see `EntityModalProvider`) — nothing of the flow is shown. */
  | {kind: 'entity'}
  | {kind: 'confirm'; item: PickerItem};

const statusOf = (error: unknown) => (error as {response?: {status?: number}} | undefined)?.response?.status;

/**
 * Drives the `/name ` → action picker → (item picker) → entity modal / confirm state machine.
 * `create` (the entity's own form) and `reference` replace the trigger text with chips; `modify`
 * (the entity's edit form), `delete` and cancel just remove it.
 */
export default function SlashCommandFlow({ctx, commands, trigger, onFinished, onForbidden}: SlashCommandFlowProps) {
  const t = useTranslations('group_minutes');
  const modals = useEntityModals();
  const [stage, setStage] = useState<Stage>({kind: 'actions'});
  const [busy, setBusy] = useState(false);

  const command = trigger ? commands.find((c) => c.name === trigger.command) : undefined;
  const adapter = trigger ? ENTITY_ADAPTERS[trigger.command] : undefined;

  useEffect(() => {
    setStage({kind: 'actions'});
    setBusy(false);
  }, [trigger]);

  const finish = useCallback(
    (chips: ChipRef[] = []) => {
      if (!trigger) return;
      // The modal may outlive the editor (navigation while it was open).
      if (!trigger.editor.isDestroyed) {
        const chain = trigger.editor.chain().focus();
        if (chips.length > 0) {
          chain
            .insertContentAt(
              trigger.range,
              chips.flatMap((chip) => [
                {type: 'commandChip', attrs: {commandType: chip.type, commandId: chip.id, label: chip.label}},
                {type: 'text', text: ' '}
              ])
            )
            .run();
        } else {
          chain.deleteRange(trigger.range).run();
        }
      }
      onFinished();
    },
    [trigger, onFinished]
  );

  const handleError = useCallback(
    (error: unknown) => {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
      if (statusOf(error) === 403) {
        onForbidden();
        finish();
      }
    },
    [t, onForbidden, finish]
  );

  if (!trigger || !command || !adapter) return null;

  const chooseAction = async (action: ActionName) => {
    if (action === 'create') {
      setStage({kind: 'entity'});
      finish(await modals.create(command.name));
      return;
    }
    setStage({kind: 'picker', action});
  };

  const onPicked = async (item: PickerItem, action: Exclude<ActionName, 'create'>) => {
    if (action === 'reference') return finish([{type: item.type, id: item.id, label: item.label}]);
    if (action === 'delete') return setStage({kind: 'confirm', item});
    setStage({kind: 'entity'});
    await modals.modify(item);
    finish();
  };

  const confirmDelete = async (item: PickerItem) => {
    setBusy(true);
    try {
      await adapter.remove!(ctx, item);
      toast.success(t('editor.flow.deleted'));
      finish();
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {stage.kind === 'actions' && (
        <ActionPicker
          title={command.title}
          actions={command.actions}
          disabled={busy}
          onSelect={(action) => void chooseAction(action)}
          onCancel={() => finish()}
        />
      )}

      {stage.kind === 'picker' && (
        <ItemPicker
          title={command.actions.find((a) => a.action === stage.action)?.title ?? command.title}
          ctx={ctx}
          command={command}
          action={stage.action}
          ownerOnly={Boolean(adapter.ownerOnly) && stage.action !== 'reference'}
          onPick={(item) => void onPicked(item, stage.action)}
          onCancel={() => finish()}
          onError={handleError}
        />
      )}

      {stage.kind === 'confirm' && (
        <ConfirmDialog
          open
          title={t('editor.flow.confirm_delete_title')}
          message={t('editor.flow.confirm_delete', {label: stage.item.label})}
          cancelLabel={t('form.cancel')}
          confirmLabel={t('editor.flow.yes_delete')}
          onCancel={() => finish()}
          onConfirm={() => !busy && void confirmDelete(stage.item)}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ action picker (modal)

function ActionPicker({
  title,
  actions,
  disabled,
  onSelect,
  onCancel
}: {
  title: string;
  actions: PaletteAction[];
  disabled: boolean;
  onSelect: (action: ActionName) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((i) => (i + 1) % actions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((i) => (i - 1 + actions.length) % actions.length);
      } else if (event.key === 'Enter' && !disabled) {
        event.preventDefault();
        onSelect(actions[index].action);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [actions, index, disabled, onSelect]);

  // Esc / click outside are handled by the Modal (→ onCancel removes the trigger text).
  return (
    <Modal open title={title} onClose={onCancel}>
      <div className="space-y-1 p-4 md:p-6" role="menu">
        {actions.map((action, i) => (
          <button
            key={action.action}
            type="button"
            role="menuitem"
            disabled={disabled}
            className={`suggestion-dropdown-item${i === index ? ' is-selected' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onClick={() => onSelect(action.action)}
          >
            <div className="suggestion-dropdown-item-label">{action.title}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ item picker

function ItemPicker({
  title,
  ctx,
  command,
  action,
  ownerOnly,
  onPick,
  onCancel,
  onError
}: {
  title: string;
  ctx: EditorContext;
  command: PaletteCommand;
  action: ActionName;
  ownerOnly: boolean;
  onPick: (item: PickerItem) => void;
  onCancel: () => void;
  onError: (error: unknown) => void;
}) {
  const t = useTranslations('group_minutes');
  const adapter = ENTITY_ADAPTERS[command.name];
  const [items, setItems] = useState<PickerItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const loadNext = useCallback(
    async (next: number) => {
      setLoading(true);
      try {
        const result = await adapter.list(ctx, next);
        setItems((prev) => (next === 1 ? result.items : [...prev, ...result.items]));
        setHasMore(result.hasMore);
        setPage(next);
      } catch (error) {
        onError(error);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, ctx]
  );

  useEffect(() => {
    void loadNext(1);
  }, [loadNext]);

  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (ownerOnly && item.isOwner !== true) return false;
    // A record never references itself.
    if (action === 'reference' && ctx.owner && ctx.owner.type === item.type && ctx.owner.id === item.id) return false;
    return !q || item.label.toLowerCase().includes(q) || (item.subtitle ?? '').toLowerCase().includes(q);
  });

  return (
    <Modal open title={title} onClose={onCancel}>
      <div className="space-y-3 p-4 md:p-6">
        <Input
          autoFocus
          value={query}
          placeholder={t('editor.flow.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {visible.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              className="suggestion-dropdown-item"
              onClick={() => onPick(item)}
            >
              <div className="suggestion-dropdown-item-label">{item.label}</div>
              {item.subtitle && <div className="suggestion-dropdown-item-sub">{item.subtitle}</div>}
            </button>
          ))}
          {!loading && visible.length === 0 && (
            <div className="suggestion-dropdown-empty">{t('editor.flow.no_items')}</div>
          )}
          {loading && <div className="suggestion-dropdown-empty">{t('editor.flow.loading')}</div>}
        </div>
        {hasMore && !loading && (
          <Button variant="secondary" size="sm" onClick={() => void loadNext(page + 1)}>
            {t('editor.flow.load_more')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
