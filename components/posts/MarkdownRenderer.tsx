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
    return <p className={`text-sm text-slate-400 ${className}`}>-</p>;
  }

  const sanitizeSchema = {
    ...defaultSchema,
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
          a: ({node: _node, ...props}) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 underline decoration-cyan-600/60 underline-offset-2"
            />
          ),
          input: ({node: _node, type, checked, ...props}) => {
            if (type === 'checkbox') {
              return (
                <input
                  {...props}
                  type="checkbox"
                  defaultChecked={Boolean(checked)}
                  disabled={false}
                  className="cursor-pointer accent-cyan-400"
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
