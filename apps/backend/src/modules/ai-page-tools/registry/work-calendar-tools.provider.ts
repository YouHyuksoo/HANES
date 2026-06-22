import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { WorkCalendarService } from '../../master/services/work-calendar.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

/**
 * 생산월력관리(/master/work-calendar) AI 페이지 도구 매니페스트 — 근무캘린더 헤더 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 *
 * 참고: 일별 근무(days) 일괄저장·연간생성·복사·확정 등은 다단계 트랜잭션이라
 *       1차 도구 범위에서는 제외하고, 캘린더 헤더 등록/수정/삭제만 제공한다.
 */
export const WORK_CALENDAR_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.work-calendar',
  route: '/master/work-calendar',
  title: '생산월력관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createWorkCalendar',
      label: '근무캘린더 등록',
      description:
        '새 근무캘린더(헤더)를 등록한다. calendarId(캘린더ID)·calendarYear(연도 YYYY) 필요. ' +
        'processCd(공정코드)는 선택이며 미지정 시 공장 기본 캘린더로 등록된다(null). ' +
        'defaultShiftCount(기본 교대수 1~3, 기본 1), defaultShifts(기본 교대 CSV, 예: "DAY,NIGHT"), remark(비고)는 선택. ' +
        '상태는 DRAFT로 생성된다. 사용자 문구 매핑 예: "1교대"→defaultShiftCount=1, "주야 2교대"→defaultShiftCount=2.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        calendarId: { type: 'string', required: true },
        calendarYear: { type: 'string', required: true },
        processCd: { type: 'string', required: false },
        defaultShiftCount: { type: 'number', required: false },
        defaultShifts: { type: 'string', required: false },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateWorkCalendar',
      label: '근무캘린더 수정',
      description:
        '기존 근무캘린더(헤더) 정보를 수정한다. calendarId로 대상을 지정하고, 바꿀 항목만 넣는다. ' +
        '수정 가능 항목: calendarYear(연도), processCd(공정코드, ""·null=공장 기본), ' +
        'defaultShiftCount(기본 교대수 1~3), defaultShifts(기본 교대 CSV), remark(비고). ' +
        '확정(CONFIRMED) 상태 캘린더는 수정할 수 없다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        calendarId: { type: 'string', required: true },
        calendarYear: { type: 'string', required: false },
        processCd: { type: 'string', required: false },
        defaultShiftCount: { type: 'number', required: false },
        defaultShifts: { type: 'string', required: false },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteWorkCalendar',
      label: '근무캘린더 삭제',
      description:
        'calendarId로 지정한 근무캘린더를 삭제한다. 하위 일별 근무(days)도 함께 삭제된다. ' +
        '확정(CONFIRMED) 상태 캘린더는 삭제할 수 없다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { calendarId: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 생산월력관리(/master/work-calendar) 도구 Provider — 근무캘린더 헤더 CRUD.
 * 모든 도구는 기존 WorkCalendarService를 재사용(중복체크·확정상태 가드·멀티테넌시 준수).
 */
@Injectable()
export class WorkCalendarToolsProvider implements PageToolProvider {
  readonly pageId = WORK_CALENDAR_TOOL_MANIFEST.pageId;
  readonly manifest = WORK_CALENDAR_TOOL_MANIFEST;

  constructor(@Optional() private readonly calendarService?: WorkCalendarService) {}

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    ctx: PageToolContext,
  ): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createWorkCalendar':
        return this.createWorkCalendar(input, company, plant);
      case 'updateWorkCalendar':
        return this.updateWorkCalendar(input, company, plant);
      case 'deleteWorkCalendar':
        return this.deleteWorkCalendar(input, company, plant);
      default:
        throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }
  }

  private str(v: unknown): string {
    return String(v ?? '').trim();
  }

  private result(toolName: string, summary: string, result?: Record<string, unknown>): AiPageToolWriteResult {
    return { status: 'ok', toolName, summary, result };
  }

  /** 1~3 범위의 교대수 파싱 */
  private parseShiftCount(v: unknown): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 3) {
      throw new BadRequestException(`기본 교대수는 1~3 사이의 정수여야 합니다: ${this.str(v)}`);
    }
    return n;
  }

  private async createWorkCalendar(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.calendarService) throw new BadRequestException('생산월력 서비스가 준비되지 않았습니다.');
    const calendarId = this.str(input.calendarId);
    const calendarYear = this.str(input.calendarYear);
    if (!calendarId || !calendarYear) throw new BadRequestException('캘린더ID·연도(YYYY)가 필요합니다.');

    const dto: {
      calendarId: string;
      calendarYear: string;
      processCd?: string;
      defaultShiftCount?: number;
      defaultShifts?: string;
      remark?: string;
    } = { calendarId, calendarYear };
    if (input.processCd !== undefined) {
      const processCd = this.str(input.processCd);
      if (processCd) dto.processCd = processCd;
    }
    if (input.defaultShiftCount !== undefined) dto.defaultShiftCount = this.parseShiftCount(input.defaultShiftCount);
    if (input.defaultShifts !== undefined) {
      const defaultShifts = this.str(input.defaultShifts);
      if (defaultShifts) dto.defaultShifts = defaultShifts;
    }
    if (input.remark !== undefined) {
      const remark = this.str(input.remark);
      if (remark) dto.remark = remark;
    }

    const saved = await this.calendarService.create(dto, company, plant);
    return this.result(
      'createWorkCalendar',
      `근무캘린더 '${saved.calendarId}'(${saved.calendarYear}년)를 등록했습니다.`,
      { calendarId: saved.calendarId, calendarYear: saved.calendarYear, status: saved.status },
    );
  }

  private async updateWorkCalendar(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.calendarService) throw new BadRequestException('생산월력 서비스가 준비되지 않았습니다.');
    const calendarId = this.str(input.calendarId);
    if (!calendarId) throw new BadRequestException('캘린더ID가 필요합니다.');

    const dto: {
      calendarYear?: string;
      processCd?: string;
      defaultShiftCount?: number;
      defaultShifts?: string;
      remark?: string;
    } = {};
    if (input.calendarYear !== undefined) dto.calendarYear = this.str(input.calendarYear);
    if (input.processCd !== undefined) dto.processCd = this.str(input.processCd);
    if (input.defaultShiftCount !== undefined) dto.defaultShiftCount = this.parseShiftCount(input.defaultShiftCount);
    if (input.defaultShifts !== undefined) dto.defaultShifts = this.str(input.defaultShifts);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);

    if (Object.keys(dto).length === 0) throw new BadRequestException('수정할 항목이 없습니다.');

    await this.calendarService.update(calendarId, dto, company, plant);
    return this.result('updateWorkCalendar', `근무캘린더 ${calendarId}를 수정했습니다.`, { calendarId });
  }

  private async deleteWorkCalendar(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.calendarService) throw new BadRequestException('생산월력 서비스가 준비되지 않았습니다.');
    const calendarId = this.str(input.calendarId);
    if (!calendarId) throw new BadRequestException('캘린더ID가 필요합니다.');

    await this.calendarService.delete(calendarId, company, plant);
    return this.result('deleteWorkCalendar', `근무캘린더 ${calendarId}를 삭제했습니다.`, { calendarId });
  }
}
