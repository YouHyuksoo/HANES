import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { WorkInstructionService } from '../../master/services/work-instruction.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

/**
 * 작업지도서 키 합성 규칙: itemCode::processCode::revision.
 * 프론트(getWorkInstructionKey)·백엔드 서비스(parseCompositeId)와 동일하게 맞춘다.
 */
const KEY_HINT =
  '대상 지정 키는 itemCode(품목코드)·processCode(공정코드)·revision(리비전)이다. ' +
  'revision 미지정 시 "A"로 본다. 내부적으로 itemCode::processCode::revision 형식으로 합성한다.';

/**
 * 작업지도서(/master/work-instruction) AI 페이지 도구 — 품목/공정별 작업지침 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const WORK_INSTRUCTION_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.work-instruction',
  route: '/master/work-instruction',
  title: '작업지도서',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createWorkInstruction',
      label: '작업지도서 등록',
      description:
        `새 작업지도서를 등록한다. itemCode(품목코드)·processCode(공정코드)·title(제목) 필수. ` +
        `content(내용)·imageUrl(첨부 URL)·revision(리비전, 기본 A)·useYn(사용여부 Y|N, 기본 Y)는 선택. ` +
        `같은 itemCode/processCode/revision 조합이 이미 있으면 등록되지 않는다.`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        itemCode: { type: 'string', required: true },
        processCode: { type: 'string', required: true },
        title: { type: 'string', required: true },
        content: { type: 'string', required: false },
        imageUrl: { type: 'string', required: false },
        revision: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateWorkInstruction',
      label: '작업지도서 수정',
      description:
        `기존 작업지도서를 수정한다. ${KEY_HINT} ` +
        `바꿀 항목(title 제목 / content 내용 / imageUrl 첨부 URL / useYn 사용여부 Y|N)만 넣는다. ` +
        `품목코드·공정코드·리비전 자체는 변경할 수 없다.`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        itemCode: { type: 'string', required: true },
        processCode: { type: 'string', required: true },
        revision: { type: 'string', required: false },
        title: { type: 'string', required: false },
        content: { type: 'string', required: false },
        imageUrl: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteWorkInstruction',
      label: '작업지도서 삭제',
      description: `작업지도서를 삭제한다. ${KEY_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        itemCode: { type: 'string', required: true },
        processCode: { type: 'string', required: true },
        revision: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 작업지도서(/master/work-instruction) 도구 Provider — 품목/공정별 작업지침 CRUD.
 * 모든 도구는 기존 도메인 서비스(WorkInstructionService)를 재사용(검증·중복체크·멀티테넌시 준수).
 */
@Injectable()
export class WorkInstructionToolsProvider implements PageToolProvider {
  readonly pageId = WORK_INSTRUCTION_TOOL_MANIFEST.pageId;
  readonly manifest = WORK_INSTRUCTION_TOOL_MANIFEST;

  constructor(@Optional() private readonly workInstructionService?: WorkInstructionService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createWorkInstruction':
        return this.createWorkInstruction(input, company, plant);
      case 'updateWorkInstruction':
        return this.updateWorkInstruction(input, company, plant);
      case 'deleteWorkInstruction':
        return this.deleteWorkInstruction(input, company, plant);
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
    if (yn !== 'Y' && yn !== 'N') {
      throw new BadRequestException(`사용여부는 Y 또는 N이어야 합니다: ${yn}`);
    }
    return yn;
  }

  /** itemCode::processCode::revision 합성 키 생성 (서비스 parseCompositeId 규칙과 동일) */
  private compositeId(itemCode: string, processCode: string, revision: string): string {
    return `${itemCode}::${processCode}::${revision}`;
  }

  private async createWorkInstruction(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.workInstructionService) throw new BadRequestException('작업지도서 서비스가 준비되지 않았습니다.');
    const itemCode = this.str(input.itemCode);
    const processCode = this.str(input.processCode);
    const title = this.str(input.title);
    if (!itemCode || !processCode || !title) {
      throw new BadRequestException('품목코드·공정코드·제목이 필요합니다.');
    }
    const revision = this.str(input.revision) || 'A';
    const dto = {
      itemCode,
      processCode,
      title,
      revision,
      ...(input.content !== undefined ? { content: this.str(input.content) } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: this.str(input.imageUrl) } : {}),
      ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
    };
    const saved = await this.workInstructionService.create(dto, company, plant);
    return this.result(
      'createWorkInstruction',
      `작업지도서 '${saved.title}'(${saved.itemCode}/${saved.processCode}/Rev.${saved.revision})를 등록했습니다.`,
      { itemCode: saved.itemCode, processCode: saved.processCode, revision: saved.revision },
    );
  }

  private async updateWorkInstruction(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.workInstructionService) throw new BadRequestException('작업지도서 서비스가 준비되지 않았습니다.');
    const itemCode = this.str(input.itemCode);
    const processCode = this.str(input.processCode);
    if (!itemCode || !processCode) throw new BadRequestException('품목코드·공정코드가 필요합니다.');
    const revision = this.str(input.revision) || 'A';
    const dto: { title?: string; content?: string; imageUrl?: string; useYn?: string } = {};
    if (input.title !== undefined) dto.title = this.str(input.title);
    if (input.content !== undefined) dto.content = this.str(input.content);
    if (input.imageUrl !== undefined) dto.imageUrl = this.str(input.imageUrl);
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);
    const id = this.compositeId(itemCode, processCode, revision);
    await this.workInstructionService.update(id, dto, company, plant);
    return this.result('updateWorkInstruction', `작업지도서 ${itemCode}/${processCode}/Rev.${revision}를 수정했습니다.`, {
      itemCode,
      processCode,
      revision,
    });
  }

  private async deleteWorkInstruction(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.workInstructionService) throw new BadRequestException('작업지도서 서비스가 준비되지 않았습니다.');
    const itemCode = this.str(input.itemCode);
    const processCode = this.str(input.processCode);
    if (!itemCode || !processCode) throw new BadRequestException('품목코드·공정코드가 필요합니다.');
    const revision = this.str(input.revision) || 'A';
    const id = this.compositeId(itemCode, processCode, revision);
    await this.workInstructionService.delete(id, company, plant);
    return this.result('deleteWorkInstruction', `작업지도서 ${itemCode}/${processCode}/Rev.${revision}를 삭제했습니다.`, {
      itemCode,
      processCode,
      revision,
    });
  }
}
