import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ProcessService } from '../../master/services/process.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const LINE_TYPES = ['LV', 'HV', 'CM'];
const LINE_TYPE_HINT =
  '라인구분(lineType) 값: LV(저전압), HV(고전압), CM(공통). ' +
  '사용자 문구를 위 코드로 매핑(예: "저전압"→LV, "고전압"→HV, "공통"→CM).';

/**
 * 공정관리(/master/process) AI 페이지 도구 매니페스트 — 공정마스터 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const PROCESS_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.process',
  route: '/master/process',
  title: '공정관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createProcess',
      label: '공정 등록',
      description:
        `새 공정을 등록한다. 공정코드(processCode)·공정명(processName)·공정유형(processType)이 필요하다. ` +
        `processCategory(공정 대분류)·lineType(라인구분)·sortOrder(정렬순서)·remark(비고)·useYn(사용여부 Y|N)은 선택. ${LINE_TYPE_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        processCode: { type: 'string', required: true },
        processName: { type: 'string', required: true },
        processType: { type: 'string', required: true },
        processCategory: { type: 'string', required: false },
        lineType: { type: 'string', required: false, enum: LINE_TYPES },
        sortOrder: { type: 'number', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateProcess',
      label: '공정 수정',
      description:
        `기존 공정 정보를 수정한다. 공정코드(processCode)로 대상을 지정하고, 바꿀 항목만 넣는다. ` +
        `수정 가능 항목: processName·processType·processCategory·lineType·sortOrder·remark·useYn(Y|N). ${LINE_TYPE_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        processCode: { type: 'string', required: true },
        processName: { type: 'string', required: false },
        processType: { type: 'string', required: false },
        processCategory: { type: 'string', required: false },
        lineType: { type: 'string', required: false, enum: LINE_TYPES },
        sortOrder: { type: 'number', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteProcess',
      label: '공정 삭제',
      description: '공정코드(processCode)로 지정한 공정을 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { processCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 공정관리(/master/process) 도구 Provider — 공정마스터 CRUD.
 * 모든 도구는 기존 ProcessService를 재사용(검증·중복체크·멀티테넌시 준수).
 */
@Injectable()
export class ProcessToolsProvider implements PageToolProvider {
  readonly pageId = PROCESS_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = PROCESS_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly processService?: ProcessService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createProcess':
        return this.createProcess(input, company, plant);
      case 'updateProcess':
        return this.updateProcess(input, company, plant);
      case 'deleteProcess':
        return this.deleteProcess(input, company, plant);
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

  private normalizeLineType(v: unknown): string {
    const lt = this.str(v).toUpperCase();
    if (!LINE_TYPES.includes(lt)) {
      throw new BadRequestException(`라인구분이 올바르지 않습니다(${LINE_TYPES.join('/')}): ${lt}`);
    }
    return lt;
  }

  private normalizeUseYn(v: unknown): string {
    const yn = this.str(v).toUpperCase();
    if (yn !== 'Y' && yn !== 'N') {
      throw new BadRequestException(`사용여부는 Y 또는 N이어야 합니다: ${yn}`);
    }
    return yn;
  }

  private toSortOrder(v: unknown): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      throw new BadRequestException(`정렬순서는 0 이상의 정수여야 합니다: ${this.str(v)}`);
    }
    return n;
  }

  private async createProcess(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.processService) throw new BadRequestException('공정 서비스가 준비되지 않았습니다.');
    const processCode = this.str(input.processCode);
    const processName = this.str(input.processName);
    const processType = this.str(input.processType);
    const processCategory = this.str(input.processCategory);
    if (!processCode || !processName || !processType || !processCategory || input.lineType === undefined) {
      throw new BadRequestException('공정코드·공정명·공정유형·공정카테고리·라인유형이 필요합니다.');
    }
    const lineType = this.normalizeLineType(input.lineType);
    const dto: {
      processCode: string;
      processName: string;
      processType: string;
      processCategory: string;
      lineType: string;
      sortOrder?: number;
      remark?: string;
      useYn?: string;
    } = { processCode, processName, processType, processCategory, lineType };
    if (input.sortOrder !== undefined) dto.sortOrder = this.toSortOrder(input.sortOrder);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);

    const saved = await this.processService.create(dto, company, plant);
    return this.result('createProcess', `공정 '${saved.processName}'(${saved.processCode}, 유형 ${saved.processType})를 등록했습니다.`, {
      processCode: saved.processCode,
      processName: saved.processName,
      processType: saved.processType,
    });
  }

  private async updateProcess(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.processService) throw new BadRequestException('공정 서비스가 준비되지 않았습니다.');
    const processCode = this.str(input.processCode);
    if (!processCode) throw new BadRequestException('공정코드가 필요합니다.');
    const dto: {
      processName?: string;
      processType?: string;
      processCategory?: string;
      lineType?: string;
      sortOrder?: number;
      remark?: string;
      useYn?: string;
    } = {};
    if (input.processName !== undefined) dto.processName = this.str(input.processName);
    if (input.processType !== undefined) dto.processType = this.str(input.processType);
    if (input.processCategory !== undefined) dto.processCategory = this.str(input.processCategory);
    if (input.lineType !== undefined) dto.lineType = this.normalizeLineType(input.lineType);
    if (input.sortOrder !== undefined) dto.sortOrder = this.toSortOrder(input.sortOrder);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);

    await this.processService.update(processCode, dto, company, plant);
    return this.result('updateProcess', `공정 ${processCode}를 수정했습니다.`, { processCode });
  }

  private async deleteProcess(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.processService) throw new BadRequestException('공정 서비스가 준비되지 않았습니다.');
    const processCode = this.str(input.processCode);
    if (!processCode) throw new BadRequestException('공정코드가 필요합니다.');
    await this.processService.delete(processCode, company, plant);
    return this.result('deleteProcess', `공정 ${processCode}를 삭제했습니다.`, { processCode });
  }
}
