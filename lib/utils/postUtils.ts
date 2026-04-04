export interface FormattedExcerpt {
  text: string;
  hasCode: boolean;
  hasImage: boolean;
  wordCount: number;
}

const safeCodePoint = (value: number): string => {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
    return '';
  }

  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, num) => safeCodePoint(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...');

const stripMarkdown = (content: string): string =>
  content
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/`[^`]+`/g, ' [code] ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function stripHtml(html: string): string {
  if (!html) {
    return '';
  }

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, ' [code] ')
    .replace(/<code[^>]*>[\s\S]*?<\/code>/gi, ' [code] ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|div|section|article|blockquote|tr|td|th|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(text: string, maxLength = 150, suffix = '...'): string {
  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return `${truncated.slice(0, lastSpace)}${suffix}`;
  }

  return `${truncated}${suffix}`;
}

export function getPostExcerpt(content: string, maxLength = 150): string {
  if (!content) {
    return '';
  }

  const hasHtml = /<[^>]+>/.test(content);
  const clean = hasHtml ? decodeHtmlEntities(stripHtml(content)) : stripMarkdown(content);

  return truncateText(clean, maxLength);
}

export function getFormattedExcerpt(content: string, maxLength = 150): FormattedExcerpt {
  if (!content) {
    return { text: '', hasCode: false, hasImage: false, wordCount: 0 };
  }

  const hasCode = /<(pre|code)\b/i.test(content) || /```|`[^`]+`/.test(content);
  const hasImage = /<img\b/i.test(content) || /!\[[^\]]*]\([^)]*\)/.test(content);
  const plainText = getPostExcerpt(content, Number.MAX_SAFE_INTEGER);
  const text = truncateText(plainText, maxLength);
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return { text, hasCode, hasImage, wordCount };
}
