import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { BomService } from '../../master/services/bom.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

/**
 * BOM(/master/bom) AI 페이지 도구 매니페스트 — BOM 행(상위-하위 구성) CRUD.
 *
 * BOM 행 식별 규칙: 상위품목코드(parentItemCode) + 하위품목코드(childItemCode) + 적용일자(validFrom)가
 * 자연 복합키(DB PK)다. 수정/삭제는 이 세 값으로 대상을 지정한다. 백엔드 서비스는 이를
 * "parentItemCode::childItemCode::validFrom(YYYY-MM-DD)" 형태의 복합키 문자열(id)로 받는다.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const BOM_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.bom',
  route: '/master/bom',
  title: 'BOM',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createBom',
      label: 'BOM 행 등록',
      description:
        '상위 품목(parentItemCode) 아래에 하위 품목(childItemCode)을 BOM 구성으로 등록한다. ' +
        'parentItemCode·childItemCode·qtyPer(단위 소요량)·validFrom·validTo(유효기간 YYYY-MM-DD) 필요. revision(리비전, 미입력 시 A), seq(순서), ' +
        'processCode(공정코드), side(사이드 N/L/R), remark(비고)는 선택. ' +
        '상위와 하위 품목이 같을 수 없고, 동일 (상위·하위·적용일자) 조합은 중복 등록할 수 없다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        parentItemCode: { type: 'string', required: true },
        childItemCode: { type: 'string', required: true },
        qtyPer: { type: 'number', required: true },
        revision: { type: 'string', required: false },
        seq: { type: 'number', required: false },
        processCode: { type: 'string', required: false },
        side: { type: 'string', required: false },
        validFrom: { type: 'string', required: true },
        validTo: { type: 'string', required: true },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateBom',
      label: 'BOM 행 수정',
      description:
        '기존 BOM 행을 수정한다. 대상은 parentItemCode·childItemCode·validFrom(적용일자 YYYY-MM-DD) 세 값으로 지정한다. ' +
        '바꿀 항목만 넣는다: qtyPer(단위 소요량), seq(순서), revision(리비전), processCode(공정코드), side(사이드 N/L/R), ' +
        'newValidFrom(적용일자 변경 시 새 값)·validTo(YYYY-MM-DD), remark(비고), useYn(사용여부 Y/N).',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        parentItemCode: { type: 'string', required: true },
        childItemCode: { type: 'string', required: true },
        validFrom: { type: 'string', required: true },
        qtyPer: { type: 'number', required: false },
        seq: { type: 'number', required: false },
        revision: { type: 'string', required: false },
        processCode: { type: 'string', required: false },
        side: { type: 'string', required: false },
        newValidFrom: { type: 'string', required: false },
        validTo: { type: 'string', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteBom',
      label: 'BOM 행 삭제',
      description:
        'parentItemCode·childItemCode·validFrom(적용일자 YYYY-MM-DD)으로 지정한 BOM 행을 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        parentItemCode: { type: 'string', required: true },
        childItemCode: { type: 'string', required: true },
        validFrom: { type: 'string', required: true },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * BOM(/master/bom) 도구 Provider — BOM 행 CRUD.
 * 모든 도구는 기존 BomService를 재사용(검증·중복체크·멀티테넌시 준수).
 */
