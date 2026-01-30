import { memo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownProps {
  content: string;
}

function CodeBlock({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const isInline = !className;
  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[0.85em] font-mono"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <code className={`${className ?? ''} text-[0.85em]`} {...props}>
      {children}
    </code>
  );
}

export const Markdown = memo(function Markdown({ content }: MarkdownProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-p:my-2 prose-p:leading-relaxed
      prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold
      prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
      prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
      prose-pre:my-3 prose-pre:rounded-lg prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-pre:p-4
      prose-code:before:content-none prose-code:after:content-none
      prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-zinc-700 prose-blockquote:text-zinc-400
      prose-strong:text-zinc-100
      prose-table:text-sm prose-th:text-zinc-300 prose-td:text-zinc-400
      prose-hr:border-zinc-800
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ code: CodeBlock }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
