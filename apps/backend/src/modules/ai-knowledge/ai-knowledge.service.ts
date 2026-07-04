/**
 * @file src/modules/ai-knowledge/ai-knowledge.service.ts
 * @description SQLite + sqlite-vec 기반 도움말/문서 RAG 인덱스.
 */
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { EmbeddingService } from './embedding.service';
import { KnowledgeChunk, chunkMarkdown } from './markdown-chunker';

type DatabaseInstance = any;

type KnowledgeDocument = { sourcePath: string; docType: string; language: string; raw: string };
type KnowledgeTarget = { path: string; docType: string };

const DEFAULT_KNOWLEDGE_TARGETS: KnowledgeTarget[] = [
  { path: 'apps/frontend/public/help/user/ko', docType: 'help' },
  { path: 'apps/frontend/public/help/operator/ko', docType: 'help' },
  { path: 'docs/standards', docType: 'standard' },
  { path: 'docs/specs', docType: 'spec' },
  { path: 'docs/plans', docType: 'plan' },
  { path: 'apps/backend/data/ai-table-catalog.md', docType: 'catalog' },
];

export interface KnowledgeSearchContext {
  route?: string;
  menuCode?: string;
  language?: string;
  audience?: string;
  persona?: string;
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
  targets: string[];
  documents: number;
  chunks: number;
  embedded: number;
  reused: number;
  provider: string;
  model: string;
  dims: number;
}

