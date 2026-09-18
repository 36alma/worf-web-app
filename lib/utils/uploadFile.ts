import {startUpload, completeUpload} from '@/lib/api/files';

export interface UploadFileOptions {
  scope: 'private' | 'group';
  groupId?: string;
  folderId?: string | null;
}

/**
 * Single-file upload helper for flows that need the resulting file_id
 * synchronously (e.g. immediately linking it to a record) rather than
 * queued/progress-tracked uploads — see hooks/useUploadQueue.ts for the
 * batch/progress-tracked equivalent this mirrors.
 */
export async function uploadFile(file: File, options: UploadFileOptions): Promise<string> {
  const startResponse = await startUpload({
    filename: file.name,
    mime_type: file.type,
    scope: options.scope,
    group_id: options.scope === 'group' ? options.groupId : undefined,
    folder_id: options.folderId
  });
  const {upload_id, presigned_post_url, presigned_post_fields, file_id} = startResponse.data;

  const formData = new FormData();
  Object.entries(presigned_post_fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', file);

  const putResponse = await fetch(presigned_post_url, {method: 'POST', body: formData});
  if (!putResponse.ok) {
    throw new Error(`presigned_post_failed_${putResponse.status}`);
  }

  await completeUpload({upload_id, file_id, original_name: file.name});
  return file_id;
}
