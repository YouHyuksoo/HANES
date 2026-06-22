import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { WarehouseService } from '../../inventory/services/warehouse.service';
import { WarehouseLocationService } from '../../inventory/services/warehouse-location.service';
import { TransferRuleService } from '../../master/services/transfer-rule.service';
import { AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';
import { WAREHOUSE_MASTER_TOOL_MANIFEST } from './warehouse-master.tools';

const WAREHOUSE_TYPES = ['RAW', 'WIP', 'FG', 'FLOOR', 'DEFECT', 'SCRAP', 'SUBCON'];

/**
 * 창고관리(/master/warehouse) 도구 Provider — 창고·로케이션·이동규칙 CRUD.
 * 모든 도구는 기존 도메인 서비스를 재사용(검증·중복체크·멀티테넌시 준수).
 */
@Injectable()
export class WarehouseToolsProvider implements PageToolProvider {
  readonly pageId = WAREHOUSE_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = WAREHOUSE_MASTER_TOOL_MANIFEST;

  constructor(
    @Optional() private readonly warehouseService?: WarehouseService,
    @Optional() private readonly locationService?: WarehouseLocationService,
    @Optional() private readonly transferRuleService?: TransferRuleService,
  ) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createWarehouse':
        return this.createWarehouse(input, company, plant);
      case 'updateWarehouse':
        return this.updateWarehouse(input, company, plant);
      case 'deleteWarehouse':
        return this.deleteWarehouse(input, company, plant);
      case 'createLocation':
        return this.createLocation(input, company, plant);
      case 'updateLocation':
        return this.updateLocation(input, company, plant);
      case 'deleteLocation':
        return this.deleteLocation(input, company, plant);
      case 'createTransferRule':
        return this.createTransferRule(input, company, plant);
      case 'updateTransferRule':
        return this.updateTransferRule(input, company, plant);
      case 'deleteTransferRule':
        return this.deleteTransferRule(input, company, plant);
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

  private normalizeWhType(v: unknown): string {
    const wt = this.str(v).toUpperCase();
    if (!WAREHOUSE_TYPES.includes(wt)) {
      throw new BadRequestException(`창고유형이 올바르지 않습니다(${WAREHOUSE_TYPES.join('/')}): ${wt}`);
    }
    return wt;
  }

  private async createWarehouse(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.warehouseService) throw new BadRequestException('창고 서비스가 준비되지 않았습니다.');
    const warehouseCode = this.str(input.warehouseCode);
    const warehouseName = this.str(input.warehouseName);
    if (!warehouseCode || !warehouseName) throw new BadRequestException('창고코드·창고명이 필요합니다.');
    const warehouseType = this.normalizeWhType(input.warehouseType);
    const saved = await this.warehouseService.create(
      { warehouseCode, warehouseName, warehouseType, isDefault: input.isDefault === true },
      company,
      plant,
    );
    return this.result('createWarehouse', `창고 '${saved.warehouseName}'(${saved.warehouseCode}, ${saved.warehouseType})를 등록했습니다.`, {
      warehouseCode: saved.warehouseCode,
      warehouseName: saved.warehouseName,
      warehouseType: saved.warehouseType,
    });
  }

  private async updateWarehouse(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.warehouseService) throw new BadRequestException('창고 서비스가 준비되지 않았습니다.');
    const warehouseCode = this.str(input.warehouseCode);
    if (!warehouseCode) throw new BadRequestException('창고코드가 필요합니다.');
    const dto: { warehouseName?: string; warehouseType?: string; isDefault?: boolean } = {};
    if (input.warehouseName !== undefined) dto.warehouseName = this.str(input.warehouseName);
    if (input.warehouseType !== undefined) dto.warehouseType = this.normalizeWhType(input.warehouseType);
    if (input.isDefault !== undefined) dto.isDefault = input.isDefault === true;
    await this.warehouseService.update(warehouseCode, dto, company, plant);
    return this.result('updateWarehouse', `창고 ${warehouseCode}를 수정했습니다.`, { warehouseCode });
  }

  private async deleteWarehouse(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.warehouseService) throw new BadRequestException('창고 서비스가 준비되지 않았습니다.');
    const warehouseCode = this.str(input.warehouseCode);
    if (!warehouseCode) throw new BadRequestException('창고코드가 필요합니다.');
    await this.warehouseService.remove(warehouseCode, company, plant);
    return this.result('deleteWarehouse', `창고 ${warehouseCode}를 삭제했습니다.`, { warehouseCode });
  }

  private async createLocation(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.locationService) throw new BadRequestException('로케이션 서비스가 준비되지 않았습니다.');
    const warehouseCode = this.str(input.warehouseCode);
    const locationCode = this.str(input.locationCode);
    const locationName = this.str(input.locationName);
    if (!warehouseCode || !locationCode || !locationName) {
      throw new BadRequestException('창고코드·로케이션코드·로케이션명이 필요합니다.');
    }
    await this.locationService.create(
      { warehouseCode, locationCode, locationName, zone: this.str(input.zone) || undefined },
      company,
      plant,
    );
    return this.result('createLocation', `로케이션 ${locationCode}(${locationName})를 창고 ${warehouseCode}에 등록했습니다.`, {
      warehouseCode,
      locationCode,
    });
  }

  private async updateLocation(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.locationService) throw new BadRequestException('로케이션 서비스가 준비되지 않았습니다.');
    const warehouseCode = this.str(input.warehouseCode);
    const locationCode = this.str(input.locationCode);
    if (!warehouseCode || !locationCode) throw new BadRequestException('창고코드·로케이션코드가 필요합니다.');
    const dto: { locationName?: string; zone?: string; useYn?: string } = {};
    if (input.locationName !== undefined) dto.locationName = this.str(input.locationName);
    if (input.zone !== undefined) dto.zone = this.str(input.zone);
    if (input.useYn !== undefined) dto.useYn = this.str(input.useYn).toUpperCase();
    await this.locationService.update(`${warehouseCode}::${locationCode}`, dto, company, plant);
    return this.result('updateLocation', `로케이션 ${warehouseCode}/${locationCode}를 수정했습니다.`, { warehouseCode, locationCode });
  }

  private async deleteLocation(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.locationService) throw new BadRequestException('로케이션 서비스가 준비되지 않았습니다.');
    const warehouseCode = this.str(input.warehouseCode);
    const locationCode = this.str(input.locationCode);
    if (!warehouseCode || !locationCode) throw new BadRequestException('창고코드·로케이션코드가 필요합니다.');
    await this.locationService.remove(`${warehouseCode}::${locationCode}`, company, plant);
    return this.result('deleteLocation', `로케이션 ${warehouseCode}/${locationCode}를 삭제했습니다.`, { warehouseCode, locationCode });
  }

  private async createTransferRule(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.transferRuleService) throw new BadRequestException('이동규칙 서비스가 준비되지 않았습니다.');
    const fromWarehouseId = this.str(input.fromWarehouseId);
    const toWarehouseId = this.str(input.toWarehouseId);
    if (!fromWarehouseId || !toWarehouseId) throw new BadRequestException('출발/도착 창고코드가 필요합니다.');
    const allowYn = input.allowYn !== undefined ? this.str(input.allowYn).toUpperCase() : undefined;
    await this.transferRuleService.create({ fromWarehouseId, toWarehouseId, ...(allowYn ? { allowYn } : {}) }, company, plant);
    return this.result('createTransferRule', `이동규칙 ${fromWarehouseId}→${toWarehouseId}(${allowYn ?? 'Y'})를 등록했습니다.`, {
      fromWarehouseId,
      toWarehouseId,
    });
  }

  private async updateTransferRule(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.transferRuleService) throw new BadRequestException('이동규칙 서비스가 준비되지 않았습니다.');
    const fromWarehouseId = this.str(input.fromWarehouseId);
    const toWarehouseId = this.str(input.toWarehouseId);
    if (!fromWarehouseId || !toWarehouseId) throw new BadRequestException('출발/도착 창고코드가 필요합니다.');
    const dto: { allowYn?: string } = {};
    if (input.allowYn !== undefined) dto.allowYn = this.str(input.allowYn).toUpperCase();
    await this.transferRuleService.update(fromWarehouseId, toWarehouseId, dto, company, plant);
    return this.result('updateTransferRule', `이동규칙 ${fromWarehouseId}→${toWarehouseId}를 수정했습니다.`, { fromWarehouseId, toWarehouseId });
  }

  private async deleteTransferRule(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.transferRuleService) throw new BadRequestException('이동규칙 서비스가 준비되지 않았습니다.');
    const fromWarehouseId = this.str(input.fromWarehouseId);
    const toWarehouseId = this.str(input.toWarehouseId);
    if (!fromWarehouseId || !toWarehouseId) throw new BadRequestException('출발/도착 창고코드가 필요합니다.');
    await this.transferRuleService.delete(fromWarehouseId, toWarehouseId, company, plant);
    return this.result('deleteTransferRule', `이동규칙 ${fromWarehouseId}→${toWarehouseId}를 삭제했습니다.`, { fromWarehouseId, toWarehouseId });
  }
}
