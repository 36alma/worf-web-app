import apiClient from './client';

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
