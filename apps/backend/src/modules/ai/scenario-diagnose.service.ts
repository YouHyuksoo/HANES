/**
 * @file src/modules/ai/scenario-diagnose.service.ts
 * @description 시나리오 실행 실패의 원인을 AI 에게 묻는다
 *
 * 왜 일반 채팅을 쓰지 않는가:
 * 일반 채팅은 도움말 문서를 근거로 답하고, 근거에 없으면 "확인되지 않습니다"로 끝난다.
 * 그게 옳은 동작이다 — 업무 질문에 지어내면 안 되니까. 그런데 실패 진단은 성격이 다르다.
 * 근거가 문서가 아니라 **그 순간의 화면 상태와 이벤트**이고, 그건 어느 문서에도 없다.
 * 그래서 별도 프롬프트로 분리한다.
 *
 * 무엇을 받는가:
 *   - 시나리오 정의(어느 단계에서 무엇을 하려 했는지)
 *   - 멈춘 이유(드라이버가 만든 사람 문장)
 *   - 그 시점 활동 이벤트(API 응답·토스트·JS 에러)
 *   - 그 시점 화면 스냅샷(대상 요소 상태, 입력칸 값과 선택지, 빨간 문구)
 *
 * 실제 사례(2026-09-14): "저장 버튼이 비활성"으로 멈췄는데 이벤트는 0건이었고,
 * 진짜 원인은 제조사 select 의 options 에 넣으려던 코드가 없어 값이 빈 채로 남은 것이었다.
 * 스냅샷의 options 를 보면 AI 가 그걸 짚을 수 있다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiScenariosService } from '../ai-scenarios/ai-scenarios.service';
import type { ScenarioDiagnoseDto } from './dto/scenario-diagnose.dto';

/** 프롬프트 폭주 방지 — 이벤트는 실패 직전 것이 유용하다 */
const MAX_EVENTS = 30;

const SYSTEM_PROMPT = `당신은 HANES MES 화면 자동 실행(시나리오 드라이버)의 실패를 진단한다.
드라이버는 사람과 똑같이 화면 버튼만 누른다. 실패했다는 것은 그 자리에서 사람이 눌러도 안 됐다는 뜻이다.

받은 증거만으로 판단한다. 증거에 없는 원인을 지어내지 않는다.
증거가 원인을 가리키지 못하면 "증거만으로는 단정할 수 없다"고 쓰고, 무엇을 더 확인해야 하는지 적는다.

자주 있는 원인 유형:
- 선택 필드(select)의 options 에 넣으려던 값이 없어서 값이 빈 채로 남았다 → 저장 버튼이 잠긴다
- 필수 입력이 비어 있다
- 대상 요소를 찾지 못했다(화면이 아직 안 떴거나, 조건이 안 맞아 그 버튼이 렌더되지 않았다)
- API 가 4xx/5xx 로 거절했다 → 그 메시지가 진짜 원인이다
- 선행 데이터 상태가 안 맞는다(잔량 0, 마감된 라인, 이미 처리됨)

한국어로 답한다. 형식은 정확히 이 세 줄 묶음이다. 군더더기 인사말을 쓰지 않는다.

**원인**: 한 문장.
**근거**: 증거의 어느 부분인지 구체적으로(필드명·값·상태코드·메시지).
**해결**: 현장 사용자가 지금 화면에서 할 수 있는 행동. 화면에서 할 수 없는 일(기준정보 등록 등)이면 누구에게 무엇을 요청해야 하는지 쓴다.`;

@Injectable()
export class ScenarioDiagnoseService {
  private readonly logger = new Logger(ScenarioDiagnoseService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly scenarios: AiScenariosService,
  ) {}

  async diagnose(dto: ScenarioDiagnoseDto): Promise<{ answer: string }> {
    const scenario = this.scenarios.get(dto.scenarioId);
    const step = scenario.steps[dto.stepIndex];

    const plan = scenario.steps
      .map((s, i) => {
        const mark = i === dto.stepIndex ? ' ← 여기서 멈춤' : i < dto.stepIndex ? ' (통과)' : '';
        return `${i + 1}. ${s.note ?? s.action}${mark}`;
      })
      .join('\n');

    const events = (dto.events ?? []).slice(-MAX_EVENTS);

    const user = [
      `절차: ${scenario.title} (${scenario.id})`,
      `단계 계획:\n${plan}`,
      ``,
      `멈춘 단계: ${dto.stepIndex + 1}번 — ${JSON.stringify(step ?? null)}`,
      `드라이버가 남긴 이유: ${dto.reason}`,
      `실행 값: ${JSON.stringify(dto.vars ?? {})}`,
      ``,
      `그 시점 화면 상태:\n${dto.snapshot ? JSON.stringify(dto.snapshot, null, 1) : '(수집되지 않음)'}`,
      ``,
      `그 시점 활동 이벤트(${events.length}건):\n${events.length ? JSON.stringify(events, null, 1) : '(없음 — API 호출도 토스트도 없었다는 뜻이다. 화면 상태에서 원인을 찾아라)'}`,
    ].join('\n');

    this.logger.log(`시나리오 실패 진단: ${dto.scenarioId} step=${dto.stepIndex} events=${events.length}`);

    const answer = await this.aiService.complete([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: user },
    ]);
    return { answer };
  }
}
