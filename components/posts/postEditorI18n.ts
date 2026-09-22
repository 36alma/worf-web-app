import type {MarkdownEditorI18n} from './MarkdownEditor';

type EditorTranslator = (key: string) => string;

/** Builds the MarkdownEditor labels from the app-wide `editor` namespace. */
export function buildPostEditorI18n(t: EditorTranslator): MarkdownEditorI18n {
  return {
    toolbar: {
      paragraph: t('toolbar.paragraph'),
      bold: t('toolbar.bold'),
      italic: t('toolbar.italic'),
      strikethrough: t('toolbar.strikethrough'),
      heading1: t('toolbar.heading1'),
      heading2: t('toolbar.heading2'),
      alignLeft: t('toolbar.alignLeft'),
      alignCenter: t('toolbar.alignCenter'),
      alignRight: t('toolbar.alignRight'),
      blockquote: t('toolbar.blockquote'),
      bulletList: t('toolbar.bulletList'),
      orderedList: t('toolbar.orderedList'),
      taskList: t('toolbar.taskList'),
      codeBlock: t('toolbar.codeBlock'),
      horizontalRule: t('toolbar.horizontalRule'),
      link: t('toolbar.link'),
      image: t('toolbar.image'),
      table: t('toolbar.table')
    },
    prompts: {
      linkUrl: t('prompts.link_url'),
      imageUrl: t('prompts.image_url')
    },
    autosave: {
      saving: t('autosave.saving'),
      saved: t('autosave.saved'),
      atSuffix: t('autosave.at_suffix')
    },
    table: {
      insertTable: t('table.insertTable'),
      selectSize: t('table.selectSize'),
      addRowBefore: t('table.addRowBefore'),
      addRowAfter: t('table.addRowAfter'),
      deleteRow: t('table.deleteRow'),
      addColumnBefore: t('table.addColumnBefore'),
      addColumnAfter: t('table.addColumnAfter'),
      deleteColumn: t('table.deleteColumn'),
      mergeCells: t('table.mergeCells'),
      splitCell: t('table.splitCell'),
      toggleHeader: t('table.toggleHeader'),
      deleteTable: t('table.deleteTable'),
      addRow: t('table.addRow'),
      addColumn: t('table.addColumn'),
      rowOperations: t('table.rowOperations'),
      columnOperations: t('table.columnOperations'),
      cellOperations: t('table.cellOperations')
    }
  };
}
