"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";

interface MarkdownRendererProps {
  content: string;
}

/** 도움말 Markdown 렌더러 — GFM(표/코드/링크) + 제한적 raw HTML(img width 등) + 헤딩 id(딥링크용) */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="help-md max-w-none text-sm leading-relaxed text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug]}
        components={{
          h1: ({ id, children }) => <h1 id={id} className="mb-3 mt-1 scroll-mt-4 text-lg font-bold text-text">{children}</h1>,
          h2: ({ id, children }) => <h2 id={id} className="mb-2 mt-5 scroll-mt-4 border-b border-border pb-1 text-base font-semibold text-text">{children}</h2>,
          h3: ({ id, children }) => <h3 id={id} className="mb-1.5 mt-4 scroll-mt-4 text-sm font-semibold text-text">{children}</h3>,
          p: ({ children }) => <p className="my-2 text-text">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-text">{children}</li>,
          a: ({ href, children }) => <a href={href} className="text-primary underline hover:opacity-80">{children}</a>,
          code: ({ children }) => <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-primary">{children}</code>,
          pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[12px] text-slate-100">{children}</pre>,
          table: ({ children }) => <table className="my-3 w-full border-collapse text-[13px]">{children}</table>,
          th: ({ children }) => <th className="border border-border bg-surface px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} {...props} className="my-2 max-w-full rounded-lg border border-border" />
          ),
          blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-primary/40 bg-surface/60 px-3 py-1.5 text-text-muted">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
