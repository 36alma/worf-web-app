import { describe, expect, it, beforeEach } from 'vitest';
import { resetForbiddenCache, markForbidden } from '@/lib/permissions/filesGuard';
import { isPreviewable, buildEntryActions, type EntryActionsContext } from '../entryActions';
import type { FileEntry, FolderEntry, FsEntry } from '../entryTypes';

const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  kind: 'file',
  id: 'f1',
  original_name: 'photo.png',
  mime_type: 'image/png',
  size_bytes: 1024,
  scope: 'private',
  uploaded_at: '2026-01-01T00:00:00Z',
  is_owner: true,
  folder_id: null,
  is_starred: false,
  ...overrides,
});

const makeFolder = (overrides: Partial<FolderEntry> = {}): FolderEntry => ({
  kind: 'folder',
  id: 'd1',
  name: 'Documents',
  scope: 'private',
  created_at: '2026-01-01T00:00:00Z',
  is_owner: true,
  is_starred: false,
  ...overrides,
});

describe('isPreviewable', () => {
  it('is true for image files', () => {
    expect(isPreviewable(makeFile({ mime_type: 'image/jpeg' }))).toBe(true);
  });

  it('is false for non-image files', () => {
    expect(isPreviewable(makeFile({ mime_type: 'application/pdf' }))).toBe(false);
  });

  it('is false for files with no mime_type', () => {
    expect(isPreviewable(makeFile({ mime_type: null }))).toBe(false);
  });

  it('is false for folders', () => {
    expect(isPreviewable(makeFolder())).toBe(false);
  });
});

describe('buildEntryActions', () => {
  const noop = () => {};
  const baseContext: EntryActionsContext = {
    t: (key: string) => key,
    onOpenFolder: noop,
    onPreview: noop,
    onDetails: noop,
    onShare: noop,
    onDownload: noop,
    onRename: noop,
    onToggleStar: noop,
    onDelete: noop,
  };

  beforeEach(() => resetForbiddenCache());

  it('includes preview for an image file the user owns', () => {
    const keys = buildEntryActions(makeFile(), baseContext).map((item) => item.key);
    expect(keys).toEqual(['preview', 'details', 'download', 'share', 'rename', 'star', 'delete']);
  });

  it('omits preview for a non-image file', () => {
    const keys = buildEntryActions(makeFile({ mime_type: 'application/pdf' }), baseContext).map((item) => item.key);
    expect(keys).toEqual(['details', 'download', 'share', 'rename', 'star', 'delete']);
  });

  it('omits share for a file the user does not own', () => {
    const keys = buildEntryActions(makeFile({ is_owner: false }), baseContext).map((item) => item.key);
    expect(keys).not.toContain('share');
  });

  it('folders get open + details + share + rename + star + delete, no preview/download', () => {
    const keys = buildEntryActions(makeFolder(), baseContext).map((item) => item.key);
    expect(keys).toEqual(['open', 'details', 'share', 'rename', 'star', 'delete']);
  });

  it('marks download hidden when forbidden', () => {
    markForbidden('file', 'download', 'f1');
    const items = buildEntryActions(makeFile(), baseContext);
    const download = items.find((item) => item.key === 'download');
    expect(download?.hidden).toBe(true);
  });

  it('marks rename hidden when forbidden', () => {
    markForbidden('file', 'edit', 'f1');
    const items = buildEntryActions(makeFile(), baseContext);
    const rename = items.find((item) => item.key === 'rename');
    expect(rename?.hidden).toBe(true);
  });

  it('marks delete hidden when forbidden', () => {
    markForbidden('folder', 'delete', 'd1');
    const items = buildEntryActions(makeFolder(), baseContext);
    const del = items.find((item) => item.key === 'delete');
    expect(del?.hidden).toBe(true);
  });

  it('star label reflects is_starred', () => {
    const starredItem = buildEntryActions(makeFile({ is_starred: true }), { ...baseContext, t: (key) => key }).find((item) => item.key === 'star');
    const unstarredItem = buildEntryActions(makeFile({ is_starred: false }), { ...baseContext, t: (key) => key }).find((item) => item.key === 'star');
    expect(starredItem?.label).toBe('table.unstar');
    expect(unstarredItem?.label).toBe('table.star');
  });

  it('calls the matching context callback with the entry on select', () => {
    let received: FsEntry | null = null;
    const ctx: EntryActionsContext = { ...baseContext, onDelete: (entry) => { received = entry; } };
    const file = makeFile();
    const items = buildEntryActions(file, ctx);
    items.find((item) => item.key === 'delete')?.onSelect();
    expect(received).toBe(file);
  });
});
