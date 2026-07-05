/**
 * @file src/modules/ai-knowledge/markdown-chunker.ts
 * @description 도움말/설계문서 markdown을 RAG 검색용 chunk로 분리한다.
 */
import * as crypto from 'crypto';
import * as path from 'path';

export interface KnowledgeChunkInput {
  sourcePath: string;
  docType: string;
  language?: string;
  raw: string;
}

export interface KnowledgeChunk {
  chunkId: string;
  docType: string;
  sourcePath: string;
  sourceHash: string;
  language: string;
  menuCode?: string;
  audience?: string;
  title?: string;
  heading?: string;
  summary?: string;
  keywords: string[];
  related: string[];
  content: string;
  tokenEstimate: number;
  /** 검색(임베딩/FTS) 입력에만 붙는 문서/워크플로우 맥락 헤더. 표시용 content에는 포함하지 않는다. */
  contextHeader?: string;
}

interface FrontMatter {
  menuCode?: string;
  audience?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  related?: string[];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^0-9a-zA-Z가-힣._-]+/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'root';
}

function parseInlineArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return trimmed ? [trimmed.replace(/^["']|["']$/g, '')] : [];
  return trimmed
    .slice(1, -1)
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function parseFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z][\w]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.trim();
    meta[key] = value.startsWith('[') ? parseInlineArray(value) : value.replace(/^["']|["']$/g, '');
  }
  return { meta: meta as FrontMatter, body: match[2] ?? '' };
}

function splitByHeadings(body: string): Array<{ heading: string; content: string }> {
  const lines = body.split(/\r?\n/);
  const chunks: Array<{ heading: string; content: string[] }> = [];
  let current: { heading: string; content: string[] } = { heading: '개요', content: [] };
  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading && current.content.join('\n').trim()) {
      chunks.push(current);
      current = { heading: heading[2].trim(), content: [line] };
      continue;
    }
    if (heading && !current.content.join('\n').trim()) {
      current.heading = heading[2].trim();
    }
    current.content.push(line);
  }
  if (current.content.join('\n').trim()) chunks.push(current);
  return chunks.map((chunk) => ({ heading: chunk.heading, content: chunk.content.join('\n').trim() }));
}

/** maxChars를 넘는 단일 블록(빈 줄 없는 거대한 코드/표, 예: 자동생성 ERD mermaid)을
 *  줄 경계 우선, 안 되면 문자 윈도로 강제 분할한다. 임베딩 토큰 한도 초과를 막는다. */
function hardSplit(block: string, maxChars: number): string[] {
  if (block.length <= maxChars) return [block];
  const out: string[] = [];
  let buf = '';
  for (const line of block.split('\n')) {
    if (line.length > maxChars) {
      if (buf) { out.push(buf); buf = ''; }
      for (let i = 0; i < line.length; i += maxChars) out.push(line.slice(i, i + maxChars));
      continue;
    }
    const next = buf ? `${buf}\n${line}` : line;
    if (next.length > maxChars) { out.push(buf); buf = line; } else buf = next;
  }
  if (buf) out.push(buf);
  return out;
}

function splitLongContent(content: string, maxChars = 3500): string[] {
  if (content.length <= maxChars) return [content];
  const paragraphs = content.split(/\n{2,}/).flatMap((p) => hardSplit(p, maxChars));
  const out: string[] = [];
  let buf = '';
  for (const paragraph of paragraphs) {
    const next = buf ? `${buf}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars && buf) {
      out.push(buf);
      buf = paragraph;
    } else {
      buf = next;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** mermaid 코드펜스 블록을 임베딩 입력에서 제거한다. ER 다이어그램 등은 순수 시각 자료라
 *  청킹하면 문법 조각만 남아 검색 무용지물이 된다(파일 원본에는 영향 없음, 인덱스에서만 제외). */
function stripMermaidBlocks(body: string): string {
  return body.replace(/```mermaid[\s\S]*?```/g, '(다이어그램 생략)');
}

export function chunkMarkdown({ sourcePath, docType, language = 'ko', raw }: KnowledgeChunkInput): KnowledgeChunk[] {
  const { meta, body } = parseFrontMatter(raw);
  const sourceHash = sha256(raw);
  const sections = splitByHeadings(stripMermaidBlocks(body));
  const title = meta.title || sections[0]?.heading || path.basename(sourcePath);
  const keywords = [...(meta.keywords ?? []), ...(meta.tags ?? [])];
  const related = meta.related ?? [];
  const chunks: KnowledgeChunk[] = [];

  sections.forEach((section, sectionIndex) => {
    splitLongContent(section.content).forEach((content, partIndex) => {
      const heading = section.heading || title;
      const idBase = [docType, meta.audience, language, meta.menuCode, slugify(path.basename(sourcePath)), slugify(heading), partIndex]
        .filter(Boolean)
        .join(':');
      chunks.push({
        chunkId: `${idBase}:${sha256(content).slice(0, 10)}`,
        docType,
        sourcePath: sourcePath.replace(/\\/g, '/'),
        sourceHash,
        language,
        menuCode: meta.menuCode,
        audience: meta.audience,
        title,
        heading: partIndex > 0 ? `${heading} (${partIndex + 1})` : heading,
        summary: meta.summary,
        keywords,
        related,
        content,
        tokenEstimate: Math.ceil(content.length / 3),
      });
    });
  });

  if (chunks.length === 0 && body.trim()) {
    chunks.push({
      chunkId: `${docType}:${slugify(path.basename(sourcePath))}:root:${sourceHash.slice(0, 10)}`,
      docType,
      sourcePath: sourcePath.replace(/\\/g, '/'),
      sourceHash,
      language,
      menuCode: meta.menuCode,
      audience: meta.audience,
      title,
      heading: title,
      summary: meta.summary,
      keywords,
      related,
      content: body.trim(),
      tokenEstimate: Math.ceil(body.length / 3),
    });
  }
  return chunks;
}

/**
 * 청크에 맥락 헤더를 설정하고 chunkId 해시 suffix를 재계산한다.
 * 헤더가 바뀌면(워크플로우 문서 수정 등) chunkId가 바뀌어 임베딩 캐시가 자연 무효화된다.
 */
export function withContextHeader(chunk: KnowledgeChunk, header: string): KnowledgeChunk {
  const idBase = chunk.chunkId.split(':').slice(0, -1).join(':');
  return {
    ...chunk,
    contextHeader: header,
    chunkId: `${idBase}:${sha256(`${header}\n${chunk.content}`).slice(0, 10)}`,
  };
}
