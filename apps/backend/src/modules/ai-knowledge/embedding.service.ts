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
}

const EMBEDDING_DEFAULTS: Record<string, { model: string; dims: number }> = {
  mistral: { model: 'mistral-embed', dims: 1024 },
  openai: { model: 'text-embedding-3-small', dims: 1536 },
};

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
    const provider = configuredProvider === 'openai' ? 'openai' : 'mistral';
    const providerDefault = EMBEDDING_DEFAULTS[provider];
    const model = await this.getConfigValue('AI_EMBEDDING_MODEL', providerDefault.model);
    const dims = Number(await this.getConfigValue('AI_EMBEDDING_DIMS', String(providerDefault.dims))) || providerDefault.dims;
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
    return texts.map((text) => ({ provider: cfg.provider, model: cfg.model, dims: cfg.dims, vector: this.embedLocalHash(text, cfg.dims) }));
  }


  async test(provider: string, model: string, dims: number, apiKey?: string): Promise<{ ok: boolean; message: string }> {
    const normalized = provider.toLowerCase() === 'openai' ? 'openai' : 'mistral';
    const defaultCfg = EMBEDDING_DEFAULTS[normalized];
    const targetModel = model || defaultCfg.model;
    const targetDims = Number(dims) || defaultCfg.dims;
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

  private async embedMistralMany(texts: string[], model: string, dims: number): Promise<EmbeddingResult[]> {
    const apiKey = await this.getApiKey('mistral');
    if (!apiKey) throw new Error('MISTRAL_API_KEY 또는 AI_MISTRAL_KEY가 필요합니다.');
    return this.embedMistralManyWithKey(texts, model, dims, apiKey);
  }

  private async embedMistralManyWithKey(texts: string[], model: string, dims: number, apiKey: string): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const batch of this.chunkArray(texts, 96)) {
      const res = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: batch }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Mistral embeddings ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const rows = data.data ?? [];
      if (rows.length !== batch.length) throw new Error('Mistral embedding 응답 개수가 요청과 다릅니다.');
      results.push(...rows.map((row) => ({ provider: 'mistral', model, dims: row.embedding.length || dims, vector: new Float32Array(row.embedding) })));
    }
    return results;
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
