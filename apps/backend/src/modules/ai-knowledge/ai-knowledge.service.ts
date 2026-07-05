/**
 * @file src/modules/ai-knowledge/ai-knowledge.service.ts
 * @description SQLite + sqlite-vec 기반 도움말/문서 RAG 인덱스.
 */
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { EmbeddingService } from './embedding.service';
import { KnowledgeChunk, chunkMarkdown, withContextHeader } from './markdown-chunker';
import { WorkflowDoc, parseWorkflowDoc } from './workflow-parser';

type DatabaseInstance = any;

type KnowledgeDocument = { sourcePath: string; docType: string; language: string; raw: string };
type KnowledgeTarget = { path: string; docType: string };

// 프론트 임베딩 탭 목록(AiEmbeddingPanel.tsx DEFAULT_KNOWLEDGE_TARGETS)과 동일 집합이어야 한다.
// 폴더 추가/개명 시 양쪽을 함께 갱신한다.
const DEFAULT_KNOWLEDGE_TARGETS: KnowledgeTarget[] = [
  { path: 'apps/frontend/public/help/user/ko', docType: 'help' },
  { path: 'apps/frontend/public/help/operator/ko', docType: 'help' },
  { path: 'docs/standards', docType: 'standard' },
  // UI 디자인 시스템 규칙(버튼/모달/폼 등) — 신규 화면 제작 질문의 근거.
  { path: 'docs/design', docType: 'standard' },
  // 시스템 아키텍처 참조(라우팅/API 인덱스/모듈맵) — 엔지니어 질문 근거.
  { path: 'docs/architecture', docType: 'document' },
  // 데이터 계층(스키마/ERD/컬럼 도메인/엔티티) — 엔지니어 DB 질문 근거.
  { path: 'docs/database', docType: 'document' },
  { path: 'docs/specs', docType: 'spec' },
  { path: 'docs/plans', docType: 'plan' },
  // docs/workflows 루트에는 구형 가이드 문서가 있어 정의 문서 전용 하위 폴더만 대상으로 한다.
  { path: 'docs/workflows/definitions', docType: 'workflow' },
  // engineer 페르소나의 근거 문서. 검색 부스트가 sourcePath(docs/business-logics/) 기준이라 docType은 document를 쓴다.
  { path: 'docs/business-logics', docType: 'document' },
  // 테이블 카탈로그(table-catalog.md)는 docs/database 폴더에 포함돼 자동 청킹된다(별도 항목 불필요).
  // text-to-SQL 테이블 선택/JOIN 주입은 AiCatalogService가 같은 파일을 직접 읽는다(임베딩과 별개 경로).
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

export interface WorkflowMenuContext {
  workflows: Array<{ workflowId: string; title: string; stepIndex: number; totalSteps: number }>;
  prevMenus: string[];
  nextMenus: string[];
  requires: string[];
}

export interface TroubleshootingHit {
  workflowId: string;
  symptom: string;
  causes: string[];
  resolutions: string[];
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
  workflowErrors: string[];
  workflowWarnings: string[];
  graphEdges: number;
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
      CREATE TABLE IF NOT EXISTS ai_knowledge_graph (
        workflow_id TEXT NOT NULL,
        workflow_title TEXT NOT NULL,
        from_menu TEXT NOT NULL,
        to_menu TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        detail TEXT,
        step_index INTEGER,
        PRIMARY KEY (workflow_id, from_menu, to_menu, edge_type)
      );
      CREATE TABLE IF NOT EXISTS ai_knowledge_workflow_steps (
        workflow_id TEXT NOT NULL,
        workflow_title TEXT NOT NULL,
        source_path TEXT NOT NULL,
        menu_code TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        total_steps INTEGER NOT NULL,
        requires_json TEXT NOT NULL,
        PRIMARY KEY (workflow_id, menu_code)
      );
      CREATE TABLE IF NOT EXISTS ai_knowledge_troubleshooting (
        workflow_id TEXT NOT NULL,
        symptom TEXT NOT NULL,
        causes_json TEXT NOT NULL,
        resolutions_json TEXT NOT NULL,
        PRIMARY KEY (workflow_id, symptom)
      );
    `);
    try {
      db.exec(`ALTER TABLE ai_knowledge_chunks ADD COLUMN context_header TEXT`);
    } catch {
      // 이미 컬럼이 있으면 무시한다.
    }
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
    const workflowErrors: string[] = [];
    const workflowWarnings: string[] = [];
    const workflowDocs: WorkflowDoc[] = [];
    for (const doc of documents.filter((d) => d.docType === 'workflow')) {
      const { doc: parsed, errors } = parseWorkflowDoc(doc.raw, doc.sourcePath);
      if (parsed) workflowDocs.push(parsed);
      workflowErrors.push(...errors);
    }
    const chunks = documents.flatMap((doc) => chunkMarkdown(doc)).map((raw) => {
      const chunk = this.enrichBusinessLogicMenuCode(raw);
      const header = this.buildContextHeader(chunk, workflowDocs);
      return header ? withContextHeader(chunk, header) : chunk;
    });
    const helpMenuCodes = new Set(chunks.filter((c) => c.docType === 'help' && c.menuCode).map((c) => c.menuCode as string));
    for (const wf of workflowDocs) {
      for (const step of wf.steps) {
        if (!helpMenuCodes.has(step.menu)) {
          workflowWarnings.push(`${wf.sourcePath}: 도움말에 없는 메뉴코드 ${step.menu} (오타 확인)`);
        }
      }
    }
    const now = new Date().toISOString();
    const embeddingRows = await this.resolveChunkEmbeddings(chunks, cfg.provider, cfg.model, cfg.dims, now);
    const embeddings = embeddingRows.map((row) => row.vector);
    const embedded = embeddingRows.filter((row) => !row.reused).length;
    const reused = embeddingRows.length - embedded;
    let graphEdges = 0;
    const tx = db.transaction(() => {
      db.exec(`DELETE FROM ai_knowledge_chunks; DELETE FROM ai_knowledge_fts;`);
      if (this.vectorEnabled) db.exec(`DELETE FROM ai_knowledge_vec;`);

      const insertChunk = db.prepare(`
        INSERT INTO ai_knowledge_chunks(
          chunk_id, doc_type, source_path, source_hash, language, menu_code, audience, title, heading, summary,
          keywords_json, related_json, content, token_estimate, context_header, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          chunk.contextHeader ?? null,
          now,
        );
        insertFts.run(
          chunk.chunkId,
          chunk.title ?? '',
          chunk.heading ?? '',
          [chunk.summary ?? '', chunk.contextHeader ?? ''].filter(Boolean).join('\n'),
          chunk.keywords.join(' '),
          chunk.content,
        );
        if (insertVec) insertVec.run(chunk.chunkId, embeddings[index]);
        upsertEmbedding.run(chunk.chunkId, cfg.provider, cfg.model, cfg.dims, JSON.stringify(Array.from(embeddings[index])), now);
      });
      if (chunks.length > 0) {
        const activeIds = new Set(chunks.map((chunk) => chunk.chunkId));
        const existingIds = db.prepare(`SELECT chunk_id AS chunkId FROM ai_knowledge_embeddings`).all() as Array<{ chunkId: string }>;
        const deleteEmbedding = db.prepare(`DELETE FROM ai_knowledge_embeddings WHERE chunk_id = ?`);
        for (const row of existingIds) if (!activeIds.has(row.chunkId)) deleteEmbedding.run(row.chunkId);
      }
      graphEdges = this.rebuildWorkflowGraph(workflowDocs);
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
      workflowErrors,
      workflowWarnings,
      graphEdges,
    };
  }

  /** 규칙 기반 맥락 헤더. 워크플로우 그래프와 frontmatter만 사용한다 (LLM 불필요). */
  private buildContextHeader(chunk: KnowledgeChunk, workflowDocs: WorkflowDoc[]): string {
    const parts: string[] = [];
    if (chunk.docType === 'workflow') {
      const wf = workflowDocs.find((doc) => doc.sourcePath === chunk.sourcePath);
      parts.push(`워크플로우 정의: ${wf?.title ?? chunk.title ?? ''}${wf ? ` (${wf.workflowId}, ${wf.steps.length}단계)` : ''}`);
    } else {
      const audienceLabel = chunk.audience === 'operator' ? '운영자 도움말' : chunk.audience === 'user' ? '사용자 도움말' : chunk.docType;
      parts.push(`${chunk.title ?? ''}${chunk.menuCode ? `(${chunk.menuCode})` : ''} ${audienceLabel}`.trim());
      if (chunk.menuCode) {
        for (const wf of workflowDocs) {
          const index = wf.steps.findIndex((step) => step.menu === chunk.menuCode);
          if (index === -1) continue;
          const prev = index > 0 ? wf.steps[index - 1].menu : null;
          const next = index < wf.steps.length - 1 ? wf.steps[index + 1].menu : null;
          parts.push(`${wf.title} ${index + 1}/${wf.steps.length}단계${prev ? ` | 선행: ${prev}` : ''}${next ? ` | 후행: ${next}` : ''}`);
        }
      }
    }
    const joined = parts.filter(Boolean).join(' | ');
    return joined ? `[${joined}]` : '';
  }

  /** workflows 문서에서 그래프/단계/트러블슈팅 테이블을 전량 재구축한다. */
  private rebuildWorkflowGraph(docs: WorkflowDoc[]): number {
    const db = this.db!;
    db.exec(`DELETE FROM ai_knowledge_graph; DELETE FROM ai_knowledge_workflow_steps; DELETE FROM ai_knowledge_troubleshooting;`);
    const insertEdge = db.prepare(`
      INSERT OR REPLACE INTO ai_knowledge_graph(workflow_id, workflow_title, from_menu, to_menu, edge_type, detail, step_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStep = db.prepare(`
      INSERT OR REPLACE INTO ai_knowledge_workflow_steps(workflow_id, workflow_title, source_path, menu_code, step_index, total_steps, requires_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTrouble = db.prepare(`
      INSERT OR REPLACE INTO ai_knowledge_troubleshooting(workflow_id, symptom, causes_json, resolutions_json)
      VALUES (?, ?, ?, ?)
    `);
    let edges = 0;
    for (const doc of docs) {
      doc.steps.forEach((step, index) => {
        insertStep.run(doc.workflowId, doc.title, doc.sourcePath, step.menu, index + 1, doc.steps.length, JSON.stringify(step.requires));
        if (index > 0) {
          insertEdge.run(doc.workflowId, doc.title, doc.steps[index - 1].menu, step.menu, 'precedes', step.transitions ?? null, index + 1);
          edges += 1;
        }
        for (const requirement of step.requires) {
          const [reqMenu, reqState] = requirement.split('=');
          insertEdge.run(doc.workflowId, doc.title, reqMenu.trim(), step.menu, 'requires', reqState?.trim() ?? null, index + 1);
          edges += 1;
        }
        for (const artifact of step.produces) {
          insertEdge.run(doc.workflowId, doc.title, step.menu, artifact, 'produces', null, index + 1);
          edges += 1;
        }
      });
      for (const trouble of doc.troubleshooting) {
        insertTrouble.run(doc.workflowId, trouble.symptom, JSON.stringify(trouble.causes), JSON.stringify(trouble.resolutions));
      }
    }
    return edges;
  }

  /** 메뉴가 속한 워크플로우와 선행/후행 메뉴를 반환한다 (그래프 1홉). */
  getWorkflowContext(menuCode: string): WorkflowMenuContext {
    const db = this.db!;
    const stepRows = db.prepare(`
      SELECT workflow_id AS workflowId, workflow_title AS title, step_index AS stepIndex, total_steps AS totalSteps, requires_json AS requiresJson
      FROM ai_knowledge_workflow_steps
      WHERE menu_code = ?
      ORDER BY workflow_id
    `).all(menuCode) as Array<{ workflowId: string; title: string; stepIndex: number; totalSteps: number; requiresJson: string }>;
    const prevRows = db.prepare(`
      SELECT DISTINCT from_menu AS menu FROM ai_knowledge_graph WHERE to_menu = ? AND edge_type = 'precedes'
    `).all(menuCode) as Array<{ menu: string }>;
    const nextRows = db.prepare(`
      SELECT DISTINCT to_menu AS menu FROM ai_knowledge_graph WHERE from_menu = ? AND edge_type = 'precedes'
    `).all(menuCode) as Array<{ menu: string }>;
    const requires = new Set<string>();
    for (const row of stepRows) {
      for (const item of this.parseRelatedMenuCodes(row.requiresJson)) requires.add(item);
    }
    return {
      workflows: stepRows.map(({ workflowId, title, stepIndex, totalSteps }) => ({ workflowId, title, stepIndex, totalSteps })),
      prevMenus: prevRows.map((row) => row.menu),
      nextMenus: nextRows.map((row) => row.menu),
      requires: Array.from(requires),
    };
  }

  /** 메뉴들의 대표(첫 번째) 청크를 audience 우선으로 반환한다 — 그래프 확장 컨텍스트용. */
  getMenuOverviewChunks(menuCodes: string[], audience: string, limit: number): KnowledgeSearchResult[] {
    if (menuCodes.length === 0) return [];
    const db = this.db!;
    const placeholders = menuCodes.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT chunk_id AS chunkId, doc_type AS docType, source_path AS sourcePath, menu_code AS menuCode, audience,
             title, heading, summary, content
      FROM ai_knowledge_chunks
      WHERE menu_code IN (${placeholders}) AND doc_type = 'help'
      ORDER BY menu_code, CASE WHEN audience = ? THEN 0 ELSE 1 END, chunk_id
    `).all(...menuCodes, audience) as Omit<KnowledgeSearchResult, 'score'>[];
    const seen = new Set<string>();
    const out: KnowledgeSearchResult[] = [];
    for (const row of rows) {
      const key = row.menuCode ?? row.sourcePath;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...row, score: 0 });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** 워크플로우 정의 문서 자체의 청크를 반환한다 (workflow_steps의 source_path로 매칭). */
  getWorkflowDocChunks(workflowIds: string[], limit: number): KnowledgeSearchResult[] {
    if (workflowIds.length === 0) return [];
    const db = this.db!;
    const idPlaceholders = workflowIds.map(() => '?').join(',');
    const pathRows = db.prepare(`
      SELECT DISTINCT source_path AS sourcePath FROM ai_knowledge_workflow_steps WHERE workflow_id IN (${idPlaceholders})
    `).all(...workflowIds) as Array<{ sourcePath: string }>;
    if (pathRows.length === 0) return [];
    const pathPlaceholders = pathRows.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT chunk_id AS chunkId, doc_type AS docType, source_path AS sourcePath, menu_code AS menuCode, audience,
             title, heading, summary, content
      FROM ai_knowledge_chunks
      WHERE doc_type = 'workflow' AND source_path IN (${pathPlaceholders})
      LIMIT ?
    `).all(...pathRows.map((row) => row.sourcePath), limit) as Omit<KnowledgeSearchResult, 'score'>[];
    return rows.map((row) => ({ ...row, score: 0 }));
  }

  /** 도움말 인덱스의 메뉴코드-제목 사전 — 질의이해 LLM이 사용자 용어를 메뉴코드로 매핑할 때 사용. */
  getMenuCatalog(limit = 400): Array<{ menuCode: string; title: string }> {
    const db = this.db!;
    const rows = db.prepare(`
      SELECT menu_code AS menuCode, MIN(title) AS title
      FROM ai_knowledge_chunks
      WHERE doc_type = 'help' AND menu_code IS NOT NULL AND title IS NOT NULL
      GROUP BY menu_code
      ORDER BY menu_code
      LIMIT ?
    `).all(limit) as Array<{ menuCode: string; title: string }>;
    return rows;
  }

  /** 메뉴들의 business-logics 청크를 반환한다 — engineer 의도 강제 포함용.
   * 입력 menuCodes 순서 = 우선순위. 첫 메뉴가 슬롯을 독식하지 않도록 메뉴당 상한을 나눠 배분한다. */
  getBusinessLogicChunks(menuCodes: string[], limit: number): KnowledgeSearchResult[] {
    if (menuCodes.length === 0) return [];
    const db = this.db!;
    const perMenu = Math.max(2, Math.ceil(limit / menuCodes.length));
    const stmt = db.prepare(`
      SELECT chunk_id AS chunkId, doc_type AS docType, source_path AS sourcePath, menu_code AS menuCode, audience,
             title, heading, summary, content
      FROM ai_knowledge_chunks
      WHERE menu_code = ? AND source_path LIKE 'docs/business-logics/%'
      ORDER BY chunk_id
      LIMIT ?
    `);
    const out: KnowledgeSearchResult[] = [];
    for (const menuCode of menuCodes) {
      if (out.length >= limit) break;
      const rows = stmt.all(menuCode, Math.min(perMenu, limit - out.length)) as Omit<KnowledgeSearchResult, 'score'>[];
      out.push(...rows.map((row) => ({ ...row, score: 0 })));
    }
    return out;
  }

  /** business-logics 문서는 frontmatter가 없어 파일명(=메뉴코드)으로 menuCode를 보강한다. */
  private enrichBusinessLogicMenuCode(chunk: KnowledgeChunk): KnowledgeChunk {
    if (chunk.menuCode) return chunk;
    const normalized = chunk.sourcePath.replace(/\\/g, '/');
    if (!normalized.startsWith('docs/business-logics/')) return chunk;
    return { ...chunk, menuCode: path.basename(normalized, '.md') };
  }

  /** 증상/원인 텍스트 부분 매칭 — 문제해결 의도 질문용. */
  searchTroubleshooting(query: string, limit: number): TroubleshootingHit[] {
    const db = this.db!;
    const terms = this.buildLexicalTerms(query);
    if (terms.length === 0) return [];
    const rows = db.prepare(`
      SELECT workflow_id AS workflowId, symptom, causes_json AS causesJson, resolutions_json AS resolutionsJson
      FROM ai_knowledge_troubleshooting
    `).all() as Array<{ workflowId: string; symptom: string; causesJson: string; resolutionsJson: string }>;
    const scored = rows
      .map((row) => {
        const haystack = `${row.symptom}\n${row.causesJson}`;
        const hits = terms.filter((term) => haystack.includes(term));
        return { row, score: hits.reduce((sum, term) => sum + Math.min(term.length, 6), 0) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(({ row }) => ({
      workflowId: row.workflowId,
      symptom: row.symptom,
      causes: this.parseRelatedMenuCodes(row.causesJson),
      resolutions: this.parseRelatedMenuCodes(row.resolutionsJson),
    }));
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
    return [chunk.contextHeader, chunk.title, chunk.heading, chunk.summary, chunk.keywords.join(' '), chunk.content]
      .filter(Boolean)
      .join('\n');
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
    if (targetPath.startsWith('docs/workflows')) return 'workflow';
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
