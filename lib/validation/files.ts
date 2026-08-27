import {z} from 'zod';
import {filenameSchema} from './schemas';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'text/plain', 'text/csv', 'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const uploadFileSchema = z.object({
  filename: filenameSchema,
  file: z.instanceof(File)
    .refine((f) => f.size <= MAX_FILE_SIZE_BYTES, {message: 'file_too_large'})
    .refine((f) => (ALLOWED_MIME_TYPES as readonly string[]).includes(f.type), {message: 'file_type_forbidden'}),
});
