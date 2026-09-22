'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function preprocessMarkdown(raw: string): string {
  if (!raw) return '';
  // Normalize newlines
  let text = raw.replace(/\r\n/g, '\n');

  // Ensure horizontal divider --- is cleanly separated
  text = text.replace(/([^\n])\s*---\s*([^\n])/g, '$1\n\n---\n\n$2');

  // Ensure headings have a blank line before them if preceded by text
  text = text.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  return text;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const cleanContent = preprocessMarkdown(content);

  return (
    <div className={`markdown-body text-xs leading-relaxed text-slate-200 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-white mt-4 mb-2 pb-1.5 border-b border-slate-800 flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-indigo-300 mt-3.5 mb-2 flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-slate-100 mt-3 mb-1.5 tracking-wide flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-indigo-200 mt-2.5 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-200">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2 space-y-1.5 text-slate-200 marker:text-indigo-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1.5 text-slate-200 marker:text-indigo-400 marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-300">
              {children}
            </em>
          ),
          hr: () => (
            <hr className="my-3.5 border-t border-slate-750/70" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500 bg-indigo-950/25 pl-3.5 py-1.5 my-2.5 rounded-r-lg text-slate-300 italic text-xs">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code className="bg-slate-900/90 text-indigo-300 border border-slate-750/60 px-1.5 py-0.5 rounded text-[11px] font-mono mx-0.5" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-slate-950/80 text-indigo-200 border border-slate-800/80 p-3.5 rounded-xl my-2.5 overflow-x-auto font-mono text-[11px] leading-relaxed" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2.5 overflow-x-auto rounded-xl bg-transparent">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3.5 rounded-xl border border-slate-800 shadow-sm">
              <table className="w-full text-left text-[11px] border-collapse bg-slate-900/40">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800/80 text-indigo-300 border-b border-slate-700">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2 font-bold text-indigo-300 border-r border-slate-800/60 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 border-b border-slate-800/60 text-slate-200 border-r border-slate-800/40 last:border-r-0">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-400/40 transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}
