import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ProcessCapaService } from '../../master/services/process-capa.service';
import {
  CreateProcessCapaDto,
  UpdateProcessCapaDto,
} from '../../master/dto/process-capa.dto';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

/**
 * 공정 CAPA(/master/process-capa) AI 페이지 도구 매니페스트 — 공정x품목별 생산능력 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const PROCESS_CAPA_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.process-capa',
  route: '/master/process-capa',
  title: '공정 CAPA',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createProcessCapa',
      label: '공정 CAPA 등록',
      description:
        '공정+품목 조합의 생산능력(CAPA)을 신규 등록한다. processCode(공정코드)·itemCode(품목코드)·stdTactTime(표준 택트타임, 초) 필수. ' +
        '대상 공정/품목은 이미 마스터에 존재해야 한다(없으면 실패). ' +
        'stdUph 미입력 시 3600/택트타임으로 자동계산되고, dailyCapa(일 생산능력)는 서버에서 자동계산된다. ' +
        'balanceEff(밸런싱 효율 %)는 0~100, useYn은 Y(사용)/N(미사용)이며 기본값 Y. ' +
        '"사용/활성"→Y, "미사용/비활성"→N으로 매핑한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        processCode: { type: 'string', required: true },
        itemCode: { type: 'string', required: true },
        stdTactTime: { type: 'number', required: true },
        stdUph: { type: 'number', required: false },
        workerCnt: { type: 'number', required: false },
        boardCnt: { type: 'number', required: false },
        equipCnt: { type: 'number', required: false },
        setupTime: { type: 'number', required: false },
        balanceEff: { type: 'number', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateProcessCapa',
      label: '공정 CAPA 수정',
      description:
        'processCode(공정코드)+itemCode(품목코드)로 지정한 공정 CAPA를 수정한다. ' +
        '바꿀 항목만 넣는다(stdTactTime/stdUph/workerCnt/boardCnt/equipCnt/setupTime/balanceEff/useYn/remark). ' +
        'stdTactTime만 바꾸고 stdUph를 생략하면 stdUph가 재계산되며, dailyCapa는 항상 서버에서 재계산된다. ' +
        'useYn은 Y(사용)/N(미사용)이며 "사용/활성"→Y, "미사용/비활성"→N으로 매핑한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        processCode: { type: 'string', required: true },
        itemCode: { type: 'string', required: true },
        stdTactTime: { type: 'number', required: false },
        stdUph: { type: 'number', required: false },
        workerCnt: { type: 'number', required: false },
        boardCnt: { type: 'number', required: false },
        equipCnt: { type: 'number', required: false },
        setupTime: { type: 'number', required: false },
        balanceEff: { type: 'number', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteProcessCapa',
      label: '공정 CAPA 삭제',
      description: 'processCode(공정코드)+itemCode(품목코드)로 지정한 공정 CAPA를 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        processCode: { type: 'string', required: true },
        itemCode: { type: 'string', required: true },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 공정 CAPA(/master/process-capa) 도구 Provider — 공정x품목별 생산능력 CRUD.
 * 모든 도구는 기존 도메인 서비스(ProcessCapaService)를 재사용
 * (중복체크·FK검증·UPH/일CAPA 자동계산·멀티테넌시 준수).
 */
@Injectable()
export class ProcessCapaToolsProvider implements PageToolProvider {
  readonly pageId = PROCESS_CAPA_TOOL_MANIFEST.pageId;
  readonly manifest = PROCESS_CAPA_TOOL_MANIFEST;

