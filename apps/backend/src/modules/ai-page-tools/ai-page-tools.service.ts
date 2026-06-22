import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { EquipMaster } from '../../entities/equip-master.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { ProcessMaster } from '../../entities/process-master.entity';
import { ProdLineMaster } from '../../entities/prod-line-master.entity';
import { WarehouseService } from '../inventory/services/warehouse.service';
import { PRODUCTION_ORDER_TOOL_MANIFEST } from './registry/production-order.tools';
import { WAREHOUSE_MASTER_TOOL_MANIFEST } from './registry/warehouse-master.tools';
import {
  AiPageToolCandidateResult,
  AiPageToolConfirmationReason,
  AiPageToolManifest,
  AiPageToolWriteResult,
} from './types';

const PAGE_TOOL_MANIFESTS = new Map<string, AiPageToolManifest>([
  [PRODUCTION_ORDER_TOOL_MANIFEST.pageId, PRODUCTION_ORDER_TOOL_MANIFEST],
  [WAREHOUSE_MASTER_TOOL_MANIFEST.pageId, WAREHOUSE_MASTER_TOOL_MANIFEST],
]);

const WAREHOUSE_TYPES = ['RAW', 'WIP', 'FG', 'FLOOR', 'DEFECT', 'SCRAP', 'SUBCON'];

@Injectable()
export class AiPageToolsService {
  constructor(
    @Optional()
    @InjectRepository(PartMaster)
    private readonly partRepo?: Repository<PartMaster>,
    @Optional()
    @InjectRepository(ProdLineMaster)
    private readonly lineRepo?: Repository<ProdLineMaster>,
    @Optional()
    @InjectRepository(ProcessMaster)
    private readonly processRepo?: Repository<ProcessMaster>,
    @Optional()
    @InjectRepository(EquipMaster)
    private readonly equipRepo?: Repository<EquipMaster>,
    @Optional()
    private readonly warehouseService?: WarehouseService,
  ) {}

  getManifest(pageId: string): AiPageToolManifest {
    const manifest = PAGE_TOOL_MANIFESTS.get(pageId);
    if (!manifest) {
      throw new BadRequestException(`지원하지 않는 AI 페이지 도구입니다: ${pageId}`);
    }
    return manifest;
  }

  async executeBackendTool(
    pageId: string,
    toolName: string,
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolCandidateResult | AiPageToolWriteResult> {
    const manifest = this.getManifest(pageId);
    const tool = manifest.tools.find((item) => item.name === toolName);
    if (!tool) throw new BadRequestException(`현재 페이지에서 사용할 수 없는 도구입니다: ${toolName}`);
    if (tool.source !== 'backend') throw new BadRequestException(`프론트엔드 전용 도구입니다: ${toolName}`);

    if (pageId === 'production.order') {
      // 1차 표준: 작업지시는 read 후보조회만 서버 실행(쓰기는 초안 흐름).
      if (tool.riskLevel !== 'read') {
        throw new BadRequestException('작업지시 페이지에서는 후보조회(read) 도구만 서버에서 실행합니다.');
      }
      switch (toolName) {
        case 'resolveItemCandidates':
          return this.resolveItemCandidates(String(input.query ?? ''), company, plant);
        case 'resolveLineCandidates':
          return this.resolveLineCandidates(String(input.query ?? ''), company, plant);
        case 'resolveProcessCandidates':
          return this.resolveProcessCandidates(String(input.query ?? ''), company, plant);
        case 'resolveEquipmentCandidates':
          return this.resolveEquipmentCandidates(
            String(input.processCode ?? ''),
            String(input.query ?? ''),
            company,
            plant,
          );
        default:
          throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
      }
    }

    if (pageId === 'master.warehouse') {
      // write 도구. 채팅은 사용자 승인 후에만 이 엔드포인트를 호출한다.
      if (toolName === 'createWarehouse') return this.createWarehouse(input, company, plant);
      throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }

    throw new BadRequestException(`구현되지 않은 페이지 도구입니다: ${pageId}`);
  }

  /** 창고 등록 (WarehouseService 재사용 → 중복체크·검증 준수) */
  private async createWarehouse(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.warehouseService) throw new BadRequestException('창고 서비스가 준비되지 않았습니다.');
    const warehouseCode = String(input.warehouseCode ?? '').trim();
    const warehouseName = String(input.warehouseName ?? '').trim();
    const warehouseType = String(input.warehouseType ?? '').trim().toUpperCase();
    if (!warehouseCode || !warehouseName || !warehouseType) {
      throw new BadRequestException('창고코드·창고명·창고유형이 모두 필요합니다.');
    }
    if (!WAREHOUSE_TYPES.includes(warehouseType)) {
      throw new BadRequestException(`창고유형이 올바르지 않습니다(${WAREHOUSE_TYPES.join('/')}): ${warehouseType}`);
    }
    const saved = await this.warehouseService.create(
      { warehouseCode, warehouseName, warehouseType, isDefault: input.isDefault === true },
      company,
      plant,
    );
    return {
      status: 'ok',
      toolName: 'createWarehouse',
      summary: `창고 '${saved.warehouseName}'(${saved.warehouseCode}, ${saved.warehouseType})를 등록했습니다.`,
      result: {
        warehouseCode: saved.warehouseCode,
        warehouseName: saved.warehouseName,
        warehouseType: saved.warehouseType,
      },
    };
  }

