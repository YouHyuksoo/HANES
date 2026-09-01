/**
 * @file src/modules/ai-knowledge/embedding.service.ts
 * @description RAG chunk/query embedding 생성. SYS_CONFIGS AI 설정을 우선 사용하고, 키가 없으면 개발 검증용 local-hash로 degrade한다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysConfig } from '../../entities/sys-config.entity';

export interface EmbeddingResult {
  provider: string;
  model: string;
  dims: number;
  vector: Float32Array;
}

interface EmbeddingConfig {
  provider: string;
  model: string;
  dims: number;
  realProvider: boolean;
  /** self-host 임베딩 주소. provider가 ollama일 때만 쓴다. */
  baseUrl?: string;
}

/** Mistral 임베딩 요청당 토큰 예산 — 공식 한도(16k)에 여유를 둔 값 */
const MISTRAL_BATCH_TOKEN_BUDGET = 8000;
/** 배치 간 간격 — 연속 호출로 rate limit에 걸리는 것을 막는다 */
const MISTRAL_BATCH_INTERVAL_MS = 350;
const MISTRAL_RETRY_BASE_MS = 2000;
const MISTRAL_RETRY_MAX_MS = 30000;
const MISTRAL_MAX_RETRY = 6;

const EMBEDDING_DEFAULTS: Record<string, { model: string; dims: number }> = {
  mistral: { model: 'mistral-embed', dims: 1024 },
  openai: { model: 'text-embedding-3-small', dims: 1536 },
  // 사내 서버에서 직접 돌리는 임베딩(Ollama 등). OpenAI 호환 /v1/embeddings를 쓴다.
  ollama: { model: 'bge-m3', dims: 1024 },
};

/** self-host 임베딩 기본 주소 — 백엔드와 같은 장비에서 도는 것을 전제한다 */
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