@Injectable()
export class BomToolsProvider implements PageToolProvider {
  readonly pageId = BOM_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = BOM_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly bomService?: BomService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createBom':
        return this.createBom(input, company, plant);
      case 'updateBom':
        return this.updateBom(input, company, plant);
      case 'deleteBom':
        return this.deleteBom(input, company, plant);
      default:
        throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }
  }

  private str(v: unknown): string {
    return String(v ?? '').trim();
  }

  private num(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new BadRequestException(`숫자 값이 올바르지 않습니다: ${String(v)}`);
    return n;
  }

  private result(toolName: string, summary: string, result?: Record<string, unknown>): AiPageToolWriteResult {
    return { status: 'ok', toolName, summary, result };
  }

  /** 복합키 id 생성: parentItemCode::childItemCode::validFrom(YYYY-MM-DD) */
  private bomKey(parentItemCode: string, childItemCode: string, validFrom: string): string {
    return `${parentItemCode}::${childItemCode}::${validFrom}`;
  }

  private async createBom(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.bomService) throw new BadRequestException('BOM 서비스가 준비되지 않았습니다.');
    const parentItemCode = this.str(input.parentItemCode);
    const childItemCode = this.str(input.childItemCode);
    if (!parentItemCode || !childItemCode) throw new BadRequestException('상위 품목코드·하위 품목코드가 필요합니다.');
    if (input.qtyPer === undefined || input.qtyPer === null || this.str(input.qtyPer) === '') {
      throw new BadRequestException('단위 소요량(qtyPer)이 필요합니다.');
    }
    const validFrom = this.str(input.validFrom);
    const validTo = this.str(input.validTo);
    if (!validFrom || !validTo) {
      throw new BadRequestException('유효시작일(validFrom)·유효종료일(validTo)이 필요합니다.');
    }
    const qtyPer = this.num(input.qtyPer);
    const revision = this.str(input.revision) || 'A';
    const dto = {
      parentItemCode,
      childItemCode,
      qtyPer,
      revision,
      validFrom,
      validTo,
      ...(input.seq !== undefined ? { seq: this.num(input.seq) } : {}),
      ...(this.str(input.processCode) ? { processCode: this.str(input.processCode) } : {}),
      ...(this.str(input.side) ? { side: this.str(input.side).toUpperCase() } : {}),
      ...(this.str(input.remark) ? { remark: this.str(input.remark) } : {}),
    };
    const saved = await this.bomService.create(dto, company, plant);
    return this.result(
      'createBom',
      `BOM 행 ${parentItemCode} → ${childItemCode}(리비전 ${revision}, 소요량 ${qtyPer})를 등록했습니다.`,
      { parentItemCode: saved.parentItemCode, childItemCode: saved.childItemCode, revision: saved.revision },
    );
  }

  private async updateBom(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.bomService) throw new BadRequestException('BOM 서비스가 준비되지 않았습니다.');
    const parentItemCode = this.str(input.parentItemCode);
    const childItemCode = this.str(input.childItemCode);
    if (!parentItemCode || !childItemCode) throw new BadRequestException('상위 품목코드·하위 품목코드가 필요합니다.');
    const validFrom = this.str(input.validFrom);
    if (!validFrom) throw new BadRequestException('대상 적용일자(validFrom, YYYY-MM-DD)가 필요합니다.');

    const dto: {
      qtyPer?: number;
      seq?: number;
      revision?: string;
      processCode?: string;
      side?: string;
      validFrom?: string;
      validTo?: string;
      remark?: string;
      useYn?: string;
    } = {};
    if (input.qtyPer !== undefined) dto.qtyPer = this.num(input.qtyPer);
    if (input.seq !== undefined) dto.seq = this.num(input.seq);
    if (input.revision !== undefined) dto.revision = this.str(input.revision);
    if (input.processCode !== undefined) dto.processCode = this.str(input.processCode);
    if (input.side !== undefined) dto.side = this.str(input.side).toUpperCase();
    if (input.newValidFrom !== undefined) dto.validFrom = this.str(input.newValidFrom);
    if (input.validTo !== undefined) dto.validTo = this.str(input.validTo);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);
    if (input.useYn !== undefined) dto.useYn = this.str(input.useYn).toUpperCase();

    await this.bomService.update(this.bomKey(parentItemCode, childItemCode, validFrom), dto, company, plant);
    return this.result(
      'updateBom',
      `BOM 행 ${parentItemCode} → ${childItemCode}(적용일자 ${validFrom})를 수정했습니다.`,
      { parentItemCode, childItemCode, validFrom },
    );
  }

  private async deleteBom(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.bomService) throw new BadRequestException('BOM 서비스가 준비되지 않았습니다.');
    const parentItemCode = this.str(input.parentItemCode);
    const childItemCode = this.str(input.childItemCode);
    if (!parentItemCode || !childItemCode) throw new BadRequestException('상위 품목코드·하위 품목코드가 필요합니다.');
    const validFrom = this.str(input.validFrom);
    if (!validFrom) throw new BadRequestException('대상 적용일자(validFrom, YYYY-MM-DD)가 필요합니다.');

    await this.bomService.delete(this.bomKey(parentItemCode, childItemCode, validFrom), company, plant);
    return this.result(
      'deleteBom',
      `BOM 행 ${parentItemCode} → ${childItemCode}(적용일자 ${validFrom})를 삭제했습니다.`,
      { parentItemCode, childItemCode, validFrom },
    );
  }
}
