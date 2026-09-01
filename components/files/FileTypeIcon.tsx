import { FileSpreadsheet, FileText, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { getFileCategory } from '@/lib/utils/formatFiles';

export interface FileTypeIconProps {
  mimeType: string | null;
  size?: number;
  className?: string;
}

const CATEGORY_ICON = {
  image: ImageIcon,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  other: FileIcon,
} as const;

export default function FileTypeIcon({ mimeType, size = 28, className }: FileTypeIconProps) {
  const Icon = CATEGORY_ICON[getFileCategory(mimeType)];
  return <Icon size={size} strokeWidth={1.5} className={className ?? 'text-[var(--text-tertiary)]'} />;
}
