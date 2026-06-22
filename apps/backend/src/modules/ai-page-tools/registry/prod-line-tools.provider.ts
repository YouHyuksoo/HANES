/**
 * @file src/modules/ai-page-tools/registry/prod-line-tools.provider.ts
 * @description 생산라인관리(/master/prod-line) AI 페이지 도구 — 생산라인 마스터 CRUD.
 *  매니페스트 + Provider를 한 파일에 자기완결적으로 보유한다.
 *  모든 write 도구는 채팅에서 사용자 승인 후에만 실행된다(approval-required).
 *  실행은 기존 ProdLineService(create/update/delete)를 재사용한다.
 */

import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ProdLineService } from '../../master/services/prod-line.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const USE_YN = ['Y', 'N'];
const USE_YN_HINT = '사용여부 값: Y(사용), N(미사용). 미입력 시 등록은 Y로 처리.';

/**
 * 생산라인관리(/master/prod-line) AI 페이지 도구 매니페스트.
 * 자연키는 lineCode(생산라인 코드). update/delete는 lineCode로 대상 지정.
 */
export const PROD_LINE_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.prod-line',
  route: '/master/prod-line',
  title: '생산라인관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createProdLine',
      label: '생산라인 등록',
      description:
        `새 생산라인을 등록한다. lineCode(생산라인 코드)·lineName(생산라인명) 필요. ` +
        `oper(공정코드), lineType(라인 유형), whLoc(창고 위치), erpCode(ERP 코드), remark(비고)는 선택. ${USE_YN_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        lineCode: { type: 'string', required: true },
        lineName: { type: 'string', required: true },
        oper: { type: 'string', required: false },
        lineType: { type: 'string', required: false },
        whLoc: { type: 'string', required: false },
        erpCode: { type: 'string', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: USE_YN },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateProdLine',
      label: '생산라인 수정',
      description:
        `기존 생산라인 정보를 수정한다. lineCode로 대상을 지정하고, 바꿀 항목` +
        `(lineName/oper/lineType/whLoc/erpCode/remark/useYn)만 넣는다. ${USE_YN_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        lineCode: { type: 'string', required: true },
        lineName: { type: 'string', required: false },
        oper: { type: 'string', required: false },
        lineType: { type: 'string', required: false },
        whLoc: { type: 'string', required: false },
        erpCode: { type: 'string', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: USE_YN },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteProdLine',
      label: '생산라인 삭제',
      description: 'lineCode(생산라인 코드)로 지정한 생산라인을 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { lineCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 생산라인관리(/master/prod-line) 도구 Provider — 생산라인 마스터 CRUD.
 * 모든 도구는 기존 ProdLineService를 재사용(검증·중복체크·멀티테넌시 준수).
 */
@Injectable()
export class ProdLineToolsProvider implements PageToolProvider {
  readonly pageId = PROD_LINE_TOOL_MANIFEST.pageId;
  readonly manifest = PROD_LINE_TOOL_MANIFEST;

  constructor(@Optional() private readonly prodLineService?: ProdLineService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createProdLine':
        return this.createProdLine(input, company, plant);
      case 'updateProdLine':
        return this.updateProdLine(input, company, plant);
      case 'deleteProdLine':
        return this.deleteProdLine(input, company, plant);
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

  private normalizeUseYn(v: unknown): string {
    const yn = this.str(v).toUpperCase();
    if (!USE_YN.includes(yn)) {
      throw new BadRequestException(`사용여부 값이 올바르지 않습니다(Y/N): ${yn}`);
    }
    return yn;
  }

  private async createProdLine(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.prodLineService) throw new BadRequestException('생산라인 서비스가 준비되지 않았습니다.');
    const lineCode = this.str(input.lineCode);
    const lineName = this.str(input.lineName);
    if (!lineCode || !lineName) throw new BadRequestException('생산라인 코드·생산라인명이 필요합니다.');
    const saved = await this.prodLineService.create(
      {
        lineCode,
        lineName,
        oper: input.oper !== undefined ? this.str(input.oper) || undefined : undefined,
        lineType: input.lineType !== undefined ? this.str(input.lineType) || undefined : undefined,
        whLoc: input.whLoc !== undefined ? this.str(input.whLoc) || undefined : undefined,
        erpCode: input.erpCode !== undefined ? this.str(input.erpCode) || undefined : undefined,
        remark: input.remark !== undefined ? this.str(input.remark) || undefined : undefined,
        ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
      },
      company,
      plant,
    );
    return this.result('createProdLine', `생산라인 '${saved.lineName}'(${saved.lineCode})를 등록했습니다.`, {
      lineCode: saved.lineCode,
      lineName: saved.lineName,
    });
  }

  private async updateProdLine(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.prodLineService) throw new BadRequestException('생산라인 서비스가 준비되지 않았습니다.');
    const lineCode = this.str(input.lineCode);
    if (!lineCode) throw new BadRequestException('생산라인 코드가 필요합니다.');
    const dto: {
      lineName?: string;
      oper?: string;
      lineType?: string;
      whLoc?: string;
      erpCode?: string;
      remark?: string;
      useYn?: string;
    } = {};
    if (input.lineName !== undefined) dto.lineName = this.str(input.lineName);
    if (input.oper !== undefined) dto.oper = this.str(input.oper);
    if (input.lineType !== undefined) dto.lineType = this.str(input.lineType);
    if (input.whLoc !== undefined) dto.whLoc = this.str(input.whLoc);
    if (input.erpCode !== undefined) dto.erpCode = this.str(input.erpCode);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);
    await this.prodLineService.update(lineCode, dto, company, plant);
    return this.result('updateProdLine', `생산라인 ${lineCode}를 수정했습니다.`, { lineCode });
  }

  private async deleteProdLine(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.prodLineService) throw new BadRequestException('생산라인 서비스가 준비되지 않았습니다.');
    const lineCode = this.str(input.lineCode);
    if (!lineCode) throw new BadRequestException('생산라인 코드가 필요합니다.');
    await this.prodLineService.delete(lineCode, company, plant);
    return this.result('deleteProdLine', `생산라인 ${lineCode}를 삭제했습니다.`, { lineCode });
  }
}
