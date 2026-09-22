import apiClient from './client';

/**
 * `/v1/palette/*` only serves the catalog of `/` commands (permission-filtered per group).
 * It never executes anything — create/modify/delete run on the regular REST endpoints
 * (see components/groups/minutes/editor/entities.ts). The Bearer token is injected by /api/proxy.
 */

export type CommandName = 'task' | 'event' | 'post' | 'minutes' | 'file';
export type ActionName = 'create' | 'modify' | 'delete' | 'reference';

export const COMMAND_NAMES: readonly CommandName[] = ['task', 'event', 'post', 'minutes', 'file'];

export const isCommandName = (value: unknown): value is CommandName =>
  typeof value === 'string' && (COMMAND_NAMES as readonly string[]).includes(value);

export interface PaletteAction {
  action: ActionName;
  title: string;
}

export interface PaletteCommand {
  name: CommandName;
  title: string;
  description: string;
  actions: PaletteAction[];
}

export const listPaletteCommands = (group_id: string) =>
  apiClient.post<{commands?: PaletteCommand[]}>('/v1/palette/list-commands', {group_id});
