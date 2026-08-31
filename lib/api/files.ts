import apiClient from './client';
import type {FolderListEntry} from './folders';

export type FileScope = 'private' | 'group';

export interface UploadStartPayload {
  filename: string;
  mime_type: string;
  scope: FileScope;
  group_id?: string | null;
  folder_id?: string | null;
}

export interface UploadStartResponse {
  upload_id: string;
  presigned_post_url: string;
  presigned_post_fields: Record<string, string>;
  file_id: string;
  expires_in: number;
  folder_id: string | null;
}

export const startUpload = (data: UploadStartPayload) =>
  apiClient.post<UploadStartResponse>('/v1/files/upload/start', data);

export interface UploadCompletePayload {
  upload_id: string;
  file_id: string;
  original_name: string;
}

export interface UploadCompleteResponse {
  file_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export const completeUpload = (data: UploadCompletePayload) =>
  apiClient.post<UploadCompleteResponse>('/v1/files/upload/complete', data);

export interface FileListItem {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  scope: FileScope;
  uploaded_at: string;
  is_owner: boolean;
  folder_id: string | null;
  is_starred: boolean;
}

export interface ListFilesPayload {
  scope?: FileScope;
  group_id?: string | null;
  folder_id?: string | null;
  offset?: number;
  limit?: number;
}

export interface ListFilesResponse {
  items: FileListItem[];
  total: number;
  offset: number;
  limit: number;
}

export const listFiles = (params: ListFilesPayload = {}) =>
  apiClient.post<ListFilesResponse>('/v1/files/list', params);

export interface DownloadRequestResponse {
  download_token: string;
  expires_in: number;
}

export const requestDownload = (file_id: string) =>
  apiClient.post<DownloadRequestResponse>('/v1/files/download/request', {file_id});

export const buildDownloadUrl = (download_token: string) =>
  `/api/files/dl/${encodeURIComponent(download_token)}`;

export interface FileMetadataResponse {
  file_id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  scope: FileScope;
  is_owner: boolean;
  folder_id: string | null;
  thumbnail_status: 'pending' | 'ready' | 'failed' | null;
  width: number | null;
  height: number | null;
  is_starred: boolean;
}

export const getFileMetadata = (file_id: string) =>
  apiClient.post<FileMetadataResponse>('/v1/files/metadata', {file_id});

export const deleteFile = (file_id: string) =>
  apiClient.post<{file_id: string; message: string}>('/v1/files/delete', {file_id});

export const restoreFile = (file_id: string) =>
  apiClient.post<{id: string; original_name: string; deleted_at: null}>('/v1/files/restore', {file_id});

export const permanentDeleteFile = (file_id: string) =>
  apiClient.post<{status: string; file_id: string}>('/v1/files/permanent-delete', {file_id});

export interface FileInTrashOut {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  scope: FileScope;
  deleted_at: string | null;
  uploaded_at: string | null;
}

export interface TrashListResponse {
  items: FileInTrashOut[];
  total: number;
  offset: number;
  limit: number;
}

export const getTrash = (offset = 0, limit = 20) =>
  apiClient.get<TrashListResponse>('/v1/files/trash', {params: {offset, limit}});

export const shareWithGroup = (file_id: string, group_id: string) =>
  apiClient.post<{
    file_id: string;
    group_id: string;
    group_name: string;
    shared_with_count: number;
    shared_at: string;
  }>('/v1/files/share/group', {file_id, group_id});

export const revokeGroupShare = (file_id: string, group_id: string) =>
  apiClient.post<{status: string; file_id: string; group_id: string}>(
    '/v1/files/share/group/revoke',
    {file_id, group_id}
  );

export interface FileGroupShareEntry {
  group_id: string;
  group_name: string;
  shared_at: string;
  expiration_date: string | null;
}

export interface FileShareGroupListResponse {
  file_id: string;
  groups: FileGroupShareEntry[];
}

export const listGroupShares = (file_id: string) =>
  apiClient.post<FileShareGroupListResponse>('/v1/files/share/group/list', {file_id});

export interface ShareFlags {
  can_view?: boolean;
  can_download?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_share?: boolean;
  expiration_date?: string | null;
}

export interface FileUserShareEntry {
  user_id: string;
  user_name: string;
  can_view: boolean;
  can_download: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
  shared_at: string;
  expiration_date: string | null;
}

export const shareWithUser = (file_id: string, target_user_id: string, flags: ShareFlags = {}) =>
  apiClient.post<FileUserShareEntry>('/v1/files/share/user', {file_id, target_user_id, ...flags});

export const revokeUserShare = (file_id: string, target_user_id: string) =>
  apiClient.post<{status: string; file_id: string; target_user_id: string}>(
    '/v1/files/share/user/revoke',
    {file_id, target_user_id}
  );

export const listUserShares = (file_id: string) =>
  apiClient.post<{file_id: string; users: FileUserShareEntry[]}>('/v1/files/share/user/list', {file_id});

export interface FileShareGroupBulkResponse {
  group_id: string;
  succeeded: string[];
  failed: Array<{file_id: string; reason: string}>;
}

export const bulkShareWithGroup = (
  file_ids: string[],
  group_id: string,
  flags: Omit<ShareFlags, 'expiration_date'> & {expiration_date?: string | null} = {}
) =>
  apiClient.post<FileShareGroupBulkResponse>('/v1/files/share/group/bulk', {file_ids, group_id, ...flags});

export type ShareLinkPermission = 'view' | 'download';

export interface ShareLinkCreateResponse {
  link_id: string;
  token: string;
  permission: ShareLinkPermission;
  expires_at: string | null;
  has_password: boolean;
}

export const createShareLink = (
  file_id: string,
  permission: ShareLinkPermission = 'download',
  expires_at?: string | null,
  password?: string | null
) =>
  apiClient.post<ShareLinkCreateResponse>('/v1/files/share/link/create', {
    file_id,
    permission,
    expires_at,
    password,
  });

export const revokeShareLink = (link_id: string) =>
  apiClient.post<{status: string; link_id: string}>('/v1/files/share/link/revoke', {link_id});

export interface ShareLinkEntry {
  link_id: string;
  permission: ShareLinkPermission;
  expires_at: string | null;
  has_password: boolean;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export const listShareLinks = (file_id: string) =>
  apiClient.post<{file_id: string; links: ShareLinkEntry[]}>('/v1/files/share/link/list', {file_id});

export interface AuditMetadataEntry {
  key: string;
  value: string | null;
}

export interface FileAuditLogEntry {
  id: string;
  file_id: string | null;
  user_id: string;
  action: string;
  ip_address: string | null;
  timestamp: string;
  metadata: AuditMetadataEntry[];
}

export interface FileAuditLogResponse {
  items: FileAuditLogEntry[];
  total: number;
  offset: number;
  limit: number;
}

export const getAuditLog = (file_id: string, offset = 0, limit = 20) =>
  apiClient.post<FileAuditLogResponse>('/v1/files/audit/log', {file_id, offset, limit});

export const setUserStorageLimit = (target_id: string, limit_bytes: number | null) =>
  apiClient.post('/v1/files/storage/limit/user', {target_id, limit_bytes, scope: 'user'});

export const setGroupStorageLimit = (target_id: string, limit_bytes: number | null) =>
  apiClient.post('/v1/files/storage/limit/group', {target_id, limit_bytes, scope: 'group'});

export const renameFile = (file_id: string, name: string) =>
  apiClient.post<{file_id: string; original_name: string}>('/v1/files/rename', {file_id, name});

export const moveFile = (file_id: string, target_folder_id?: string | null) =>
  apiClient.post<{file_id: string; folder_id: string | null}>('/v1/files/move', {file_id, target_folder_id});

export interface CopyFileResponse {
  file_id: string;
  original_name: string;
  size_bytes: number;
  folder_id: string | null;
}

export const copyFile = (file_id: string, target_folder_id?: string | null) =>
  apiClient.post<CopyFileResponse>('/v1/files/copy', {file_id, target_folder_id});

export interface StarResponse {
  status: 'starred' | 'unstarred';
  file_id: string;
  is_starred: boolean;
}

export const starFile = (file_id: string) =>
  apiClient.post<StarResponse>('/v1/files/star', {file_id});

export const unstarFile = (file_id: string) =>
  apiClient.post<StarResponse>('/v1/files/unstar', {file_id});

export interface StarredListResponse {
  files: FileListItem[];
  folders: FolderListEntry[];
  file_total: number;
  folder_total: number;
  offset: number;
  limit: number;
}

export const getStarred = (offset = 0, limit = 20) =>
  apiClient.post<StarredListResponse>('/v1/files/starred/list', {offset, limit});

export interface SharedWithMeListResponse {
  files: FileListItem[];
  folders: FolderListEntry[];
  file_total: number;
  folder_total: number;
  offset: number;
  limit: number;
}

export const getSharedWithMe = (offset = 0, limit = 20) =>
  apiClient.post<SharedWithMeListResponse>('/v1/files/shared-with-me/list', {offset, limit});

export interface StorageUsageResponse {
  scope: FileScope;
  target_id: string | null;
  used_bytes: number;
  limit_bytes: number | null;
}

export const getStorageUsage = (scope: FileScope = 'private', group_id?: string | null) =>
  apiClient.post<StorageUsageResponse>('/v1/files/storage/usage', {scope, group_id});
