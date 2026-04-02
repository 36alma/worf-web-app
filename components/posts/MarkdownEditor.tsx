'use client';

import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Separator from '@radix-ui/react-separator';
import * as Toolbar from '@radix-ui/react-toolbar';
import * as Tooltip from '@radix-ui/react-tooltip';
import {Extension} from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import {EditorContent, useEditor} from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  CheckCircle2,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Strikethrough,
  Table2,
  ToggleLeft,
  Trash2
} from 'lucide-react';
import {ComponentType, ReactNode, useEffect, useMemo, useRef, useState} from 'react';

type ToolbarGroupKey = 'text' | 'heading' | 'align' | 'block' | 'insert';
type ToolbarAction =
  | 'paragraph'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'heading1'
  | 'heading2'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock'
  | 'horizontalRule'
  | 'link'
  | 'image';

interface EditorToolbarLabels {
  paragraph: string;
  bold: string;
  italic: string;
  strikethrough: string;
  heading1: string;
  heading2: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  blockquote: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  codeBlock: string;
  horizontalRule: string;
  link: string;
  image: string;
  table: string;
}

interface EditorTableLabels {
  insertTable: string;
  selectSize: string;
  addRowBefore: string;
  addRowAfter: string;
  deleteRow: string;
  addColumnBefore: string;
  addColumnAfter: string;
  deleteColumn: string;
  mergeCells: string;
  splitCell: string;
  toggleHeader: string;
  deleteTable: string;
  addRow: string;
  addColumn: string;
  rowOperations: string;
  columnOperations: string;
  cellOperations: string;
}

export interface MarkdownEditorI18n {
  toolbar: EditorToolbarLabels;
  prompts: {
    linkUrl: string;
    imageUrl: string;
  };
  autosave: {
    saving: string;
    saved: string;
    atSuffix: string;
  };
  table: EditorTableLabels;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  i18n: MarkdownEditorI18n;
}

interface ToolbarItem {
  action: ToolbarAction;
  labelKey: keyof EditorToolbarLabels;
  group: ToolbarGroupKey;
  icon: ComponentType<{size?: string | number; strokeWidth?: string | number}>;
}

const toolbarItems: ToolbarItem[] = [
  {action: 'paragraph', labelKey: 'paragraph', group: 'text', icon: Pilcrow},
  {action: 'bold', labelKey: 'bold', group: 'text', icon: Bold},
  {action: 'italic', labelKey: 'italic', group: 'text', icon: Italic},
  {action: 'strikethrough', labelKey: 'strikethrough', group: 'text', icon: Strikethrough},
  {action: 'heading1', labelKey: 'heading1', group: 'heading', icon: Heading1},
  {action: 'heading2', labelKey: 'heading2', group: 'heading', icon: Heading2},
  {action: 'alignLeft', labelKey: 'alignLeft', group: 'align', icon: AlignLeft},
  {action: 'alignCenter', labelKey: 'alignCenter', group: 'align', icon: AlignCenter},
  {action: 'alignRight', labelKey: 'alignRight', group: 'align', icon: AlignRight},
  {action: 'blockquote', labelKey: 'blockquote', group: 'block', icon: Quote},
  {action: 'bulletList', labelKey: 'bulletList', group: 'block', icon: List},
  {action: 'orderedList', labelKey: 'orderedList', group: 'block', icon: ListOrdered},
  {action: 'taskList', labelKey: 'taskList', group: 'block', icon: ListChecks},
  {action: 'codeBlock', labelKey: 'codeBlock', group: 'insert', icon: Code},
  {action: 'horizontalRule', labelKey: 'horizontalRule', group: 'insert', icon: Minus},
  {action: 'link', labelKey: 'link', group: 'insert', icon: Link2},
  {action: 'image', labelKey: 'image', group: 'insert', icon: ImagePlus}
];

const toolbarGroups: ToolbarGroupKey[] = ['text', 'heading', 'align', 'block', 'insert'];

