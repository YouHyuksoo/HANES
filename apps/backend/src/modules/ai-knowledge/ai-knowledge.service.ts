/**
 * @file src/modules/ai-knowledge/ai-knowledge.service.ts
 * @description SQLite + sqlite-vec 기반 도움말/문서 RAG 인덱스.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { EmbeddingService } from './embedding.service';
import { KnowledgeChunk, chunkMarkdown } from './markdown-chunker';

type DatabaseInstance = any;

export interface KnowledgeSearchContext {
  route?: string;
  menuCode?: string;
  language?: string;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  score: number;
  sourcePath: string;
  docType: string;
  menuCode?: string;
  audience?: string;
  title?: string;
  heading?: string;
  summary?: string;
  content: string;
}

export interface KnowledgeReindexResult {
  ok: boolean;
  vectorEnabled: boolean;
  documents: number;
  chunks: number;
  embedded: number;
  reused: number;
  provider: string;
  model: string;
  dims: number;
}

@Injectable()
export class AiKnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(AiKnowledgeService.name);
  private db: DatabaseInstance | null = null;
  private vectorEnabled = false;
  private dims = 1536;

  constructor(private readonly embedding: EmbeddingService) {}

  async onModuleInit(): Promise<void> {
    await this.open();
  }

  private projectRoot(): string {
    return path.resolve(process.cwd(), '..', '..');
  }

  private dbPath(): string {
    return process.env.AI_KNOWLEDGE_DB_PATH || path.resolve(process.cwd(), 'data', 'ai-knowledge', 'ai-knowledge.sqlite');
  }

  private async open(): Promise<DatabaseInstance> {
    if (this.db) return this.db;
    const Database = require('better-sqlite3');
    const dbPath = this.dbPath();
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    try {
      const sqliteVec = require('sqlite-vec');
      sqliteVec.load(db);
      this.vectorEnabled = true;
    } catch (error) {
      this.vectorEnabled = false;
      this.logger.warn(`sqlite-vec 로딩 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.db = db;
    this.ensureBaseSchema();
    return db;
  }

  private ensureBaseSchema(): void {
    const db = this.db!;
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
        chunk_id TEXT PRIMARY KEY,
        doc_type TEXT NOT NULL,
        source_path TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'ko',
        menu_code TEXT,
        audience TEXT,
        title TEXT,
        heading TEXT,
        summary TEXT,
        keywords_json TEXT,
        related_json TEXT,
        content TEXT NOT NULL,
        token_estimate INTEGER,
        updated_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS ai_knowledge_fts USING fts5(
        chunk_id UNINDEXED,
        title,
        heading,
        summary,
        keywords,
        content,
        tokenize='unicode61'
      );
      CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings (
        chunk_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        embedding_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (chunk_id, provider, model, dims)
      );
      CREATE TABLE IF NOT EXISTS ai_knowledge_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private ensureVectorSchema(dims: number): void {
    if (!this.vectorEnabled) return;
    const db = this.db!;
    const previous = db.prepare(`SELECT value FROM ai_knowledge_meta WHERE key='vector_dims'`).get()?.value;
    if (previous && Number(previous) !== dims) {
      db.exec(`DROP TABLE IF EXISTS ai_knowledge_vec;`);
    }
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ai_knowledge_vec USING vec0(chunk_id TEXT PRIMARY KEY, embedding FLOAT[${dims}]);`);
    db.prepare(`INSERT OR REPLACE INTO ai_knowledge_meta(key, value) VALUES ('vector_dims', ?)`).run(String(dims));
    this.dims = dims;
  }

  async status() {
    const db = await this.open();
    const chunkCount = db.prepare(`SELECT COUNT(*) AS count FROM ai_knowledge_chunks`).get().count as number;
    const cfg = await this.embedding.getConfig();
    return {
      dbPath: this.dbPath(),
      vectorEnabled: this.vectorEnabled,
      chunks: chunkCount,
      provider: cfg.provider,
      model: cfg.model,
      dims: cfg.dims,
      realEmbeddingProvider: cfg.realProvider,
    };
  }

  async reindex(): Promise<KnowledgeReindexResult> {
    const db = await this.open();
    const cfg = await this.embedding.getConfig();
    this.ensureVectorSchema(cfg.dims);
    const documents = await this.collectDocuments();
    const chunks = documents.flatMap((doc) => chunkMarkdown(doc));
    const now = new Date().toISOString();
    const embeddingRows = await this.resolveChunkEmbeddings(chunks, cfg.provider, cfg.model, cfg.dims, now);
    const embeddings = embeddingRows.map((row) => row.vector);
    const embedded = embeddingRows.filter((row) => !row.reused).length;
    const reused = embeddingRows.length - embedded;
    const tx = db.transaction(() => {
      db.exec(`DELETE FROM ai_knowledge_chunks; DELETE FROM ai_knowledge_fts;`);
      if (this.vectorEnabled) db.exec(`DELETE FROM ai_knowledge_vec;`);

      const insertChunk = db.prepare(`
        INSERT INTO ai_knowledge_chunks(
          chunk_id, doc_type, source_path, source_hash, language, menu_code, audience, title, heading, summary,
          keywords_json, related_json, content, token_estimate, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertFts = db.prepare(`INSERT INTO ai_knowledge_fts(chunk_id, title, heading, summary, keywords, content) VALUES (?, ?, ?, ?, ?, ?)`);
      const insertVec = this.vectorEnabled ? db.prepare(`INSERT INTO ai_knowledge_vec(chunk_id, embedding) VALUES (?, ?)`) : null;
      const upsertEmbedding = db.prepare(`
        INSERT OR REPLACE INTO ai_knowledge_embeddings(chunk_id, provider, model, dims, embedding_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      chunks.forEach((chunk, index) => {
        insertChunk.run(
          chunk.chunkId,
          chunk.docType,
          chunk.sourcePath,
          chunk.sourceHash,
          chunk.language,
          chunk.menuCode ?? null,
          chunk.audience ?? null,
          chunk.title ?? null,
          chunk.heading ?? null,
          chunk.summary ?? null,
          JSON.stringify(chunk.keywords),
          JSON.stringify(chunk.related),
          chunk.content,
          chunk.tokenEstimate,
          now,
        );
        insertFts.run(chunk.chunkId, chunk.title ?? '', chunk.heading ?? '', chunk.summary ?? '', chunk.keywords.join(' '), chunk.content);
        if (insertVec) insertVec.run(chunk.chunkId, embeddings[index]);
        upsertEmbedding.run(chunk.chunkId, cfg.provider, cfg.model, cfg.dims, JSON.stringify(Array.from(embeddings[index])), now);
      });
      if (chunks.length > 0) {
        const activeIds = new Set(chunks.map((chunk) => chunk.chunkId));
        const existingIds = db.prepare(`SELECT chunk_id AS chunkId FROM ai_knowledge_embeddings`).all() as Array<{ chunkId: string }>;
        const deleteEmbedding = db.prepare(`DELETE FROM ai_knowledge_embeddings WHERE chunk_id = ?`);
        for (const row of existingIds) if (!activeIds.has(row.chunkId)) deleteEmbedding.run(row.chunkId);
      }
      db.prepare(`INSERT OR REPLACE INTO ai_knowledge_meta(key, value) VALUES ('last_reindex_at', ?)`).run(now);
    });
    tx();

    return {
      ok: true,
      vectorEnabled: this.vectorEnabled,
      documents: documents.length,
      chunks: chunks.length,
      embedded,
      reused,
      provider: cfg.provider,
      model: cfg.model,
      dims: cfg.dims,
    };
  }

  async search(query: string, context: KnowledgeSearchContext = {}, topK = 6): Promise<KnowledgeSearchResult[]> {
    const db = await this.open();
    const scores = new Map<string, number>();

    if (this.vectorEnabled && this.hasTable('ai_knowledge_vec')) {
      const queryEmbedding = await this.embedding.embed(query);
      const vecRows = db.prepare(`
        SELECT chunk_id AS chunkId, distance
        FROM ai_knowledge_vec
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT 30
      `).all(queryEmbedding.vector) as Array<{ chunkId: string; distance: number }>;
      for (const row of vecRows) scores.set(row.chunkId, (scores.get(row.chunkId) ?? 0) + 0.6 * (1 / (1 + row.distance)));
    }

    const ftsQuery = this.toFtsQuery(query);
    if (ftsQuery) {
      try {
        const ftsRows = db.prepare(`
          SELECT chunk_id AS chunkId, bm25(ai_knowledge_fts) AS rank
          FROM ai_knowledge_fts
          WHERE ai_knowledge_fts MATCH ?
          LIMIT 30
        `).all(ftsQuery) as Array<{ chunkId: string; rank: number }>;
        // bm25()는 값이 작을수록(더 음수일수록) 더 좋은 매치다. Math.abs를 취하면 순위가 뒤집히므로 음수를 그대로 relevance로 쓴다.
        for (const row of ftsRows) {
          const relevance = Math.max(0, -row.rank);
          scores.set(row.chunkId, (scores.get(row.chunkId) ?? 0) + 0.3 * (relevance / (1 + relevance)));
        }
      } catch {
        // FTS syntax errors should not break chat.
      }
    }

    if (context.menuCode) {
      const menuRows = db.prepare(`SELECT chunk_id AS chunkId FROM ai_knowledge_chunks WHERE menu_code = ? LIMIT 20`).all(context.menuCode) as Array<{ chunkId: string }>;
      for (const row of menuRows) scores.set(row.chunkId, (scores.get(row.chunkId) ?? 0) + 0.15);
    }

    const ids = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, topK).map(([id]) => id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT chunk_id AS chunkId, doc_type AS docType, source_path AS sourcePath, menu_code AS menuCode, audience,
             title, heading, summary, content
      FROM ai_knowledge_chunks
      WHERE chunk_id IN (${placeholders})
    `).all(...ids) as Omit<KnowledgeSearchResult, 'score'>[];
    const byId = new Map(rows.map((row) => [row.chunkId, row]));
    return ids.map((id) => ({ ...byId.get(id)!, score: scores.get(id)! })).filter((row) => row.content);
  }

  formatContext(chunks: KnowledgeSearchResult[]): string {
    if (chunks.length === 0) return '';
    return chunks
      .map((chunk, index) => [
        `[${index + 1}] ${chunk.title ?? chunk.menuCode ?? chunk.docType} > ${chunk.heading ?? '본문'}`,
        `source=${chunk.sourcePath}`,
        chunk.summary ? `summary=${chunk.summary}` : '',
        chunk.content.slice(0, 2500),
      ].filter(Boolean).join('\n'))
      .join('\n\n---\n\n');
  }


  private async resolveChunkEmbeddings(
    chunks: KnowledgeChunk[],
    provider: string,
    model: string,
    dims: number,
    now: string,
  ): Promise<Array<{ vector: Float32Array; reused: boolean }>> {
    const db = this.db!;
    const cached = db.prepare(`
      SELECT embedding_json AS embeddingJson
      FROM ai_knowledge_embeddings
      WHERE chunk_id = ? AND provider = ? AND model = ? AND dims = ?
    `);
    const results: Array<{ vector: Float32Array; reused: boolean } | null> = new Array(chunks.length).fill(null);
    const missing: Array<{ index: number; text: string }> = [];

    chunks.forEach((chunk, index) => {
      const row = cached.get(chunk.chunkId, provider, model, dims) as { embeddingJson?: string } | undefined;
      if (row?.embeddingJson) {
        try {
          results[index] = { vector: new Float32Array(JSON.parse(row.embeddingJson) as number[]), reused: true };
          return;
        } catch {
          // 잘못된 cache는 재생성한다.
        }
      }
      missing.push({ index, text: this.embeddingText(chunk) });
    });

    if (missing.length > 0) {
      const generated = await this.embedding.embedMany(missing.map((item) => item.text));
      generated.forEach((embedding, offset) => {
        results[missing[offset].index] = { vector: embedding.vector, reused: false };
      });
    }

    return results.map((row, index) => {
      if (!row) throw new Error(`Embedding 생성 실패: ${chunks[index].chunkId} (${now})`);
      return row;
    });
  }

  private hasTable(tableName: string): boolean {
    if (!this.db) return false;
    const row = this.db.prepare(`SELECT name FROM sqlite_master WHERE name = ?`).get(tableName);
    return !!row;
  }

  private embeddingText(chunk: KnowledgeChunk): string {
    return [chunk.title, chunk.heading, chunk.summary, chunk.keywords.join(' '), chunk.content].filter(Boolean).join('\n');
  }

  private toFtsQuery(query: string): string {
    const tokens = query.match(/[0-9a-zA-Z가-힣_]+/g) ?? [];
    return tokens.slice(0, 8).map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ');
  }

  private async collectDocuments(): Promise<Array<{ sourcePath: string; docType: string; language: string; raw: string }>> {
    const root = this.projectRoot();
    const targets = [
      { dir: path.resolve(root, 'apps/frontend/public/help/user/ko'), docType: 'help' },
      { dir: path.resolve(root, 'apps/frontend/public/help/operator/ko'), docType: 'help' },
      { dir: path.resolve(root, 'docs/standards'), docType: 'standard' },
      { dir: path.resolve(root, 'docs/specs'), docType: 'spec' },
      { dir: path.resolve(root, 'docs/plans'), docType: 'plan' },
      { file: path.resolve(root, 'apps/backend/data/ai-table-catalog.md'), docType: 'catalog' },
    ];
    const docs: Array<{ sourcePath: string; docType: string; language: string; raw: string }> = [];
    for (const target of targets) {
      if ('file' in target) {
        if (fsSync.existsSync(target.file)) docs.push({ sourcePath: path.relative(root, target.file), docType: target.docType, language: 'ko', raw: await fs.readFile(target.file, 'utf8') });
        continue;
      }
      if (!fsSync.existsSync(target.dir)) continue;
      for (const file of await this.listMarkdownFiles(target.dir)) {
        docs.push({ sourcePath: path.relative(root, file), docType: target.docType, language: 'ko', raw: await fs.readFile(file, 'utf8') });
      }
    }
    return docs;
  }

  private async listMarkdownFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await this.listMarkdownFiles(full));
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full);
    }
    return out;
  }
}
