import type {MinutesImportAgendaItemProposal} from './types';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text (as `import/analyze` returns it) → minimal HTML: one `<p>` per paragraph, single newlines as `<br>`. */
export function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Rich text editor HTML → plain text (paragraphs separated by a blank line). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Analyze answer → review state: the plain `content` becomes editable HTML. */
export function proposalAgendaToEditable(items: MinutesImportAgendaItemProposal[]): MinutesImportAgendaItemProposal[] {
  return items.map((item) => ({
    ...item,
    content_html: item.content_html ?? plainTextToHtml(item.content ?? '')
  }));
}

/**
 * Review state → `import/confirm` items. The server reads `content` (plain text) and does the HTML wrapping and
 * sanitizing itself; `content_html` rides along so an edited rich text (mentions, chips) is not lost on servers
 * that accept it.
 */
export function buildImportAgendaPayload(items: MinutesImportAgendaItemProposal[]) {
  return items.map((item) => {
    const html = item.content_html ?? '';
    return {title: item.title, content: htmlToPlainText(html), content_html: html || undefined};
  });
}
