import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { WorkerService } from '../../master/services/worker.service';
import { CreateWorkerDto, UpdateWorkerDto } from '../../master/dto/worker.dto';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

/**
 * 작업자관리(/master/worker) AI 페이지 도구 매니페스트 — 작업자 마스터 CRUD.
 * 자연키는 workerCode(회사/공장 스코프). 모든 write 도구는 채팅에서 사용자 승인 후 실행한다(approval-required).
 */
export const WORKER_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.worker',
  route: '/master/worker',
  title: '작업자관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createWorker',
      label: '작업자 등록',
      description:
        '새 작업자를 등록한다. workerCode(작업자코드)·workerName(작업자명) 필수. ' +
        '선택: engName(영문명), dept(부서), position(직급), phone(전화번호), email(이메일), ' +
        'hireDate/quitDate(입사일/퇴사일, YYYY-MM-DD), qrCode(QR코드), remark(비고), ' +
        'useYn(사용여부 Y|N, 기본 Y). 사용자 문구 매핑 예: "사용"→Y, "미사용/퇴사"→N.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        workerCode: { type: 'string', required: true },
        workerName: { type: 'string', required: true },
        engName: { type: 'string', required: false },
        dept: { type: 'string', required: false },
        position: { type: 'string', required: false },
        phone: { type: 'string', required: false },
        email: { type: 'string', required: false },
        hireDate: { type: 'string', required: false },
        quitDate: { type: 'string', required: false },
        qrCode: { type: 'string', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateWorker',
      label: '작업자 수정',
      description:
        '기존 작업자 정보를 수정한다. workerCode로 대상을 지정하고, 바꿀 항목만 넣는다. ' +
        '수정 가능 항목: workerName, engName, dept, position, phone, email, hireDate, quitDate, ' +
        'qrCode, remark, useYn(Y|N). useYn 매핑 예: "사용"→Y, "미사용/퇴사"→N.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        workerCode: { type: 'string', required: true },
        workerName: { type: 'string', required: false },
        engName: { type: 'string', required: false },
        dept: { type: 'string', required: false },
        position: { type: 'string', required: false },
        phone: { type: 'string', required: false },
        email: { type: 'string', required: false },
        hireDate: { type: 'string', required: false },
        quitDate: { type: 'string', required: false },
        qrCode: { type: 'string', required: false },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteWorker',
      label: '작업자 삭제',
      description: 'workerCode(작업자코드)로 지정한 작업자를 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { workerCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 작업자관리(/master/worker) 도구 Provider — 작업자 마스터 CRUD.
 * 모든 도구는 기존 WorkerService를 재사용(중복체크·존재검증·멀티테넌시 준수).
 */
@Injectable()
export class WorkerToolsProvider implements PageToolProvider {
  readonly pageId = WORKER_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = WORKER_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly workerService?: WorkerService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createWorker':
        return this.createWorker(input, company, plant);
      case 'updateWorker':
        return this.updateWorker(input, company, plant);
      case 'deleteWorker':
        return this.deleteWorker(input, company, plant);
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
      throw new BadRequestException(`사용여부 값이 올바르지 않습니다(Y/N): ${yn}`);
    }
    return yn;
  }

  private async createWorker(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.workerService) throw new BadRequestException('작업자 서비스가 준비되지 않았습니다.');
    const workerCode = this.str(input.workerCode);
    const workerName = this.str(input.workerName);
    if (!workerCode || !workerName) throw new BadRequestException('작업자코드·작업자명이 필요합니다.');

    const dto: CreateWorkerDto = {
      workerCode,
      workerName,
      ...(input.engName !== undefined ? { engName: this.str(input.engName) } : {}),
      ...(input.dept !== undefined ? { dept: this.str(input.dept) } : {}),
      ...(input.position !== undefined ? { position: this.str(input.position) } : {}),
      ...(input.phone !== undefined ? { phone: this.str(input.phone) } : {}),
      ...(input.email !== undefined ? { email: this.str(input.email) } : {}),
      ...(input.hireDate !== undefined ? { hireDate: this.str(input.hireDate) } : {}),
      ...(input.quitDate !== undefined ? { quitDate: this.str(input.quitDate) } : {}),
      ...(input.qrCode !== undefined ? { qrCode: this.str(input.qrCode) } : {}),
      ...(input.remark !== undefined ? { remark: this.str(input.remark) } : {}),
      ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
    };

    const saved = await this.workerService.create(dto, company, plant);
    return this.result('createWorker', `작업자 '${saved.workerName}'(${saved.workerCode})를 등록했습니다.`, {
      workerCode: saved.workerCode,
      workerName: saved.workerName,
    });
  }

  private async updateWorker(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.workerService) throw new BadRequestException('작업자 서비스가 준비되지 않았습니다.');
    const workerCode = this.str(input.workerCode);
    if (!workerCode) throw new BadRequestException('작업자코드가 필요합니다.');

    const dto: UpdateWorkerDto = {
      ...(input.workerName !== undefined ? { workerName: this.str(input.workerName) } : {}),
      ...(input.engName !== undefined ? { engName: this.str(input.engName) } : {}),
      ...(input.dept !== undefined ? { dept: this.str(input.dept) } : {}),
      ...(input.position !== undefined ? { position: this.str(input.position) } : {}),
      ...(input.phone !== undefined ? { phone: this.str(input.phone) } : {}),
      ...(input.email !== undefined ? { email: this.str(input.email) } : {}),
      ...(input.hireDate !== undefined ? { hireDate: this.str(input.hireDate) } : {}),
      ...(input.quitDate !== undefined ? { quitDate: this.str(input.quitDate) } : {}),
      ...(input.qrCode !== undefined ? { qrCode: this.str(input.qrCode) } : {}),
      ...(input.remark !== undefined ? { remark: this.str(input.remark) } : {}),
      ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
    };

    await this.workerService.update(workerCode, dto, company, plant);
    return this.result('updateWorker', `작업자 ${workerCode}를 수정했습니다.`, { workerCode });
  }

  private async deleteWorker(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.workerService) throw new BadRequestException('작업자 서비스가 준비되지 않았습니다.');
    const workerCode = this.str(input.workerCode);
    if (!workerCode) throw new BadRequestException('작업자코드가 필요합니다.');
    await this.workerService.delete(workerCode, company, plant);
    return this.result('deleteWorker', `작업자 ${workerCode}를 삭제했습니다.`, { workerCode });
  }
}
