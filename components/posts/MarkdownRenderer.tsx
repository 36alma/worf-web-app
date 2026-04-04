import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({content, className = ''}: MarkdownRendererProps) {
  if (!content.trim()) {
    return <p className={`text-sm text-[var(--text-tertiary)] ${className}`}>-</p>;
  }

  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), 'details', 'summary', 'mark', 'sub', 'sup', 'kbd', 'ins', 'del'],
    attributes: {
      ...defaultSchema.attributes,
      table: [...(defaultSchema.attributes?.table || []), 'style'],
      td: [...(defaultSchema.attributes?.td || []), 'align', 'colspan', 'rowspan', 'style'],
      th: [...(defaultSchema.attributes?.th || []), 'align', 'colspan', 'rowspan', 'style'],
      span: [...(defaultSchema.attributes?.span || []), 'style'],
      font: [...(defaultSchema.attributes?.font || []), 'color'],
      code: [...(defaultSchema.attributes?.code || []), 'className'],
      img: [...(defaultSchema.attributes?.img || []), 'src', 'alt', 'title', 'width', 'height'],
      input: [...(defaultSchema.attributes?.input || []), 'type', 'checked', 'disabled']
    }
  };

  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          h1: ({node: _node, ...props}) => <h1 {...props} className="markdown-h1" />,
          h2: ({node: _node, ...props}) => <h2 {...props} className="markdown-h2" />,
          h3: ({node: _node, ...props}) => <h3 {...props} className="markdown-h3" />,
          h4: ({node: _node, ...props}) => <h4 {...props} className="markdown-h4" />,
          h5: ({node: _node, ...props}) => <h5 {...props} className="markdown-h5" />,
          h6: ({node: _node, ...props}) => <h6 {...props} className="markdown-h6" />,
          a: ({node: _node, ...props}) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="markdown-link"
            />
          ),
          p: ({node: _node, ...props}) => <p {...props} className="markdown-paragraph" />,
          blockquote: ({node: _node, ...props}) => <blockquote {...props} className="markdown-blockquote" />,
          ul: ({node: _node, ...props}) => <ul {...props} className="markdown-list markdown-list-unordered" />,
          ol: ({node: _node, ...props}) => <ol {...props} className="markdown-list markdown-list-ordered" />,
          li: ({node: _node, ...props}) => <li {...props} className="markdown-list-item" />,
          hr: ({node: _node, ...props}) => <hr {...props} className="markdown-hr" />,
          table: ({node: _node, ...props}) => (
            <div className="markdown-table-wrap">
              <table {...props} className="markdown-table" />
            </div>
          ),
          th: ({node: _node, ...props}) => <th {...props} className="markdown-th" />,
          td: ({node: _node, ...props}) => <td {...props} className="markdown-td" />,
          pre: ({node: _node, ...props}) => <pre {...props} className="markdown-pre" />,
          code: ({node: _node, className: existingClassName, ...props}) => {
            const isBlock = Boolean(existingClassName?.includes('language-'));
            const className = isBlock ? `markdown-codeblock ${existingClassName}` : `markdown-code ${existingClassName || ''}`.trim();
            return <code {...props} className={className} />;
          },
          img: ({node: _node, ...props}) => <img {...props} loading="lazy" decoding="async" className="markdown-image" />,
          details: ({node: _node, ...props}) => <details {...props} className="markdown-details" />,
          summary: ({node: _node, ...props}) => <summary {...props} className="markdown-summary" />,
          kbd: ({node: _node, ...props}) => <kbd {...props} className="markdown-kbd" />,
          mark: ({node: _node, ...props}) => <mark {...props} className="markdown-mark" />,
          input: ({node: _node, type, checked, ...props}) => {
            if (type === 'checkbox') {
              return (
                <input
                  {...props}
                  type="checkbox"
                  defaultChecked={Boolean(checked)}
                  readOnly
                  disabled
                  className="markdown-checkbox"
                />
              );
            }

            return <input {...props} type={type} />;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
