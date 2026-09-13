/**
 * @file src/modules/ai/ai.service.ts
 * @description AI 채팅 서비스 — provider 추상화(Mistral/OpenAI)
 *
 * - provider/model/활성화: SYS_CONFIGS AI 그룹(AI_PROVIDER/AI_MODEL/AI_ENABLED)
 * - API 키: SYS_CONFIGS(AI_MISTRAL_KEY/AI_OPENAI_KEY, UI 입력) 우선, 없으면 .env(MISTRAL_API_KEY/OPENAI_API_KEY)
 * - complete(): provider 분기 + 429 자동 재시도. 1·2단계 공통.
 * - test(): 입력 키/provider/model로 즉석 연결 확인
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mistral } from '@mistralai/mistralai';
import { AiOauthService } from './ai-oauth.service';
import { SysConfig } from '../../entities/sys-config.entity';
import { AiChatAttachmentDto, AiChatMessageDto } from './dto/ai-chat.dto';

const SYSTEM_PROMPT =
  '당신은 HANES MES(제조실행시스템) 운영을 돕는 AI 비서입니다. 한국어로 간결하고 정확하게 답합니다.';

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  // mistral-large는 일부 구독 티어에서 403(tier_not_allowed)이 난다. 기본값은 티어 제약이 없는 medium을 쓴다.
  mistral: 'mistral-medium-latest',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-oss-120b:free',
  // OAuth 로 붙은 ChatGPT 계정. 플랫폼 API(api.openai.com)가 아니라 ChatGPT 백엔드로 나간다.
  // 모델명도 플랫폼 것과 다르다 — 사용 가능 목록은 codex/models 가 계정별로 내려준다.
  'openai-oauth': 'gpt-6-astra',
};

type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string; attachments?: AiChatAttachmentDto[] };
type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
type OpenAIMessage = { role: 'system' | 'user' | 'assistant'; content: string | OpenAIContentPart[] };

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(SysConfig)
    private readonly sysConfigRepo: Repository<SysConfig>,
    private readonly oauth: AiOauthService,
  ) {}

  private async getConfigValue(configKey: string, def: string): Promise<string> {
    const row = await this.sysConfigRepo.findOne({ where: { configKey } });
    // 빈 값·공백만 저장된 행은 미설정으로 본다. 공백 모델명으로 호출하면 원인을 알기 어려운 400이 난다.
    const value = row?.configValue?.trim();
    return value ? value : def;
  }

  /** 키: sys-config(UI 입력) 우선, 없으면 .env */
  private async getApiKey(provider: string): Promise<string | undefined> {
    // OAuth provider 는 저장된 access_token 을 Bearer 로 쓴다.
    // 만료가 임박하면 getAccessToken 이 refresh_token 으로 먼저 갱신한다.
    if (provider === AiOauthService.PROVIDER) {
      return (await this.oauth.getAccessToken()) ?? undefined;
    }
    const cfg = await this.getConfigValue(`AI_${provider.toUpperCase()}_KEY`, '');
    if (cfg.trim()) return cfg.trim();
    switch (provider) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY;
      default:
        return process.env.MISTRAL_API_KEY;
    }
  }

  /** config 탭 표시용 상태 (키 원문은 반환하지 않는다) */
  async getStatus() {
    const [enabled, provider] = await Promise.all([
      this.getConfigValue('AI_ENABLED', 'Y'),
      this.getConfigValue('AI_PROVIDER', 'mistral'),
    ]);
    const model = await this.getConfigValue('AI_MODEL', PROVIDER_DEFAULT_MODEL[provider] ?? 'mistral-medium-latest');
    const apiKey = await this.getApiKey(provider);
    return {
      enabled: enabled === 'Y',
      provider,
      model,
      keyConfigured: !!apiKey,
    };
  }

  /**
   * LLM 호출 코어 (provider 분기 + 429 재시도). 호출자가 전체 messages(system 포함)를 구성한다.
   *
   * onDelta 를 주면 생성되는 대로 조각을 흘려보낸다. 최종 답변처럼 사용자에게 그대로
   * 보여주는 호출에만 넘긴다 — 질의이해·리랭크·SQL 생성처럼 JSON 을 받아 파싱하는
   * 호출에 넘기면 원시 JSON 이 채팅창에 흘러나온다.
   *
   * 스트리밍을 지원하지 않는 provider 는 다 받은 뒤 한 번에 흘린다. 호출부는
   * "조각이 오면 붙인다" 한 가지 방식만 알면 된다.
   */
  async complete(messages: LlmMessage[], onDelta?: (chunk: string) => void): Promise<string> {
    const enabled = await this.getConfigValue('AI_ENABLED', 'Y');
    if (enabled !== 'Y') {
      throw new BadRequestException('AI 채팅이 비활성화되어 있습니다. 시스템 환경설정에서 AI를 활성화해 주세요.');
    }
    const provider = await this.getConfigValue('AI_PROVIDER', 'mistral');
    const model = await this.getConfigValue('AI_MODEL', PROVIDER_DEFAULT_MODEL[provider] ?? 'mistral-medium-latest');
    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      throw new BadRequestException(
        provider === AiOauthService.PROVIDER
          ? 'OpenAI 계정이 연결되지 않았거나 연결이 만료되었습니다. 시스템 환경설정 > AI에서 다시 연결해 주세요.'
          : `${provider} API 키가 설정되지 않았습니다. 시스템 환경설정 > AI에서 키를 등록해 주세요.`,
      );
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.callProvider(provider, model, apiKey, messages, onDelta);
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        const statusCode = typeof error === 'object' && error !== null ? Reflect.get(error, 'statusCode') : undefined;
        const isRate = /429|rate ?limit|too many/i.test(detail) || statusCode === 429;
        if (isRate && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        this.logger.error(`${provider} 호출 실패: ${detail}`);
        throw new BadRequestException(
          isRate
            ? 'AI 요청이 많아 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. (rate limit)'
            : `AI 응답 생성 실패: ${detail}`,
        );
      }
    }
    throw new BadRequestException('AI 응답 생성에 실패했습니다.');
  }

  private async callProvider(
    provider: string,
    model: string,
    apiKey: string,
    messages: LlmMessage[],
    onDelta?: (chunk: string) => void,
  ): Promise<string> {
    switch (provider) {
      case 'openai':
        return this.emitWhole(this.callOpenAI(model, apiKey, messages), onDelta);
      case 'openrouter':
        return this.emitWhole(this.callOpenRouter(model, apiKey, messages), onDelta);
      case AiOauthService.PROVIDER:
        // 유일하게 진짜로 흘려보내는 경로. 나머지는 응답 전체를 받은 뒤 한 번에 흘린다.
        return this.callChatGptBackend(model, apiKey, messages, onDelta);
      default:
        return this.emitWhole(this.callMistral(model, apiKey, messages), onDelta);
    }
  }

  /** 스트리밍을 지원하지 않는 provider 를 호출부 입장에서 같은 모양으로 보이게 한다 */
  private async emitWhole(pending: Promise<string>, onDelta?: (chunk: string) => void): Promise<string> {
    const content = await pending;
    if (content) onDelta?.(content);
    return content;
  }

  private async callMistral(model: string, apiKey: string, messages: LlmMessage[]): Promise<string> {
    if (this.hasImageAttachments(messages)) {
      throw new BadRequestException('현재 Mistral 설정은 이미지 첨부 분석을 지원하지 않습니다. OpenAI 또는 vision 지원 OpenRouter 모델로 변경해 주세요.');
    }
    const client = new Mistral({ apiKey });
    const res = await client.chat.complete({ model, messages });
    const content = res.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  }

  /** OpenAI 호환 Chat Completions 호출 (OpenAI / OpenRouter 공통) */
  private async callOpenAICompatible(
    url: string,
    label: string,
    model: string,
    apiKey: string,
    messages: LlmMessage[],
    extraHeaders: Record<string, string> = {},
  ): Promise<string> {
    const providerMessages = this.toOpenAICompatibleMessages(messages);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify({ model, messages: providerMessages }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${label} ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    // OpenRouter는 HTTP 200으로도 본문에 error를 담아 줄 수 있다.
    if (data.error?.message) throw new Error(`${label}: ${data.error.message}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  private async callOpenAI(model: string, apiKey: string, messages: LlmMessage[]): Promise<string> {
    return this.callOpenAICompatible('https://api.openai.com/v1/chat/completions', 'OpenAI', model, apiKey, messages);
  }

  /**
   * ChatGPT 계정(OAuth)으로 붙는 경로 — chatgpt.com/backend-api/codex/responses
   *
   * 왜 플랫폼 API(api.openai.com/v1/chat/completions)가 아닌가:
   * OAuth 로 받은 토큰은 플랫폼 org 로도 인증은 되지만 그쪽은 API 크레딧으로 과금된다.
   * ChatGPT 구독은 API 크레딧을 주지 않아서 크레딧이 없으면 429("no credits remaining")가 난다.
   * 구독을 쓰려면 Codex CLI 와 같은 경로로 나가야 한다(2026-09-13 실측).
   *
   * 이 경로의 조건 3가지:
   * 1. `chatgpt-account-id` 헤더 — access_token claims 의 chatgpt_account_id
   * 2. `version` / `originator` 헤더 — 서버가 클라이언트 버전으로 모델 노출을 가른다.
   *    낮은 버전을 보내면 최신 모델이 목록에서 빠지고 400("not supported")이 난다.
   * 3. Chat Completions 가 아니라 Responses 형식(input/instructions), 응답은 SSE 스트림
   */
  private static readonly CHATGPT_BACKEND = 'https://chatgpt.com/backend-api/codex/responses';
  private static readonly CODEX_CLIENT_VERSION = '0.154.0';

  private async callChatGptBackend(
    model: string,
    accessToken: string,
    messages: LlmMessage[],
    onDelta?: (chunk: string) => void,
  ): Promise<string> {
    if (this.hasImageAttachments(messages)) {
      throw new BadRequestException(
        '현재 ChatGPT 계정 연결(OAuth)에서는 이미지 첨부 분석을 지원하지 않습니다. OpenAI API 키 방식으로 변경해 주세요.',
      );
    }
    const accountId = (await this.oauth.getCredentials())?.accountId;
    if (!accountId) {
      throw new BadRequestException(
        'ChatGPT 계정 ID를 찾지 못했습니다. 시스템 환경설정 > AI에서 다시 연결해 주세요.',
      );
    }

    // Responses 형식: system 은 instructions 로, 나머지는 input 배열로 옮긴다.
    const instructions = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const input = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        type: 'message',
        role: m.role,
        content: [{ type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.content }],
      }));

    const version = AiService.CODEX_CLIENT_VERSION;
    const res = await fetch(AiService.CHATGPT_BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
        'chatgpt-account-id': accountId,
        'User-Agent': `codex_cli_rs/${version}`,
        originator: 'codex_cli_rs',
        version,
      },
      body: JSON.stringify({
        model,
        instructions: instructions || SYSTEM_PROMPT,
        input,
        tools: [],
        tool_choice: 'auto',
        parallel_tool_calls: false,
        store: false,
        stream: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ChatGPT ${res.status}: ${body.slice(0, 300)}`);
    }
    return this.readResponsesStream(res, onDelta);
  }

  /** Responses SSE 스트림에서 본문 텍스트만 모은다. onDelta 가 있으면 조각을 즉시 넘긴다. */
  private async readResponsesStream(res: Response, onDelta?: (chunk: string) => void): Promise<string> {
    if (!res.body) throw new Error('ChatGPT 응답 본문이 비어 있습니다.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let failed: string | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 는 빈 줄로 이벤트를 끊는다. 마지막 조각은 다음 청크와 이어붙여야 한다.
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let event: { type?: string; delta?: string; response?: { error?: { message?: string } } };
          try {
            event = JSON.parse(payload) as typeof event;
          } catch {
            continue;
          }
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            text += event.delta;
            onDelta?.(event.delta);
          } else if (event.type === 'response.failed') {
            failed = event.response?.error?.message ?? '알 수 없는 오류';
          }
        }
      }
    }
    if (failed) throw new Error(`ChatGPT: ${failed}`);
    return text;
  }

  private async callOpenRouter(model: string, apiKey: string, messages: LlmMessage[]): Promise<string> {
    return this.callOpenAICompatible(
      'https://openrouter.ai/api/v1/chat/completions',
      'OpenRouter',
      model,
      apiKey,
      messages,
      { 'HTTP-Referer': 'https://hswbs.haengsung.com', 'X-Title': 'HANES MES' },
    );
  }

  /** 입력 키/provider/model로 즉석 연결 확인 (키 미입력 시 저장된 키 사용) */
  async test(provider: string, model: string, apiKey?: string): Promise<{ ok: boolean; message: string }> {
    const source = apiKey?.trim() ? 'input' : 'config/.env';
    const key = apiKey?.trim() || (await this.getApiKey(provider));
    if (!key) return { ok: false, message: `API 키가 없습니다. (provider=${provider}, source=${source})` };
    const m = model || PROVIDER_DEFAULT_MODEL[provider] || 'mistral-medium-latest';
    try {
      const content = await this.callProvider(provider, m, key, [{ role: 'user', content: 'Reply with: OK' }]);
      return { ok: true, message: `연결 성공 (${provider}/${m}): ${content.slice(0, 60)}` };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message.slice(0, 160) : '연결 실패';
      return { ok: false, message: `[${provider}/${m}, key=${source}/${key.length}자] ${msg}` };
    }
  }

  /** 일반 대화 채팅 (system 프롬프트 주입) */
  async chat(messages: AiChatMessageDto[]): Promise<{ content: string }> {
    const content = await this.complete([{ role: 'system', content: SYSTEM_PROMPT }, ...messages]);
    return { content };
  }

  private hasImageAttachments(messages: LlmMessage[]): boolean {
    return messages.some((message) => (message.attachments ?? []).some((attachment) => attachment.type === 'image'));
  }

  private toOpenAICompatibleMessages(messages: LlmMessage[]): OpenAIMessage[] {
    return messages.map((message) => {
      const images = (message.attachments ?? []).filter((attachment) => attachment.type === 'image');
      if (images.length === 0) return { role: message.role, content: message.content };
      const parts: OpenAIContentPart[] = [
        { type: 'text', text: message.content || '첨부 이미지를 분석해 주세요.' },
        ...images.map((image) => ({ type: 'image_url' as const, image_url: { url: image.dataUrl } })),
      ];
      return { role: message.role, content: parts };
    });
  }
}