  constructor(@Optional() private readonly processCapaService?: ProcessCapaService) {}

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    ctx: PageToolContext,
  ): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createProcessCapa':
        return this.createProcessCapa(input, company, plant);
      case 'updateProcessCapa':
        return this.updateProcessCapa(input, company, plant);
      case 'deleteProcessCapa':
        return this.deleteProcessCapa(input, company, plant);
      default:
        throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }
  }

  private str(v: unknown): string {
    return String(v ?? '').trim();
  }

  private num(v: unknown): number | undefined {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) throw new BadRequestException(`숫자 값이 올바르지 않습니다: ${String(v)}`);
    return n;
  }

  private normalizeUseYn(v: unknown): string {
    const yn = this.str(v).toUpperCase();
    if (yn !== 'Y' && yn !== 'N') {
      throw new BadRequestException(`사용여부 값이 올바르지 않습니다(Y/N): ${yn}`);
    }
    return yn;
  }

  private result(toolName: string, summary: string, result?: Record<string, unknown>): AiPageToolWriteResult {
    return { status: 'ok', toolName, summary, result };
  }

  private async createProcessCapa(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.processCapaService) throw new BadRequestException('공정 CAPA 서비스가 준비되지 않았습니다.');
    const processCode = this.str(input.processCode);
    const itemCode = this.str(input.itemCode);
    const stdTactTime = this.num(input.stdTactTime);
    if (!processCode || !itemCode) throw new BadRequestException('공정코드·품목코드가 필요합니다.');
    if (stdTactTime === undefined) throw new BadRequestException('표준 택트타임(stdTactTime)이 필요합니다.');

    const dto: CreateProcessCapaDto = {
      processCode,
      itemCode,
      stdTactTime,
    };
    const stdUph = this.num(input.stdUph);
    if (stdUph !== undefined) dto.stdUph = stdUph;
    const workerCnt = this.num(input.workerCnt);
    if (workerCnt !== undefined) dto.workerCnt = workerCnt;
    const boardCnt = this.num(input.boardCnt);
    if (boardCnt !== undefined) dto.boardCnt = boardCnt;
    const equipCnt = this.num(input.equipCnt);
    if (equipCnt !== undefined) dto.equipCnt = equipCnt;
    const setupTime = this.num(input.setupTime);
    if (setupTime !== undefined) dto.setupTime = setupTime;
    const balanceEff = this.num(input.balanceEff);
    if (balanceEff !== undefined) dto.balanceEff = balanceEff;
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);
    if (input.remark !== undefined) dto.remark = this.str(input.remark) || undefined;

    const saved = await this.processCapaService.create(dto, company ?? '', plant ?? '');
    return this.result(
      'createProcessCapa',
      `공정 CAPA '${saved.processCode} / ${saved.itemCode}'를 등록했습니다(일CAPA ${saved.dailyCapa?.toLocaleString?.() ?? saved.dailyCapa}).`,
      { processCode: saved.processCode, itemCode: saved.itemCode, dailyCapa: saved.dailyCapa },
    );
  }

  private async updateProcessCapa(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.processCapaService) throw new BadRequestException('공정 CAPA 서비스가 준비되지 않았습니다.');
    const processCode = this.str(input.processCode);
    const itemCode = this.str(input.itemCode);
    if (!processCode || !itemCode) throw new BadRequestException('공정코드·품목코드가 필요합니다.');

    const dto: UpdateProcessCapaDto = {};
    const stdTactTime = this.num(input.stdTactTime);
    if (stdTactTime !== undefined) dto.stdTactTime = stdTactTime;
    const stdUph = this.num(input.stdUph);
    if (stdUph !== undefined) dto.stdUph = stdUph;
    const workerCnt = this.num(input.workerCnt);
    if (workerCnt !== undefined) dto.workerCnt = workerCnt;
    const boardCnt = this.num(input.boardCnt);
    if (boardCnt !== undefined) dto.boardCnt = boardCnt;
    const equipCnt = this.num(input.equipCnt);
    if (equipCnt !== undefined) dto.equipCnt = equipCnt;
    const setupTime = this.num(input.setupTime);
    if (setupTime !== undefined) dto.setupTime = setupTime;
    const balanceEff = this.num(input.balanceEff);
    if (balanceEff !== undefined) dto.balanceEff = balanceEff;
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);
    if (input.remark !== undefined) dto.remark = this.str(input.remark) || undefined;

    const saved = await this.processCapaService.update(processCode, itemCode, dto, company ?? '', plant ?? '');
    return this.result(
      'updateProcessCapa',
      `공정 CAPA ${processCode} / ${itemCode}를 수정했습니다(일CAPA ${saved.dailyCapa?.toLocaleString?.() ?? saved.dailyCapa}).`,
      { processCode, itemCode, dailyCapa: saved.dailyCapa },
    );
  }

  private async deleteProcessCapa(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.processCapaService) throw new BadRequestException('공정 CAPA 서비스가 준비되지 않았습니다.');
    const processCode = this.str(input.processCode);
    const itemCode = this.str(input.itemCode);
    if (!processCode || !itemCode) throw new BadRequestException('공정코드·품목코드가 필요합니다.');

    await this.processCapaService.delete(processCode, itemCode, company ?? '', plant ?? '');
    return this.result('deleteProcessCapa', `공정 CAPA ${processCode} / ${itemCode}를 삭제했습니다.`, {
      processCode,
      itemCode,
    });
  }
}
