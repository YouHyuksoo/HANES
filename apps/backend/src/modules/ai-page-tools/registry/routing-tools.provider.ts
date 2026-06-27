import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { RoutingGroupService } from '../../master/services/routing-group.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

/**
 * 라우팅(/master/routing) AI 페이지 도구 매니페스트 — 라우팅 그룹·공정순서 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const ROUTING_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.routing',
  route: '/master/routing',
  title: '라우팅',
  executionLevel: 'approval-required',
  tools: [
    // ── 라우팅 그룹 ───────────────────────────────────────
    {
      name: 'createRoutingGroup',
      label: '라우팅 그룹 등록',
      description:
        '새 라우팅 그룹을 등록한다. routingCode(라우팅 그룹 코드)·routingName(그룹명)·itemCode(연결 품목 코드) 필요. ' +
        'description(설명)·useYn(사용여부 Y|N, 기본 Y)은 선택. 보통 라우팅 그룹은 완제품 품목코드와 1:1로 묶이므로 itemCode를 정확히 지정한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        routingCode: { type: 'string', required: true },
        routingName: { type: 'string', required: true },
        itemCode: { type: 'string', required: true },
        description: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateRoutingGroup',
      label: '라우팅 그룹 수정',
      description:
        '기존 라우팅 그룹을 수정한다. routingCode로 대상을 지정하고, 바꿀 항목(routingName/itemCode/description/useYn)만 넣는다. useYn은 Y|N.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        routingCode: { type: 'string', required: true },
        routingName: { type: 'string', required: false },
        itemCode: { type: 'string', required: false },
        description: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteRoutingGroup',
      label: '라우팅 그룹 삭제',
      description: 'routingCode로 지정한 라우팅 그룹을 삭제한다. 하위 공정순서·양품조건·투입자재가 함께 삭제된다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { routingCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    // ── 공정순서 ─────────────────────────────────────────
    {
      name: 'createRoutingProcess',
      label: '공정순서 추가',
      description:
        '라우팅 그룹에 공정순서를 추가한다. routingCode(라우팅 그룹 코드)·seq(공정 순서, 1 이상 정수)·processCode(공정 코드) 필요. ' +
        '공정명은 공정코드 기준 PROCESS_MASTERS에서 자동 적용되므로 별도로 넣지 않아도 된다. ' +
        'equipType(설비타입)·stdTime(표준시간)·setupTime(셋업시간)·sampleInspectYn(Y|N)·issueLabelType(NONE|BUNDLE|SG|FG, 기본 NONE)은 선택.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        routingCode: { type: 'string', required: true },
        seq: { type: 'number', required: true },
        processCode: { type: 'string', required: true },
        equipType: { type: 'string', required: false },
        stdTime: { type: 'number', required: false },
        setupTime: { type: 'number', required: false },
        sampleInspectYn: { type: 'string', required: false, enum: ['Y', 'N'] },
        issueLabelType: { type: 'string', required: false, enum: ['NONE', 'BUNDLE', 'SG', 'FG'] },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateRoutingProcess',
      label: '공정순서 수정',
      description:
        'routingCode+seq로 지정한 공정순서를 수정한다. 바꿀 항목만 넣는다. ' +
        'processCode를 바꾸면 공정명/공정유형이 PROCESS_MASTERS 기준으로 다시 적용된다. ' +
        'equipType/stdTime/setupTime/sampleInspectYn(Y|N)·issueLabelType(NONE|BUNDLE|SG|FG)/useYn(Y|N) 모두 선택.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        routingCode: { type: 'string', required: true },
        seq: { type: 'number', required: true },
        processCode: { type: 'string', required: false },
        equipType: { type: 'string', required: false },
        stdTime: { type: 'number', required: false },
        setupTime: { type: 'number', required: false },
        sampleInspectYn: { type: 'string', required: false, enum: ['Y', 'N'] },
        issueLabelType: { type: 'string', required: false, enum: ['NONE', 'BUNDLE', 'SG', 'FG'] },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteRoutingProcess',
      label: '공정순서 삭제',
      description: 'routingCode+seq로 지정한 공정순서를 삭제한다. 해당 공정의 양품조건·투입자재가 함께 삭제된다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        routingCode: { type: 'string', required: true },
        seq: { type: 'number', required: true },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 라우팅(/master/routing) 도구 Provider — 라우팅 그룹·공정순서 CRUD.
 * 모든 도구는 기존 RoutingGroupService를 재사용(검증·중복체크·멀티테넌시 준수).
 */