const LOCAL_HASH_MODEL = 'local-hash';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    @InjectRepository(SysConfig)
    private readonly sysConfigRepo: Repository<SysConfig>,
  ) {}

  private async getConfigValue(configKey: string, def = ''): Promise<string> {
    const row = await this.sysConfigRepo.findOne({ where: { configKey } });
    return row?.configValue?.trim() || def;
  }

  private async getApiKey(provider: string, overrideApiKey?: string): Promise<string | undefined> {
    if (overrideApiKey?.trim()) return overrideApiKey.trim();
    const normalized = provider.toLowerCase();
    const cfg = await this.getConfigValue(`AI_${normalized.toUpperCase()}_KEY`);
    if (cfg) return cfg;
    switch (normalized) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'mistral':
        return process.env.MISTRAL_API_KEY;
      default:
        return undefined;
    }
  }

  async getConfig(): Promise<EmbeddingConfig> {
    const chatProvider = (await this.getConfigValue('AI_PROVIDER', 'mistral')).toLowerCase();
    const configuredProvider = (await this.getConfigValue('AI_EMBEDDING_PROVIDER', chatProvider)).toLowerCase();
    const provider = EMBEDDING_DEFAULTS[configuredProvider] ? configuredProvider : 'mistral';
    const providerDefault = EMBEDDING_DEFAULTS[provider];
    const model = await this.getConfigValue('AI_EMBEDDING_MODEL', providerDefault.model);
    const dims = Number(await this.getConfigValue('AI_EMBEDDING_DIMS', String(providerDefault.dims))) || providerDefault.dims;

    // self-host 임베딩은 API 키가 없다. 주소만 있으면 동작한다.
    if (provider === 'ollama') {
      const baseUrl = await this.getConfigValue('AI_EMBEDDING_BASE_URL', OLLAMA_DEFAULT_BASE_URL);
      return { provider, model, dims, realProvider: true, baseUrl };
    }

    const apiKey = await this.getApiKey(provider);

    if (!apiKey) {
      return {
        provider: LOCAL_HASH_MODEL,
        model: `${LOCAL_HASH_MODEL}-${dims}`,
        dims,
        realProvider: false,
      };
    }
    return { provider, model, dims, realProvider: true };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const [result] = await this.embedMany([text]);
    return result;
  }

  async embedMany(texts: string[]): Promise<EmbeddingResult[]> {
    const cfg = await this.getConfig();
    if (cfg.provider === 'openai') return this.embedOpenAiMany(texts, cfg.model, cfg.dims);
    if (cfg.provider === 'mistral') return this.embedMistralMany(texts, cfg.model, cfg.dims);
    if (cfg.provider === 'ollama') return this.embedOllamaMany(texts, cfg.model, cfg.dims, cfg.baseUrl ?? OLLAMA_DEFAULT_BASE_URL);
    return texts.map((text) => ({ provider: cfg.provider, model: cfg.model, dims: cfg.dims, vector: this.embedLocalHash(text, cfg.dims) }));
  }


  async test(provider: string, model: string, dims: number, apiKey?: string): Promise<{ ok: boolean; message: string }> {
    const requested = provider.toLowerCase();
    const normalized = EMBEDDING_DEFAULTS[requested] ? requested : 'mistral';
    const defaultCfg = EMBEDDING_DEFAULTS[normalized];
    const targetModel = model || defaultCfg.model;
    const targetDims = Number(dims) || defaultCfg.dims;

    // self-host 임베딩은 키가 아니라 주소로 붙는다.
    if (normalized === 'ollama') {
      const baseUrl = await this.getConfigValue('AI_EMBEDDING_BASE_URL', OLLAMA_DEFAULT_BASE_URL);
      try {
        const [result] = await this.embedOllamaMany(['HANES embedding connection test'], targetModel, targetDims, baseUrl);
        return { ok: true, message: `Embedding 연결 성공 (ollama/${targetModel}, dims=${result.vector.length})` };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message.slice(0, 200) : '연결 실패';
        return { ok: false, message: `Embedding 연결 실패 (ollama/${targetModel}): ${msg}` };
      }
    }

    const key = await this.getApiKey(normalized, apiKey);
    if (!key) return { ok: false, message: `${normalized} embedding API 키가 없습니다.` };
    try {
      const [result] = normalized === 'openai'
        ? await this.embedOpenAiManyWithKey(['HANES embedding connection test'], targetModel, targetDims, key)
        : await this.embedMistralManyWithKey(['HANES embedding connection test'], targetModel, targetDims, key);
      return {
        ok: true,
        message: `Embedding 연결 성공 (${normalized}/${targetModel}, dims=${result.vector.length})`,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message.slice(0, 200) : '연결 실패';
      return { ok: false, message: `Embedding 연결 실패 (${normalized}/${targetModel}): ${msg}` };
    }
  }

  private async embedOpenAiMany(texts: string[], model: string, dims: number): Promise<EmbeddingResult[]> {
    const apiKey = await this.getApiKey('openai');
    if (!apiKey) throw new Error('OPENAI_API_KEY 또는 AI_OPENAI_KEY가 필요합니다.');
    return this.embedOpenAiManyWithKey(texts, model, dims, apiKey);
  }

  private async embedOpenAiManyWithKey(texts: string[], model: string, dims: number, apiKey: string): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const batch of this.chunkArray(texts, 96)) {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: batch, dimensions: dims }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const rows = data.data ?? [];
      if (rows.length !== batch.length) throw new Error('OpenAI embedding 응답 개수가 요청과 다릅니다.');
      results.push(...rows.map((row) => ({ provider: 'openai', model, dims, vector: new Float32Array(row.embedding) })));
    }
    return results;
  }

  /**
   * self-host 임베딩(Ollama 등) — OpenAI 호환 /v1/embeddings를 쓴다.
   * API 키가 없고, dimensions 파라미터도 지원하지 않으므로 보내지 않는다(모델이 정한 차원을 그대로 받는다).
   * 같은 장비에서 도는 것을 전제하므로 rate limit 대비 간격은 두지 않는다.
   */
  private async embedOllamaMany(texts: string[], model: string, dims: number, baseUrl: string): Promise<EmbeddingResult[]> {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/embeddings`;
    const results: EmbeddingResult[] = [];
    for (const batch of this.chunkArray(texts, 32)) {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: batch }),
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`임베딩 서버(${endpoint})에 연결할 수 없습니다: ${message}`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Ollama embeddings ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const rows = data.data ?? [];
      if (rows.length !== batch.length) throw new Error('Ollama embedding 응답 개수가 요청과 다릅니다.');
      results.push(
        ...rows.map((row) => ({
          provider: 'ollama',
          model,
          dims: row.embedding.length || dims,
          vector: new Float32Array(row.embedding),
        })),
      );
    }
    return results;
  }

  private async embedMistralMany(texts: string[], model: string, dims: number): Promise<EmbeddingResult[]> {
    const apiKey = await this.getApiKey('mistral');
    if (!apiKey) throw new Error('MISTRAL_API_KEY 또는 AI_MISTRAL_KEY가 필요합니다.');
    return this.embedMistralManyWithKey(texts, model, dims, apiKey);
  }

  private async embedMistralManyWithKey(texts: string[], model: string, dims: number, apiKey: string): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    // Mistral은 요청당 "총 토큰" 한도가 있다(개수 한도가 아니다).
    // 개수로만 끊으면 긴 청크가 몰릴 때 400 "Too many tokens overall"이 난다.
    const batches = this.batchByTokenBudget(texts);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // 배치 사이에 간격을 둔다. 재색인은 수백 회 연속 호출이라 간격 없이 보내면 곧바로 429가 난다.
      if (i > 0) await this.sleep(MISTRAL_BATCH_INTERVAL_MS);
      const res = await this.fetchMistralEmbeddings(batch, model, apiKey);
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const rows = data.data ?? [];
      if (rows.length !== batch.length) throw new Error('Mistral embedding 응답 개수가 요청과 다릅니다.');
      results.push(...rows.map((row) => ({ provider: 'mistral', model, dims: row.embedding.length || dims, vector: new Float32Array(row.embedding) })));
    }
    return results;
  }

  /** Mistral 임베딩 호출 — 429(rate limit)는 백오프 후 재시도한다. */
  private async fetchMistralEmbeddings(batch: string[], model: string, apiKey: string): Promise<Response> {
    let delay = MISTRAL_RETRY_BASE_MS;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: batch }),
      });
      if (res.ok) return res;
      const body = await res.text();
      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt >= MISTRAL_MAX_RETRY) {
        throw new Error(`Mistral embeddings ${res.status}: ${body.slice(0, 300)}`);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
      this.logger.warn(`Mistral 임베딩 ${res.status} — ${waitMs}ms 후 재시도 (${attempt}/${MISTRAL_MAX_RETRY})`);
      await this.sleep(waitMs);
      delay = Math.min(delay * 2, MISTRAL_RETRY_MAX_MS);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mistral 임베딩용 배칭 — 요청당 총 토큰 예산으로 묶는다.
   * 토큰 수는 문자 길이로 보수적으로 추정한다(한국어는 글자당 1토큰을 넘기도 한다).
   * 예산을 혼자 넘는 텍스트는 단독 요청으로 보낸다(쪼개면 벡터가 달라지므로 자르지 않는다).
   */
  private batchByTokenBudget(texts: string[], budget = MISTRAL_BATCH_TOKEN_BUDGET, maxItems = 64): string[][] {
    const out: string[][] = [];
    let current: string[] = [];
    let currentCost = 0;
    for (const text of texts) {
      const cost = text.length;
      if (current.length > 0 && (currentCost + cost > budget || current.length >= maxItems)) {
        out.push(current);
        current = [];
        currentCost = 0;
      }
      current.push(text);
      currentCost += cost;
    }
    if (current.length > 0) out.push(current);
    return out;
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  /** 개발/테스트 fallback: 의미 검색 품질은 낮지만 기능 검증은 가능하다. */
  private embedLocalHash(text: string, dims: number): Float32Array {
    const vector = new Float32Array(dims);
    const tokens = text.toLowerCase().match(/[0-9a-zA-Z가-힣_]+/g) ?? [];
    for (const token of tokens) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i += 1) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const idx = Math.abs(hash) % dims;
      vector[idx] += 1;
    }
    let norm = 0;
    for (let i = 0; i < vector.length; i += 1) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vector.length; i += 1) vector[i] = vector[i] / norm;
    return vector;
  }
}
