import { Markdown } from './Markdown.js';

interface StreamingTextProps {
  content: string;
}

export function StreamingText({ content }: StreamingTextProps) {
  return (
    <div className="relative">
      <Markdown content={content} />
      <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
    </div>
  );
}