@Injectable()
export class RoutingToolsProvider implements PageToolProvider {
  readonly pageId = ROUTING_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = ROUTING_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly routingService?: RoutingGroupService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createRoutingGroup':
        return this.createRoutingGroup(input, company, plant);
      case 'updateRoutingGroup':
        return this.updateRoutingGroup(input, company, plant);
      case 'deleteRoutingGroup':
        return this.deleteRoutingGroup(input, company, plant);
      case 'createRoutingProcess':
        return this.createRoutingProcess(input, company, plant);
      case 'updateRoutingProcess':
        return this.updateRoutingProcess(input, company, plant);
      case 'deleteRoutingProcess':
        return this.deleteRoutingProcess(input, company, plant);
      default:
        throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }
  }

  private svc(): RoutingGroupService {
    if (!this.routingService) throw new BadRequestException('라우팅 서비스가 준비되지 않았습니다.');
    return this.routingService;
  }

  private str(v: unknown): string {
    return String(v ?? '').trim();
  }

  private yn(v: unknown): string {
    const s = this.str(v).toUpperCase();
    if (s !== 'Y' && s !== 'N') throw new BadRequestException(`사용여부 값은 Y 또는 N 이어야 합니다: ${s}`);
    return s;
  }

  private labelType(v: unknown): string {
    const s = this.str(v).toUpperCase();
    if (!['NONE', 'BUNDLE', 'SG', 'FG'].includes(s)) {
      throw new BadRequestException(`라벨 발행 종류(issueLabelType)는 NONE/BUNDLE/SG/FG 중 하나여야 합니다: ${s}`);
    }
    return s;
  }

  private num(v: unknown, label: string): number {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new BadRequestException(`${label} 값이 숫자가 아닙니다: ${String(v)}`);
    return n;
  }

  private seqOf(v: unknown): number {
    const n = this.num(v, '공정 순서(seq)');
    if (!Number.isInteger(n) || n < 1) throw new BadRequestException(`공정 순서(seq)는 1 이상의 정수여야 합니다: ${n}`);
    return n;
  }

  private result(toolName: string, summary: string, result?: Record<string, unknown>): AiPageToolWriteResult {
    return { status: 'ok', toolName, summary, result };
  }

  // ── 라우팅 그룹 ───────────────────────────────────────

  private async createRoutingGroup(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    const routingCode = this.str(input.routingCode);
    const routingName = this.str(input.routingName);
    const itemCode = this.str(input.itemCode);
    if (!routingCode || !routingName || !itemCode) {
      throw new BadRequestException('라우팅 그룹 코드·그룹명·연결 품목 코드가 필요합니다.');
    }
    const saved = await this.svc().createGroup(
      {
        routingCode,
        routingName,
        itemCode,
        description: input.description !== undefined ? this.str(input.description) : undefined,
        useYn: input.useYn !== undefined ? this.yn(input.useYn) : undefined,
      },
      company,
      plant,
    );
    return this.result(
      'createRoutingGroup',
      `라우팅 그룹 '${saved.routingName}'(${saved.routingCode}, 품목 ${itemCode})를 등록했습니다.`,
      { routingCode: saved.routingCode, routingName: saved.routingName, itemCode },
    );
  }

  private async updateRoutingGroup(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    const routingCode = this.str(input.routingCode);
    if (!routingCode) throw new BadRequestException('라우팅 그룹 코드가 필요합니다.');
    const dto: { routingName?: string; itemCode?: string; description?: string; useYn?: string } = {};
    if (input.routingName !== undefined) dto.routingName = this.str(input.routingName);
    if (input.itemCode !== undefined) dto.itemCode = this.str(input.itemCode);
    if (input.description !== undefined) dto.description = this.str(input.description);
    if (input.useYn !== undefined) dto.useYn = this.yn(input.useYn);
    await this.svc().updateGroup(routingCode, dto, company, plant);
    return this.result('updateRoutingGroup', `라우팅 그룹 ${routingCode}를 수정했습니다.`, { routingCode });
  }

  private async deleteRoutingGroup(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    const routingCode = this.str(input.routingCode);
    if (!routingCode) throw new BadRequestException('라우팅 그룹 코드가 필요합니다.');
    await this.svc().deleteGroup(routingCode, company, plant);
    return this.result('deleteRoutingGroup', `라우팅 그룹 ${routingCode}(하위 공정·양품조건·투입자재 포함)를 삭제했습니다.`, { routingCode });
  }

  // ── 공정순서 ─────────────────────────────────────────

  private async createRoutingProcess(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    const routingCode = this.str(input.routingCode);
    const processCode = this.str(input.processCode);
    if (!routingCode || !processCode) throw new BadRequestException('라우팅 그룹 코드·공정 코드가 필요합니다.');
    const seq = this.seqOf(input.seq);
    const saved = await this.svc().createProcess(
      {
        routingCode,
        seq,
        processCode,
        equipType: input.equipType !== undefined ? this.str(input.equipType) : undefined,
        stdTime: input.stdTime !== undefined ? this.num(input.stdTime, '표준시간(stdTime)') : undefined,
        setupTime: input.setupTime !== undefined ? this.num(input.setupTime, '셋업시간(setupTime)') : undefined,
        sampleInspectYn: input.sampleInspectYn !== undefined ? this.yn(input.sampleInspectYn) : undefined,
        issueLabelType: input.issueLabelType !== undefined ? this.labelType(input.issueLabelType) : undefined,
        useYn: input.useYn !== undefined ? this.yn(input.useYn) : undefined,
      },
      company,
      plant,
    );
    return this.result(
      'createRoutingProcess',
      `라우팅 ${routingCode}에 공정 ${seq}번(${saved.processName ?? processCode})를 추가했습니다.`,
      { routingCode, seq, processCode },
    );
  }

  private async updateRoutingProcess(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    const routingCode = this.str(input.routingCode);
    if (!routingCode) throw new BadRequestException('라우팅 그룹 코드가 필요합니다.');
    const seq = this.seqOf(input.seq);
    const dto: {
      processCode?: string;
      equipType?: string;
      stdTime?: number;
      setupTime?: number;
      sampleInspectYn?: string;
      issueLabelType?: string;
      useYn?: string;
    } = {};
    if (input.processCode !== undefined) dto.processCode = this.str(input.processCode);
    if (input.equipType !== undefined) dto.equipType = this.str(input.equipType);
    if (input.stdTime !== undefined) dto.stdTime = this.num(input.stdTime, '표준시간(stdTime)');
    if (input.setupTime !== undefined) dto.setupTime = this.num(input.setupTime, '셋업시간(setupTime)');
    if (input.sampleInspectYn !== undefined) dto.sampleInspectYn = this.yn(input.sampleInspectYn);
    if (input.issueLabelType !== undefined) dto.issueLabelType = this.labelType(input.issueLabelType);
    if (input.useYn !== undefined) dto.useYn = this.yn(input.useYn);
    await this.svc().updateProcess(routingCode, seq, dto, company, plant);
    return this.result('updateRoutingProcess', `라우팅 ${routingCode}의 공정 ${seq}번을 수정했습니다.`, { routingCode, seq });
  }

  private async deleteRoutingProcess(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    const routingCode = this.str(input.routingCode);
    if (!routingCode) throw new BadRequestException('라우팅 그룹 코드가 필요합니다.');
    const seq = this.seqOf(input.seq);
    await this.svc().deleteProcess(routingCode, seq, company, plant);
    return this.result('deleteRoutingProcess', `라우팅 ${routingCode}의 공정 ${seq}번을 삭제했습니다.`, { routingCode, seq });
  }
}
