import apiClient from './client';
import type {FileListItem, FileScope} from './files';

export interface FolderListEntry {
  id: string;
  name: string;
  scope: FileScope;
  created_at: string;
  is_owner: boolean;
  is_starred: boolean;
}

export interface FolderCreatePayload {
  name: string;
  scope?: FileScope;
  group_id?: string | null;
  parent_folder_id?: string | null;
}

export interface FolderCreateResponse {
  folder_id: string;
  name: string;
  scope: FileScope;
  parent_folder_id: string | null;
  created_at: string;
}

export const createFolder = (data: FolderCreatePayload) =>
  apiClient.post<FolderCreateResponse>('/v1/folders/create', {scope: 'private', ...data});

export const renameFolder = (folder_id: string, name: string) =>
  apiClient.post<{folder_id: string; name: string}>('/v1/folders/rename', {folder_id, name});

export const moveFolder = (folder_id: string, new_parent_folder_id?: string | null) =>
  apiClient.post<{folder_id: string; parent_folder_id: string | null}>('/v1/folders/move', {
    folder_id,
    new_parent_folder_id,
  });

export interface FolderMetadataResponse {
  folder_id: string;
  name: string;
  scope: FileScope;
  is_owner: boolean;
  parent_folder_id: string | null;
  created_at: string;
  is_starred: boolean;
}

export const getFolderMetadata = (folder_id: string) =>
  apiClient.post<FolderMetadataResponse>('/v1/folders/metadata', {folder_id});

export interface FolderListPayload {
  folder_id?: string | null;
  scope?: FileScope;
  group_id?: string | null;
  offset?: number;
  limit?: number;
}

export interface FolderListResponse {
  folder_id: string | null;
  subfolders: FolderListEntry[];
  files: FileListItem[];
  subfolder_total: number;
  file_total: number;
  offset: number;
  limit: number;
}

export const listFolder = (params: FolderListPayload = {}) =>
  apiClient.post<FolderListResponse>('/v1/folders/list', {scope: 'private', offset: 0, limit: 20, ...params});

export const deleteFolder = (folder_id: string) =>
  apiClient.post<{folder_id: string; message: string}>('/v1/folders/delete', {folder_id});

export interface FolderInTrashOut {
  id: string;
  name: string;
  scope: FileScope;
  deleted_at: string | null;
  created_at: string | null;
}

export const getFolderTrash = (offset = 0, limit = 20) =>
  apiClient.get<{items: FolderInTrashOut[]; total: number; offset: number; limit: number}>('/v1/folders/trash', {
    params: {offset, limit},
  });

export const restoreFolder = (folder_id: string) =>
  apiClient.post<{folder_id: string; name: string; deleted_at: null}>('/v1/folders/restore', {folder_id});

export const permanentDeleteFolder = (folder_id: string) =>
  apiClient.post<{status: string; folder_id: string}>('/v1/folders/permanent-delete', {folder_id});

export const getFolderAuditLog = (folder_id: string, offset = 0, limit = 20) =>
  apiClient.post<{
    items: Array<{
      id: string;
      folder_id: string | null;
      user_id: string;
      action: string;
      ip_address: string | null;
      timestamp: string;
      metadata: Array<{key: string; value: string | null}>;
    }>;
    total: number;
    offset: number;
    limit: number;
  }>('/v1/folders/audit/log', {folder_id, offset, limit});

export interface FolderShareFlags {
  can_view?: boolean;
  can_download?: boolean;
  can_upload?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_share?: boolean;
  expiration_date?: string | null;
}

export interface FolderUserShareEntry {
  user_id: string;
  user_name: string;
  can_view: boolean;
  can_download: boolean;
  can_upload: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
  shared_at: string;
  expiration_date: string | null;
}

export const shareFolderWithUser = (folder_id: string, target_user_id: string, flags: FolderShareFlags = {}) =>
  apiClient.post<FolderUserShareEntry>('/v1/folders/share/user', {folder_id, target_user_id, ...flags});

export const revokeFolderUserShare = (folder_id: string, target_user_id: string) =>
  apiClient.post<{status: string; folder_id: string; target_user_id: string}>(
    '/v1/folders/share/user/revoke',
    {folder_id, target_user_id}
  );

export const listFolderUserShares = (folder_id: string) =>
  apiClient.post<{folder_id: string; users: FolderUserShareEntry[]}>('/v1/folders/share/user/list', {folder_id});

export interface FolderGroupShareEntry {
  group_id: string;
  group_name: string;
  shared_with_count: number;
  shared_at: string;
  expiration_date: string | null;
}

export const shareFolderWithGroup = (folder_id: string, group_id: string, flags: FolderShareFlags = {}) =>
  apiClient.post<FolderGroupShareEntry>('/v1/folders/share/group', {folder_id, group_id, ...flags});

export const revokeFolderGroupShare = (folder_id: string, group_id: string) =>
  apiClient.post<{status: string; folder_id: string; group_id: string}>(
    '/v1/folders/share/group/revoke',
    {folder_id, group_id}
  );

export const listFolderGroupShares = (folder_id: string) =>
  apiClient.post<{folder_id: string; groups: FolderGroupShareEntry[]}>('/v1/folders/share/group/list', {folder_id});

export interface FolderStarResponse {
  status: 'starred' | 'unstarred';
  folder_id: string;
  is_starred: boolean;
}

export const starFolder = (folder_id: string) =>
  apiClient.post<FolderStarResponse>('/v1/folders/star', {folder_id});

export const unstarFolder = (folder_id: string) =>
  apiClient.post<FolderStarResponse>('/v1/folders/unstar', {folder_id});
