/**
 * @file src/modules/ai/ai.service.ts
 * @description AI 채팅 서비스 — Mistral 연동 (1단계: 일반 대화)
 *
 * 초보자 가이드:
 * 1. API 키: process.env.MISTRAL_API_KEY (.env, DB 저장 안 함)
 * 2. provider/model/활성화: SYS_CONFIGS의 AI 그룹(AI_PROVIDER/AI_MODEL/AI_ENABLED)
 * 3. getStatus(): config 탭 상태 표시용 (키 원문 미반환)
 * 4. chat(): 메시지 배열 → Mistral chat.complete → 응답
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mistral } from '@mistralai/mistralai';
import { SysConfig } from '../../entities/sys-config.entity';
import { AiChatMessageDto } from './dto/ai-chat.dto';

/** 1단계 시스템 프롬프트 (일반 대화, text-to-SQL 없음) */
const SYSTEM_PROMPT =
  '당신은 HANES MES(제조실행시스템) 운영을 돕는 AI 비서입니다. 한국어로 간결하고 정확하게 답합니다.';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(SysConfig)
    private readonly sysConfigRepo: Repository<SysConfig>,
  ) {}

  /** SYS_CONFIGS에서 단일 설정값 조회 (없으면 기본값) */
  private async getConfigValue(configKey: string, def: string): Promise<string> {
    const row = await this.sysConfigRepo.findOne({ where: { configKey } });
    return row?.configValue ?? def;
  }

  /** config 탭 표시용 상태 (키 원문은 반환하지 않는다) */
  async getStatus() {
    const [enabled, provider, model] = await Promise.all([
      this.getConfigValue('AI_ENABLED', 'Y'),
      this.getConfigValue('AI_PROVIDER', 'mistral'),
      this.getConfigValue('AI_MODEL', 'mistral-large-latest'),
    ]);
    return {
      enabled: enabled === 'Y',
      provider,
      model,
      keyConfigured: !!process.env.MISTRAL_API_KEY,
    };
  }

  /** 일반 대화 채팅 */
  async chat(messages: AiChatMessageDto[]): Promise<{ content: string }> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        'Mistral API 키가 설정되지 않았습니다. 서버 .env의 MISTRAL_API_KEY를 확인해 주세요.',
      );
    }

    const enabled = await this.getConfigValue('AI_ENABLED', 'Y');
    if (enabled !== 'Y') {
      throw new BadRequestException(
        'AI 채팅이 비활성화되어 있습니다. 시스템 환경설정에서 AI를 활성화해 주세요.',
      );
    }

    const model = await this.getConfigValue('AI_MODEL', 'mistral-large-latest');
    const client = new Mistral({ apiKey });

    try {
      const res = await client.chat.complete({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      });
      const content = res.choices?.[0]?.message?.content;
      return { content: typeof content === 'string' ? content : '' };
    } catch (error: unknown) {
      this.logger.error(
        `Mistral 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }
}