export interface KnowledgeReindexOptions {
  targets?: string[];
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
    const resolvedDbPath = this.dbPath();
    const dbExists = fsSync.existsSync(resolvedDbPath);
    const dbStats = dbExists ? await fs.stat(resolvedDbPath) : null;
    const chunkCount = db.prepare(`SELECT COUNT(*) AS count FROM ai_knowledge_chunks`).get().count as number;
    const metaRows = db.prepare(`
      SELECT key, value
      FROM ai_knowledge_meta
      WHERE key IN ('last_reindex_at', 'vector_dims')
    `).all() as Array<{ key: string; value: string }>;
    const meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
    const cfg = await this.embedding.getConfig();
    return {
      dbPath: resolvedDbPath,
      dbDirectory: path.dirname(resolvedDbPath),
      dbFileName: path.basename(resolvedDbPath),
      dbExists,
      dbSizeBytes: dbStats?.size ?? 0,
      configuredDbPath: process.env.AI_KNOWLEDGE_DB_PATH || null,
      usesDefaultDbPath: !process.env.AI_KNOWLEDGE_DB_PATH,
      envKey: 'AI_KNOWLEDGE_DB_PATH',
      vectorEnabled: this.vectorEnabled,
      sqliteVecStatus: this.vectorEnabled ? 'loaded' : 'unavailable',
      vectorTableExists: this.hasTable('ai_knowledge_vec'),
      ftsTableExists: this.hasTable('ai_knowledge_fts'),
      vectorDims: meta.vector_dims ? Number(meta.vector_dims) : null,
      vectorRows: this.hasTable('ai_knowledge_vec') ? this.countTableRows('ai_knowledge_vec') : null,
      ftsRows: this.hasTable('ai_knowledge_fts') ? this.countTableRows('ai_knowledge_fts') : null,
      embeddingRows: this.countTableRows('ai_knowledge_embeddings'),
      lastReindexAt: meta.last_reindex_at ?? null,
      chunks: chunkCount,
      provider: cfg.provider,
      model: cfg.model,
      dims: cfg.dims,
      realEmbeddingProvider: cfg.realProvider,
    };
  }

  async reindex(options: KnowledgeReindexOptions = {}): Promise<KnowledgeReindexResult> {
    const db = await this.open();
    const cfg = await this.embedding.getConfig();
    this.ensureVectorSchema(cfg.dims);
    const targets = this.resolveTargets(options.targets);
    const documents = await this.collectDocuments(targets);
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
      targets: targets.map((target) => target.path),
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
    const groundedScores = new Map<string, number>();
    const persona = context.persona || context.audience || 'user';
    const preferredAudience = persona === 'operator' ? 'operator' : 'user';
    const addScore = (chunkId: string, score: number, grounded = false) => {
      scores.set(chunkId, (scores.get(chunkId) ?? 0) + score);
      if (grounded) groundedScores.set(chunkId, (groundedScores.get(chunkId) ?? 0) + score);
    };

    if (this.vectorEnabled && this.hasTable('ai_knowledge_vec')) {
      const queryEmbedding = await this.embedding.embed(query);
      const vecRows = db.prepare(`
        SELECT chunk_id AS chunkId, distance
        FROM ai_knowledge_vec
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT 30
      `).all(queryEmbedding.vector) as Array<{ chunkId: string; distance: number }>;
      for (const row of vecRows) addScore(row.chunkId, 0.6 * (1 / (1 + row.distance)));
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
          addScore(row.chunkId, 0.3 * (relevance / (1 + relevance)), true);
        }
      } catch {
        // FTS syntax errors should not break chat.
      }
    }

    const lexicalTerms = this.buildLexicalTerms(query);
    if (lexicalTerms.length > 0) {
      const lookupTerms = this.lexicalLookupTerms(lexicalTerms);
      const likeClauses = lookupTerms
        .map(() => `(title LIKE ? OR heading LIKE ? OR summary LIKE ? OR keywords_json LIKE ? OR content LIKE ?)`)
        .join(' OR ');
      const likeParams = lookupTerms.flatMap((term) => Array(5).fill(`%${term}%`));
      const lexicalRows = db.prepare(`
        SELECT chunk_id AS chunkId, doc_type AS docType, audience, source_path AS sourcePath,
               title, heading, summary, keywords_json AS keywordsJson, content
        FROM ai_knowledge_chunks
        WHERE ${likeClauses}
        LIMIT 200
      `).all(...likeParams) as Array<{
        chunkId: string;
        docType?: string;
        audience?: string | null;
        sourcePath?: string;
        title?: string | null;
        heading?: string | null;
        summary?: string | null;
        keywordsJson?: string | null;
        content?: string | null;
      }>;
      for (const row of lexicalRows) {
        const lexicalScore = this.scoreLexicalRow(row, lexicalTerms, query, preferredAudience, persona);
        if (lexicalScore > 0) addScore(row.chunkId, lexicalScore, true);
      }
    }

    if (context.menuCode) {
      const menuRows = db.prepare(`
        SELECT chunk_id AS chunkId, doc_type AS docType, audience, source_path AS sourcePath, related_json AS relatedJson
        FROM ai_knowledge_chunks
        WHERE menu_code = ?
        LIMIT 30
      `).all(context.menuCode) as Array<{ chunkId: string; docType?: string; audience?: string | null; sourcePath?: string; relatedJson?: string | null }>;
      const relatedMenuCodes = new Set<string>();
      for (const row of menuRows) {
        let boost = 0.15;
        const isBusinessLogic = row.sourcePath?.replace(/\\/g, '/').startsWith('docs/business-logics/');
        if (persona === 'engineer' && isBusinessLogic) boost += 0.7;
        else if (row.docType === 'help' && row.audience === preferredAudience) boost += 0.5;
        else if (row.docType === 'help') boost += 0.05;
        addScore(row.chunkId, boost, true);
        for (const menuCode of this.parseRelatedMenuCodes(row.relatedJson)) {
          if (menuCode !== context.menuCode) relatedMenuCodes.add(menuCode);
        }
      }
      if (relatedMenuCodes.size > 0) {
        const relatedCodes = Array.from(relatedMenuCodes).slice(0, 12);
        const placeholders = relatedCodes.map(() => '?').join(',');
        const relatedRows = db.prepare(`
          SELECT chunk_id AS chunkId, doc_type AS docType, audience, source_path AS sourcePath
          FROM ai_knowledge_chunks
          WHERE menu_code IN (${placeholders})
          LIMIT 60
        `).all(...relatedCodes) as Array<{ chunkId: string; docType?: string; audience?: string | null; sourcePath?: string }>;
        for (const row of relatedRows) {
          let boost = this.isActionHowToQuery(query) ? 0.75 : 0.25;
          const isBusinessLogic = row.sourcePath?.replace(/\\/g, '/').startsWith('docs/business-logics/');
          if (persona === 'engineer' && isBusinessLogic) boost += 0.35;
          else if (row.docType === 'help' && row.audience === preferredAudience) boost += 0.35;
          else if (row.docType === 'help') boost += 0.05;
          addScore(row.chunkId, boost, true);
        }
      }
    }

    const candidates = groundedScores.size > 0
      ? Array.from(scores.entries()).filter(([id]) => groundedScores.has(id))
      : [];
    const ids = candidates.sort((a, b) => b[1] - a[1]).slice(0, topK).map(([id]) => id);
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
        `[${index + 1}] ${this.formatContextTitle(chunk)} > ${chunk.heading ?? '본문'}`,
        `source=${chunk.sourcePath}`,
        chunk.summary ? `summary=${chunk.summary}` : '',
        chunk.content.slice(0, 2500),
      ].filter(Boolean).join('\n'))
      .join('\n\n---\n\n');
  }

  private formatContextTitle(chunk: KnowledgeSearchResult): string {
    const audienceLabel =
      chunk.audience === 'user'
        ? '사용자 도움말'
        : chunk.audience === 'operator'
          ? '운영자 도움말'
          : chunk.sourcePath.startsWith('docs/business-logics/')
            ? '비즈니스 로직'
            : chunk.docType;
    return `${chunk.title ?? chunk.menuCode ?? chunk.docType} (${audienceLabel})`;
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

  private countTableRows(tableName: string): number | null {
    if (!this.db || !this.hasTable(tableName)) return null;
    try {
      return this.db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count as number;
    } catch {
      return null;
    }
  }

  private embeddingText(chunk: KnowledgeChunk): string {
    return [chunk.title, chunk.heading, chunk.summary, chunk.keywords.join(' '), chunk.content].filter(Boolean).join('\n');
  }

  private toFtsQuery(query: string): string {
    const tokens: string[] = query.match(/[0-9a-zA-Z가-힣_]+/g) ?? [];
    return tokens.slice(0, 8).map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ');
  }

  private buildLexicalTerms(query: string): string[] {
    const stopWords = new Set(['알려줘', '알려', '주세요', '방법', '사용법', '어떻게', '무엇', '뭐야', '좀']);
    const tokens = query.match(/[0-9a-zA-Z가-힣_]+/g) ?? [];
    const terms = new Set<string>();
    const add = (value: string) => {
      const term = this.stripKoreanParticle(value.trim());
      if (term.length < 2 || stopWords.has(term)) return;
      terms.add(term);
    };

    for (const token of tokens) {
      add(token);
      const normalized = this.stripKoreanParticle(token);
      for (const action of ['등록', '입력', '저장', '조회', '수정', '삭제', '취소', '처리']) {
        if (normalized.includes(action)) add(action);
      }
      if (/^[가-힣]+$/.test(normalized) && normalized.length >= 5) {
        for (let length = 3; length <= Math.min(6, normalized.length); length += 1) {
          for (let index = 0; index <= normalized.length - length; index += 1) {
            add(normalized.slice(index, index + length));
          }
        }
      }
    }

    return Array.from(terms)
      .sort((a, b) => b.length - a.length)
      .slice(0, 24);
  }

  private lexicalLookupTerms(terms: string[]): string[] {
    const subjectTerms = terms.filter((term) => term.length >= 3 && !/등록|입력|저장|조회|수정|삭제|취소|처리/.test(term));
    return (subjectTerms.length > 0 ? subjectTerms : terms).slice(0, 16);
  }

  private stripKoreanParticle(value: string): string {
    return value.replace(/(으로|에서|에게|한테|부터|까지|처럼|보다|만큼|하고|이며|이고|을|를|은|는|이|가|의|에|로|와|과|도|만)$/u, '');
  }

  private scoreLexicalRow(
    row: {
      docType?: string;
      audience?: string | null;
      sourcePath?: string;
      title?: string | null;
      heading?: string | null;
      summary?: string | null;
      keywordsJson?: string | null;
      content?: string | null;
    },
    terms: string[],
    query: string,
    preferredAudience: string,
    persona: string,
  ): number {
    const title = row.title ?? '';
    const heading = row.heading ?? '';
    const summary = row.summary ?? '';
    const keywords = row.keywordsJson ?? '';
    const content = row.content ?? '';
    const coreMetadata = `${title}\n${summary}\n${keywords}`;
    const metadata = `${title}\n${heading}\n${summary}\n${keywords}`;
    const haystack = `${title}\n${heading}\n${summary}\n${keywords}\n${content}`;
    let score = 0;
    for (const term of terms) {
      if (!haystack.includes(term)) continue;
      const lengthWeight = Math.min(term.length, 6) / 6;
      let fieldWeight = content.includes(term) ? 0.025 : 0;
      if (title.includes(term)) fieldWeight += 0.18;
      if (heading.includes(term)) fieldWeight += 0.1;
      if (summary.includes(term)) fieldWeight += 0.14;
      if (keywords.includes(term)) fieldWeight += 0.18;
      score += fieldWeight * lengthWeight;
    }
    if (score <= 0) return 0;
    if (this.isActionHowToQuery(query)) {
      const actionPattern = /등록|입력|저장|사용 순서|처리합니다/;
      const subjectTerms = terms.filter((term) => term.length >= 3 && !/등록|입력|저장|조회|수정|삭제|취소|처리/.test(term));
      const metadataHasSubject = subjectTerms.some((term) => metadata.includes(term));
      const haystackHasSubject = subjectTerms.some((term) => haystack.includes(term));
      const metadataHasAction = actionPattern.test(metadata);
      const haystackHasAction = actionPattern.test(haystack);
      if (metadataHasSubject && metadataHasAction) score += 0.65;
      else if (haystackHasSubject && metadataHasAction) score += 0.45;
      else if (metadataHasSubject && haystackHasAction) score += 0.25;
      else if (haystackHasSubject && haystackHasAction) score += 0.05;
      if (/등록|입력|저장/.test(query.replace(/\s+/g, ''))) {
        if (/등록|입력|저장/.test(coreMetadata)) score += 0.5;
        else score *= 0.55;
        if (/조회|통합조회/.test(title)) score *= 0.5;
      }
    }
    const isBusinessLogic = row.sourcePath?.replace(/\\/g, '/').startsWith('docs/business-logics/');
    if (persona === 'engineer' && isBusinessLogic) score += 0.2;
    else if (row.docType === 'help' && row.audience === preferredAudience) score += 0.25;
    else if (row.docType === 'help') score += 0.05;
    return Math.min(score, 3);
  }

  private isActionHowToQuery(query: string): boolean {
    const compact = query.replace(/\s+/g, '');
    return /등록|입력|저장|사용법|방법|어떻게/.test(compact);
  }

  private parseRelatedMenuCodes(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private resolveTargets(input?: string[]): KnowledgeTarget[] {
    if (!input || input.length === 0) return DEFAULT_KNOWLEDGE_TARGETS;
    const defaultsByPath = new Map(DEFAULT_KNOWLEDGE_TARGETS.map((target) => [target.path, target.docType]));
    const normalized = Array.from(new Set(input.map((item) => this.normalizeTargetPath(item)).filter(Boolean)));
    if (normalized.length === 0) throw new BadRequestException('청킹 대상이 선택되지 않았습니다.');
    return normalized.map((targetPath) => ({
      path: targetPath,
      docType: defaultsByPath.get(targetPath) ?? this.inferDocType(targetPath),
    }));
  }

  private normalizeTargetPath(input: string): string {
    const raw = String(input ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!raw) return '';
    const normalized = path.posix.normalize(raw);
    if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.isAbsolute(raw)) {
      throw new BadRequestException(`허용되지 않는 청킹 대상 경로입니다: ${input}`);
    }
    return normalized;
  }

  private inferDocType(targetPath: string): string {
    if (targetPath.startsWith('apps/frontend/public/help/')) return 'help';
    if (targetPath.startsWith('docs/standards')) return 'standard';
    if (targetPath.startsWith('docs/specs')) return 'spec';
    if (targetPath.startsWith('docs/plans')) return 'plan';
    if (targetPath.includes('catalog')) return 'catalog';
    return 'document';
  }

  private async collectDocuments(targets: KnowledgeTarget[]): Promise<KnowledgeDocument[]> {
    const root = this.projectRoot();
    const docs: KnowledgeDocument[] = [];
    for (const target of targets) {
      const resolved = path.resolve(root, target.path);
      const relative = path.relative(root, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new BadRequestException(`프로젝트 밖의 청킹 대상은 허용되지 않습니다: ${target.path}`);
      }
      if (!fsSync.existsSync(resolved)) continue;
      const stat = await fs.stat(resolved);
      if (stat.isFile()) {
        if (resolved.toLowerCase().endsWith('.md')) docs.push({ sourcePath: path.relative(root, resolved), docType: target.docType, language: 'ko', raw: await fs.readFile(resolved, 'utf8') });
        continue;
      }
      if (!stat.isDirectory()) continue;
      for (const file of await this.listMarkdownFiles(resolved)) {
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
