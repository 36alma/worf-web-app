import type {MarkdownEditorI18n} from '@/components/posts/MarkdownEditor';

type MinimalTranslator = (key: string) => string;

export function buildMinutesEditorI18n(t: MinimalTranslator): MarkdownEditorI18n {
  return {
    toolbar: {
      paragraph: t('editor.toolbar.paragraph'),
      bold: t('editor.toolbar.bold'),
      italic: t('editor.toolbar.italic'),
      strikethrough: t('editor.toolbar.strikethrough'),
      heading1: t('editor.toolbar.heading1'),
      heading2: t('editor.toolbar.heading2'),
      alignLeft: t('editor.toolbar.alignLeft'),
      alignCenter: t('editor.toolbar.alignCenter'),
      alignRight: t('editor.toolbar.alignRight'),
      blockquote: t('editor.toolbar.blockquote'),
      bulletList: t('editor.toolbar.bulletList'),
      orderedList: t('editor.toolbar.orderedList'),
      taskList: t('editor.toolbar.taskList'),
      codeBlock: t('editor.toolbar.codeBlock'),
      horizontalRule: t('editor.toolbar.horizontalRule'),
      link: t('editor.toolbar.link'),
      image: t('editor.toolbar.image'),
      table: t('editor.toolbar.table')
    },
    prompts: {
      linkUrl: t('editor.prompts.linkUrl'),
      imageUrl: t('editor.prompts.imageUrl')
    },
    autosave: {
      saving: t('editor.autosave.saving'),
      saved: t('editor.autosave.saved'),
      atSuffix: t('editor.autosave.atSuffix')
    },
    table: {
      insertTable: t('editor.table.insertTable'),
      selectSize: t('editor.table.selectSize'),
      addRowBefore: t('editor.table.addRowBefore'),
      addRowAfter: t('editor.table.addRowAfter'),
      deleteRow: t('editor.table.deleteRow'),
      addColumnBefore: t('editor.table.addColumnBefore'),
      addColumnAfter: t('editor.table.addColumnAfter'),
      deleteColumn: t('editor.table.deleteColumn'),
      mergeCells: t('editor.table.mergeCells'),
      splitCell: t('editor.table.splitCell'),
      toggleHeader: t('editor.table.toggleHeader'),
      deleteTable: t('editor.table.deleteTable'),
      addRow: t('editor.table.addRow'),
      addColumn: t('editor.table.addColumn'),
      rowOperations: t('editor.table.rowOperations'),
      columnOperations: t('editor.table.columnOperations'),
      cellOperations: t('editor.table.cellOperations')
    }
  };
}