const TableKeyboardShortcuts = Extension.create({
  name: 'tableKeyboardShortcuts',
  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': () => this.editor.isActive('table') && this.editor.chain().focus().addRowBefore().run(),
      'Alt-ArrowDown': () => this.editor.isActive('table') && this.editor.chain().focus().addRowAfter().run(),
      'Alt-ArrowLeft': () => this.editor.isActive('table') && this.editor.chain().focus().addColumnBefore().run(),
      'Alt-ArrowRight': () => this.editor.isActive('table') && this.editor.chain().focus().addColumnAfter().run(),
      'Alt-Backspace': () => this.editor.isActive('table') && this.editor.chain().focus().deleteRow().run(),
      'Alt-Shift-Backspace': () => this.editor.isActive('table') && this.editor.chain().focus().deleteColumn().run(),
      Tab: () => this.editor.isActive('table') && this.editor.chain().focus().goToNextCell().run(),
      'Shift-Tab': () => this.editor.isActive('table') && this.editor.chain().focus().goToPreviousCell().run()
    };
  }
});

function TableInsertButton({editor, i18n}: {editor: ReturnType<typeof useEditor>; i18n: MarkdownEditorI18n}) {
  const [open, setOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(0);
  const [hoveredCol, setHoveredCol] = useState(0);
  const maxRows = 8;
  const maxCols = 8;

  if (!editor) {
    return null;
  }

  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({rows, cols, withHeaderRow: true}).run();
    setOpen(false);
    setHoveredRow(0);
    setHoveredCol(0);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="toolbar-btn inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] data-[active=true]:border-[var(--accent-border)] data-[active=true]:bg-[var(--accent-subtle)] data-[active=true]:text-[var(--accent)]"
          aria-label={i18n.toolbar.table}
          data-active={editor.isActive('table')}
        >
          <Table2 size={16} strokeWidth={1.75} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="start" className="table-insert-popover">
          <div className="table-insert-header">
            <span className="table-insert-title">{i18n.table.insertTable}</span>
            <span className="table-insert-size">
              {hoveredRow > 0 && hoveredCol > 0 ? `${hoveredRow} × ${hoveredCol}` : i18n.table.selectSize}
            </span>
          </div>
          <div className="table-insert-grid">
            {Array.from({length: maxRows}, (_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="table-insert-grid-row">
                {Array.from({length: maxCols}, (_, colIndex) => (
                  <button
                    key={`cell-${rowIndex}-${colIndex}`}
                    type="button"
                    className={`table-insert-cell ${rowIndex < hoveredRow && colIndex < hoveredCol ? 'highlighted' : ''}`}
                    onMouseEnter={() => {
                      setHoveredRow(rowIndex + 1);
                      setHoveredCol(colIndex + 1);
                    }}
                    onMouseLeave={() => {
                      setHoveredRow(0);
                      setHoveredCol(0);
                    }}
                    onClick={() => insertTable(rowIndex + 1, colIndex + 1)}
                    aria-label={`${rowIndex + 1} x ${colIndex + 1}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <Popover.Arrow className="popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function runToolbarAction(editor: NonNullable<ReturnType<typeof useEditor>>, action: ToolbarAction, i18n: MarkdownEditorI18n) {
  if (action === 'paragraph') {
    editor.chain().focus().setParagraph().run();
  } else if (action === 'bold') {
    editor.chain().focus().toggleBold().run();
  } else if (action === 'italic') {
    editor.chain().focus().toggleItalic().run();
  } else if (action === 'strikethrough') {
    editor.chain().focus().toggleStrike().run();
  } else if (action === 'heading1') {
    editor.chain().focus().toggleHeading({level: 1}).run();
  } else if (action === 'heading2') {
    editor.chain().focus().toggleHeading({level: 2}).run();
  } else if (action === 'alignLeft') {
    editor.chain().focus().setTextAlign('left').run();
  } else if (action === 'alignCenter') {
    editor.chain().focus().setTextAlign('center').run();
  } else if (action === 'alignRight') {
    editor.chain().focus().setTextAlign('right').run();
  } else if (action === 'blockquote') {
    editor.chain().focus().toggleBlockquote().run();
  } else if (action === 'bulletList') {
    editor.chain().focus().toggleBulletList().run();
  } else if (action === 'orderedList') {
    editor.chain().focus().toggleOrderedList().run();
  } else if (action === 'taskList') {
    editor.chain().focus().toggleTaskList().run();
  } else if (action === 'codeBlock') {
    editor.chain().focus().toggleCodeBlock().run();
  } else if (action === 'horizontalRule') {
    editor.chain().focus().setHorizontalRule().run();
  } else if (action === 'link') {
    const current = editor.getAttributes('link').href ?? '';
    const url = window.prompt(i18n.prompts.linkUrl, current || 'https://');
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({href: url, target: '_blank'}).run();
  } else if (action === 'image') {
    const url = window.prompt(i18n.prompts.imageUrl, 'https://');
    if (url) {
      editor.chain().focus().setImage({src: url, alt: 'image'}).run();
    }
  }
}

function isActionActive(editor: NonNullable<ReturnType<typeof useEditor>>, action: ToolbarAction): boolean {
  if (action === 'paragraph') {
    return editor.isActive('paragraph');
  }
  if (action === 'bold') {
    return editor.isActive('bold');
  }
  if (action === 'italic') {
    return editor.isActive('italic');
  }
  if (action === 'strikethrough') {
    return editor.isActive('strike');
  }
  if (action === 'heading1') {
    return editor.isActive('heading', {level: 1});
  }
  if (action === 'heading2') {
    return editor.isActive('heading', {level: 2});
  }
  if (action === 'alignLeft') {
    return editor.isActive({textAlign: 'left'});
  }
  if (action === 'alignCenter') {
    return editor.isActive({textAlign: 'center'});
  }
  if (action === 'alignRight') {
    return editor.isActive({textAlign: 'right'});
  }
  if (action === 'blockquote') {
    return editor.isActive('blockquote');
  }
  if (action === 'bulletList') {
    return editor.isActive('bulletList');
  }
  if (action === 'orderedList') {
    return editor.isActive('orderedList');
  }
  if (action === 'taskList') {
    return editor.isActive('taskList');
  }
  if (action === 'codeBlock') {
    return editor.isActive('codeBlock');
  }
  if (action === 'horizontalRule') {
    return false;
  }
  if (action === 'link') {
    return editor.isActive('link');
  }
  if (action === 'image') {
    return editor.isActive('image');
  }
  return false;
}

function TableFloatingToolbar({editor, i18n}: {editor: NonNullable<ReturnType<typeof useEditor>>; i18n: MarkdownEditorI18n}) {
  if (!editor.isActive('table')) {
    return null;
  }

  type TableControl =
    | {separator: true}
    | {
        key: string;
        label: string;
        icon: ComponentType<{size?: string | number; strokeWidth?: string | number}>;
        action: () => boolean;
        can: boolean;
        danger?: boolean;
      };

  const controls: TableControl[] = [
    {key: 'addRowBefore', label: i18n.table.addRowBefore, icon: ArrowUp, action: () => editor.chain().focus().addRowBefore().run(), can: editor.can().chain().focus().addRowBefore().run()},
    {key: 'addRowAfter', label: i18n.table.addRowAfter, icon: ArrowDown, action: () => editor.chain().focus().addRowAfter().run(), can: editor.can().chain().focus().addRowAfter().run()},
    {key: 'deleteRow', label: i18n.table.deleteRow, icon: Minus, action: () => editor.chain().focus().deleteRow().run(), can: editor.can().chain().focus().deleteRow().run(), danger: true},
    {separator: true},
    {key: 'addColumnBefore', label: i18n.table.addColumnBefore, icon: ArrowLeft, action: () => editor.chain().focus().addColumnBefore().run(), can: editor.can().chain().focus().addColumnBefore().run()},
    {key: 'addColumnAfter', label: i18n.table.addColumnAfter, icon: ArrowRight, action: () => editor.chain().focus().addColumnAfter().run(), can: editor.can().chain().focus().addColumnAfter().run()},
    {key: 'deleteColumn', label: i18n.table.deleteColumn, icon: Minus, action: () => editor.chain().focus().deleteColumn().run(), can: editor.can().chain().focus().deleteColumn().run(), danger: true},
    {separator: true},
    {key: 'mergeCells', label: i18n.table.mergeCells, icon: Maximize2, action: () => editor.chain().focus().mergeCells().run(), can: editor.can().chain().focus().mergeCells().run()},
    {key: 'splitCell', label: i18n.table.splitCell, icon: Minimize2, action: () => editor.chain().focus().splitCell().run(), can: editor.can().chain().focus().splitCell().run()},
    {key: 'toggleHeader', label: i18n.table.toggleHeader, icon: ToggleLeft, action: () => editor.chain().focus().toggleHeaderRow().run(), can: editor.can().chain().focus().toggleHeaderRow().run()},
    {separator: true},
    {key: 'deleteTable', label: i18n.table.deleteTable, icon: Trash2, action: () => editor.chain().focus().deleteTable().run(), can: editor.can().chain().focus().deleteTable().run(), danger: true}
  ];

  return (
    <div className="table-floating-toolbar">
      <Toolbar.Root className="table-toolbar-root">
        <Tooltip.Provider delayDuration={200}>
          {controls.map((item, index) => {
            if ('separator' in item) {
              return <Separator.Root key={`sep-${index}`} className="table-toolbar-separator" orientation="vertical" />;
            }

            const Icon = item.icon;
            return (
              <Tooltip.Root key={item.key}>
                <Tooltip.Trigger asChild>
                  <Toolbar.Button
                    type="button"
                    className={`table-toolbar-btn ${item.danger ? 'danger' : ''}`}
                    onClick={item.action}
                    disabled={!item.can}
                    aria-label={item.label}
                  >
                    <Icon size={14} strokeWidth={1.75} />
                  </Toolbar.Button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="tooltip-content" sideOffset={6}>
                    {item.label}
                    <Tooltip.Arrow className="tooltip-arrow" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </Tooltip.Provider>
      </Toolbar.Root>
    </div>
  );
}

function TableContextMenu({
  editor,
  i18n,
  children
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  i18n: MarkdownEditorI18n;
  children: ReactNode;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu-content">
          {editor.isActive('table') && (
            <>
              <ContextMenu.Label className="context-menu-label">{i18n.table.rowOperations}</ContextMenu.Label>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().addRowBefore().run()} disabled={!editor.can().chain().focus().addRowBefore().run()}>
                <ArrowUp size={14} strokeWidth={1.75} />
                <span>{i18n.table.addRowBefore}</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().chain().focus().addRowAfter().run()}>
                <ArrowDown size={14} strokeWidth={1.75} />
                <span>{i18n.table.addRowAfter}</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="context-menu-item danger" onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().chain().focus().deleteRow().run()}>
                <Minus size={14} strokeWidth={1.75} />
                <span>{i18n.table.deleteRow}</span>
              </ContextMenu.Item>
              <ContextMenu.Separator className="context-menu-separator" />

              <ContextMenu.Label className="context-menu-label">{i18n.table.columnOperations}</ContextMenu.Label>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().addColumnBefore().run()} disabled={!editor.can().chain().focus().addColumnBefore().run()}>
                <ArrowLeft size={14} strokeWidth={1.75} />
                <span>{i18n.table.addColumnBefore}</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().chain().focus().addColumnAfter().run()}>
                <ArrowRight size={14} strokeWidth={1.75} />
                <span>{i18n.table.addColumnAfter}</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="context-menu-item danger" onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().chain().focus().deleteColumn().run()}>
                <Minus size={14} strokeWidth={1.75} />
                <span>{i18n.table.deleteColumn}</span>
              </ContextMenu.Item>
              <ContextMenu.Separator className="context-menu-separator" />

              <ContextMenu.Label className="context-menu-label">{i18n.table.cellOperations}</ContextMenu.Label>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().mergeCells().run()} disabled={!editor.can().chain().focus().mergeCells().run()}>
                <Maximize2 size={14} strokeWidth={1.75} />
                <span>{i18n.table.mergeCells}</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().splitCell().run()} disabled={!editor.can().chain().focus().splitCell().run()}>
                <Minimize2 size={14} strokeWidth={1.75} />
                <span>{i18n.table.splitCell}</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="context-menu-item" onClick={() => editor.chain().focus().toggleHeaderRow().run()} disabled={!editor.can().chain().focus().toggleHeaderRow().run()}>
                <ToggleLeft size={14} strokeWidth={1.75} />
                <span>{i18n.table.toggleHeader}</span>
              </ContextMenu.Item>
              <ContextMenu.Separator className="context-menu-separator" />

              <ContextMenu.Item className="context-menu-item danger" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().chain().focus().deleteTable().run()}>
                <Trash2 size={14} strokeWidth={1.75} />
                <span>{i18n.table.deleteTable}</span>
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export default function MarkdownEditor({value, onChange, placeholder = '', rows = 14, i18n}: MarkdownEditorProps) {
  const minHeight = useMemo(() => Math.max(400, rows * 22), [rows]);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [savedAt, setSavedAt] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({placeholder}),
      Link.configure({
        autolink: true,
        openOnClick: false,
        defaultProtocol: 'https'
      }),
      Image.configure({allowBase64: true}),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      TaskList,
      TaskItem.configure({nested: true}),
      Table.configure({
        resizable: true,
        handleWidth: 5,
        cellMinWidth: 80,
        lastColumnResizable: false,
        allowTableNodeSelection: true,
        HTMLAttributes: {class: 'editor-table'}
      }),
      TableRow.configure({
        HTMLAttributes: {class: 'editor-table-row'}
      }),
      TableHeader.configure({
        HTMLAttributes: {class: 'editor-table-header'}
      }),
      TableCell.configure({
        HTMLAttributes: {class: 'editor-table-cell'}
      }),
      TableKeyboardShortcuts
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor'
      }
    },
    onUpdate: ({editor: currentEditor}) => {
      onChange(currentEditor.getHTML());
      setSaveState('saving');
      const next = new Date();
      const time = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        setSaveState('saved');
        setSavedAt(time);
      }, 220);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (editor.isFocused) {
      return;
    }
    const current = editor.getHTML();
    if (current !== (value || '')) {
      editor.commands.setContent(value || '', {emitUpdate: false});
    }
  }, [editor, value]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Tooltip.Provider delayDuration={220}>
        <div className="editor-container overflow-hidden rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-input)]">
          <div className="editor-toolbar flex flex-wrap items-center gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
            {toolbarGroups.map((group, groupIndex) => (
              <div key={group} className="flex items-center gap-1">
                {toolbarItems
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    const label = i18n.toolbar[item.labelKey];
                    const active = isActionActive(editor, item.action);
                    return (
                      <Tooltip.Root key={item.action}>
                        <Tooltip.Trigger asChild>
                          <button
                            type="button"
                            className="toolbar-btn inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] data-[active=true]:border-[var(--accent-border)] data-[active=true]:bg-[var(--accent-subtle)] data-[active=true]:text-[var(--accent)]"
                            aria-label={label}
                            data-active={active}
                            onClick={() => runToolbarAction(editor, item.action, i18n)}
                          >
                            <Icon size={16} strokeWidth={1.75} />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content sideOffset={6} className="tooltip-content rounded-[6px] bg-[var(--bg-active)] px-2 py-1 text-xs font-medium text-[var(--text-primary)]">
                            {label}
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    );
                  })}
                {groupIndex < toolbarGroups.length - 1 && (
                  <Separator.Root orientation="vertical" className="toolbar-separator mx-2 h-5 w-px bg-[var(--border-subtle)]" />
                )}
              </div>
            ))}
            <Separator.Root orientation="vertical" className="toolbar-separator mx-2 h-5 w-px bg-[var(--border-subtle)]" />
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div>
                  <TableInsertButton editor={editor} i18n={i18n} />
                </div>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content sideOffset={6} className="tooltip-content rounded-[6px] bg-[var(--bg-active)] px-2 py-1 text-xs font-medium text-[var(--text-primary)]">
                  {i18n.toolbar.table}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          <TableFloatingToolbar editor={editor} i18n={i18n} />

          <TableContextMenu editor={editor} i18n={i18n}>
            <div className="table-controls-wrapper relative">
              <EditorContent editor={editor} className="editor-content px-6 py-6" style={{minHeight}} />

              {editor.isActive('table') && (
                <>
                  <button
                    type="button"
                    className="table-add-row-btn"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    aria-label={i18n.table.addRow}
                  >
                    <Plus size={14} strokeWidth={1.75} />
                    <span>{i18n.table.addRow}</span>
                  </button>
                  <button
                    type="button"
                    className="table-add-col-btn"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    aria-label={i18n.table.addColumn}
                  >
                    <Plus size={14} strokeWidth={1.75} />
                    <ChevronDown size={14} strokeWidth={1.75} className="rotate-[-90deg]" />
                  </button>
                </>
              )}
            </div>
          </TableContextMenu>
        </div>
      </Tooltip.Provider>

      <div className="flex justify-end">
        <span className="autosave-indicator inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--success)]">
          <CheckCircle2 size={14} strokeWidth={1.75} />
          {saveState === 'saving'
            ? i18n.autosave.saving
            : `${i18n.autosave.saved}${savedAt ? ` ${savedAt}${i18n.autosave.atSuffix}` : ''}`}
        </span>
      </div>
    </div>
  );
}
