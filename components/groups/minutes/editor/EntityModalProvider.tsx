'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode
} from 'react';
import type {CommandName} from '@/lib/api/palette';
import type {ChipRef, PickerItem} from './entities';
import {useEditorContext} from './editorContext';
import EventEntityModals from './modals/EventEntityModals';
import FileEntityModals from './modals/FileEntityModals';
import MinutesEntityModals from './modals/MinutesEntityModals';
import PostEntityModals from './modals/PostEntityModals';
import TaskEntityModals from './modals/TaskEntityModals';
import type {EntityHostProps, EntityModalRequest} from './modals/shared';

/** What a chip / `/` command can do with a record — every entity answers with its own modal. */
export interface EntityModalsApi {
  /** Opens the entity's create form. Resolves to the chips it produced (empty if cancelled). */
  create(type: CommandName): Promise<ChipRef[]>;
  /** Opens the entity's edit form. Resolves when it is closed. */
  modify(item: PickerItem): Promise<void>;
  /** Opens the record itself (detail modal / sheet). */
  view(ref: ChipRef): void;
}

const HOSTS: Record<CommandName, ComponentType<EntityHostProps>> = {
  task: TaskEntityModals,
  event: EventEntityModals,
  post: PostEntityModals,
  minutes: MinutesEntityModals,
  file: FileEntityModals
};

const EntityModalsContext = createContext<EntityModalsApi | null>(null);

export function useEntityModals(): EntityModalsApi {
  const api = useContext(EntityModalsContext);
  if (!api) throw new Error('useEntityModals must be used inside <EntityModalProvider>');
  return api;
}

interface ActiveRequest {
  key: number;
  type: CommandName;
  request: EntityModalRequest;
}

export interface EntityModalProviderProps {
  groupId: string;
  /** The minutes being edited — kept out of `/minutes` reference lists. */
  minutesId?: string;
  children: ReactNode;
}

/**
 * Hosts the modals behind the editor's `/` commands and chip clicks, one at a time. Mount it once per
 * page above every `MinutesContentEditor` / rendered minutes content.
 */
export function EntityModalProvider({groupId, minutesId, children}: EntityModalProviderProps) {
  const ctx = useEditorContext(groupId, minutesId);
  const [active, setActive] = useState<ActiveRequest | null>(null);
  const pending = useRef<((chips: ChipRef[]) => void) | null>(null);
  const counter = useRef(0);

  const run = useCallback(
    (type: CommandName, request: EntityModalRequest) =>
      new Promise<ChipRef[]>((resolve) => {
        pending.current?.([]); // a newer request supersedes the open one
        pending.current = resolve;
        setActive({key: ++counter.current, type, request});
      }),
    []
  );

  const finish = useCallback((chips: ChipRef[] = []) => {
    const resolve = pending.current;
    pending.current = null;
    setActive(null);
    resolve?.(chips);
  }, []);

  useEffect(
    () => () => {
      pending.current?.([]);
      pending.current = null;
    },
    []
  );

  const api = useMemo<EntityModalsApi>(
    () => ({
      create: (type) => run(type, {mode: 'create'}),
      modify: async (item) => {
        await run(item.type, {mode: 'modify', item});
      },
      view: (ref) => {
        void run(ref.type, {mode: 'view', ref});
      }
    }),
    [run]
  );

  const Host = active ? HOSTS[active.type] : null;

  return (
    <EntityModalsContext.Provider value={api}>
      {children}
      {active && Host && <Host key={active.key} ctx={ctx} request={active.request} onDone={finish} />}
    </EntityModalsContext.Provider>
  );
}