  private async resolveItemCandidates(
    query: string,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolCandidateResult> {
    if (!this.partRepo) throw new BadRequestException('품목 후보 조회 저장소가 준비되지 않았습니다.');
    const normalized = query.trim();
    if (!normalized) return this.toCandidateResult([], 'not_found');
    const like = `%${normalized}%`;
    const rows = await this.partRepo.find({
      where: [
        { itemCode: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { itemName: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { modelName: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { custPartNo: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      ],
      take: 10,
      order: { itemCode: 'ASC' },
    });
    const candidates = this.uniqueBy(rows, (row) => row.itemCode).map((row) => ({
      itemCode: row.itemCode,
      itemName: row.itemName,
      itemType: row.itemType,
      modelName: row.modelName,
      custPartNo: row.custPartNo,
    }));
    const exact = candidates.length === 1 && candidates[0].itemCode.toUpperCase() === normalized.toUpperCase();
    return this.toCandidateResult(candidates, this.reasonForCandidates(candidates.length, exact));
  }

  private async resolveLineCandidates(
    query: string,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolCandidateResult> {
    if (!this.lineRepo) throw new BadRequestException('라인 후보 조회 저장소가 준비되지 않았습니다.');
    const normalized = query.trim();
    const like = `%${normalized}%`;
    const rows = await this.lineRepo.find({
      where: normalized
        ? [
            { lineCode: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
            { lineName: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          ]
        : { useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      take: 10,
      order: { lineCode: 'ASC' },
    });
    const candidates = this.uniqueBy(rows, (row) => row.lineCode).map((row) => ({
      lineCode: row.lineCode,
      lineName: row.lineName,
      lineType: row.lineType,
    }));
    const exact = candidates.length === 1 && candidates[0].lineCode.toUpperCase() === normalized.toUpperCase();
    return this.toCandidateResult(candidates, this.reasonForCandidates(candidates.length, exact));
  }

  private async resolveProcessCandidates(
    query: string,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolCandidateResult> {
    if (!this.processRepo) throw new BadRequestException('공정 후보 조회 저장소가 준비되지 않았습니다.');
    const normalized = query.trim();
    const like = `%${normalized}%`;
    const rows = await this.processRepo.find({
      where: normalized
        ? [
            { processCode: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
            { processName: Like(like), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          ]
        : { useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      take: 10,
      order: { sortOrder: 'ASC', processCode: 'ASC' },
    });
    const candidates = this.uniqueBy(rows, (row) => row.processCode).map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      processType: row.processType,
      lineType: row.lineType,
    }));
    const exact = candidates.length === 1 && candidates[0].processCode.toUpperCase() === normalized.toUpperCase();
    return this.toCandidateResult(candidates, this.reasonForCandidates(candidates.length, exact));
  }

  private async resolveEquipmentCandidates(
    processCode: string,
    query: string,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolCandidateResult> {
    if (!this.equipRepo) throw new BadRequestException('설비 후보 조회 저장소가 준비되지 않았습니다.');
    const normalizedProcess = processCode.trim();
    if (!normalizedProcess) throw new BadRequestException('설비 후보 조회에는 processCode가 필요합니다.');
    const normalized = query.trim();
    const like = `%${normalized}%`;
    const tenant = { ...(company ? { company } : {}), ...(plant ? { plant } : {}) };
    const rows = await this.equipRepo.find({
      where: normalized
        ? [
            { processCode: normalizedProcess, equipCode: Like(like), useYn: 'Y', ...tenant },
            { processCode: normalizedProcess, equipName: Like(like), useYn: 'Y', ...tenant },
          ]
        : { processCode: normalizedProcess, useYn: 'Y', ...tenant },
      take: 10,
      order: { equipCode: 'ASC' },
    });
    const candidates = this.uniqueBy(rows, (row) => row.equipCode).map((row) => ({
      equipCode: row.equipCode,
      equipName: row.equipName,
      processCode: row.processCode,
      lineCode: row.lineCode,
      status: row.status,
    }));
    const exact = candidates.length === 1 && candidates[0].equipCode.toUpperCase() === normalized.toUpperCase();
    return this.toCandidateResult(candidates, this.reasonForCandidates(candidates.length, exact));
  }

  private reasonForCandidates(count: number, exactCodeSingleMatch: boolean): AiPageToolConfirmationReason {
    if (count === 0) return 'not_found';
    if (count > 1) return 'multiple_candidates';
    return exactCodeSingleMatch ? 'none' : 'single_name_match';
  }

  private toCandidateResult<TCandidate>(
    candidates: TCandidate[],
    reason: AiPageToolConfirmationReason,
  ): AiPageToolCandidateResult<TCandidate> {
    return {
      status: 'ok',
      candidates,
      confirmation: {
        required: reason !== 'none',
        reason,
      },
    };
  }

  private uniqueBy<TItem>(items: TItem[], key: (item: TItem) => string): TItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const value = key(item);
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
}
