/**
 * @file src/modules/master/services/part.service.ts
 * @description 품목마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requiresIqcAqlPolicy } from '@harness/shared';
import { ItemMaster } from '../../../entities/item-master.entity';
import { IqcAqlPolicy } from '../../../entities/iqc-aql-policy.entity';
import { CreatePartDto, UpdatePartDto, PartQueryDto } from '../dto/part.dto';

@Injectable()
export class PartService {
  constructor(
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    @InjectRepository(IqcAqlPolicy)
    private readonly iqcAqlPolicyRepository: Repository<IqcAqlPolicy>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private async resolveIqcAqlPolicyCode(input: {
    iqcYn?: string | null;
    inspectMethod?: string | null;
    iqcAqlPolicyCode?: string | null;
    company?: string;
    plant?: string;
  }): Promise<string | null> {
    if (!requiresIqcAqlPolicy(input.iqcYn, input.inspectMethod)) return null;

    const policyCode = input.iqcAqlPolicyCode?.trim().toUpperCase();
    if (!policyCode) {
      throw new BadRequestException('유검사 IQC 대상 품목은 AQL 정책을 선택해야 합니다.');
    }

    const policy = await this.iqcAqlPolicyRepository.findOne({
      where: { policyCode, ...this.tenantWhere(input.company, input.plant) },
    });
    if (!policy) throw new BadRequestException('선택한 AQL 정책을 찾을 수 없습니다.');
    if (policy.useYn !== 'Y') throw new BadRequestException('사용 중지된 AQL 정책은 선택할 수 없습니다.');
    return policyCode;
  }

  async findAll(query: PartQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, itemType, itemTypes, search, useYn, iqcYn, inspectMethod, iqcAqlPolicyCode } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.partRepository.createQueryBuilder('p')

    if (company) {
      queryBuilder.andWhere('p.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('p.plant = :plant', { plant });
    }

    if (itemTypes && itemTypes.length > 0) {
      queryBuilder.andWhere('p.itemType IN (:...itemTypes)', { itemTypes });
    } else if (itemType) {
      queryBuilder.andWhere('p.itemType = :itemType', { itemType });
    }

    if (useYn) {
      queryBuilder.andWhere('p.useYn = :useYn', { useYn });
    }

    if (iqcYn) {
      queryBuilder.andWhere('p.iqcYn = :iqcYn', { iqcYn });
    }

    if (inspectMethod) {
      queryBuilder.andWhere('p.inspectMethod = :inspectMethod', { inspectMethod });
    }

    if (iqcAqlPolicyCode) {
      if (iqcAqlPolicyCode === '__NONE__') {
        queryBuilder.andWhere('p.iqcAqlPolicyCode IS NULL');
      } else {
        queryBuilder.andWhere('p.iqcAqlPolicyCode = :iqcAqlPolicyCode', { iqcAqlPolicyCode });
      }
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(p.itemCode LIKE :search OR p.itemName LIKE :searchRaw OR p.itemNo LIKE :search OR p.custPartNo LIKE :search OR p.modelName LIKE :searchRaw OR p.spec LIKE :searchRaw OR p.markingText LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('p.itemCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(itemCode: string, company?: string, plant?: string) {
    const part = await this.partRepository.findOne({
      where: { itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
    return part;
  }

  async findByCode(itemCode: string, company?: string, plant?: string) {
    const part = await this.partRepository.findOne({
      where: { itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
    return part;
  }

  async create(dto: CreatePartDto, company?: string, plant?: string) {
    const existing = await this.partRepository.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
    });

    if (existing) throw new ConflictException(`이미 존재하는 품목 코드입니다: ${dto.itemCode}`);

    const iqcAqlPolicyCode = await this.resolveIqcAqlPolicyCode({
      iqcYn: dto.iqcYn ?? 'Y',
      inspectMethod: dto.inspectMethod ?? null,
      iqcAqlPolicyCode: dto.iqcAqlPolicyCode ?? null,
      company,
      plant,
    });

    const part = this.partRepository.create({
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      itemNo: dto.itemNo,
      custPartNo: dto.custPartNo,
      itemType: dto.itemType,
      productType: dto.productType,
      modelName: dto.modelName ?? null,
      defectModelGroup: dto.defectModelGroup ?? null,
      spec: dto.spec,
      rev: dto.rev,
      markingText: dto.markingText,
      unit: dto.unit ?? 'EA',
      color: dto.color ?? null,
      drawNo: dto.drawNo,
      leadTime: dto.leadTime ?? 0,
      safetyStock: dto.safetyStock ?? 0,
      lotUnitQty: dto.lotUnitQty,
      boxQty: dto.boxQty ?? 0,
      minPackQty: dto.minPackQty ?? 0,
      iqcYn: dto.iqcYn ?? 'Y',
      inspectMethod: dto.inspectMethod ?? null,
      iqcAqlPolicyCode,
      tactTime: dto.tactTime ?? 0,
      expiryDate: dto.expiryDate ?? 0,
      expiryExtDays: dto.expiryExtDays ?? 0,
      toleranceRate: dto.toleranceRate ?? 5,
      isSplittable: dto.isSplittable ?? 'Y',
      sampleQty: dto.sampleQty ?? null,
      packUnit: dto.packUnit ?? null,
      storageLocation: dto.storageLocation ?? null,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
      imageUrl: dto.imageUrl,
      company,
      plant,
    });

    return this.partRepository.save(part);
  }

  async update(itemCode: string, dto: UpdatePartDto, company?: string, plant?: string) {
    const existing = await this.findById(itemCode, company, plant);
    const effectiveIqcYn = dto.iqcYn !== undefined ? dto.iqcYn : existing.iqcYn;
    const effectiveInspectMethod = dto.inspectMethod !== undefined ? dto.inspectMethod : existing.inspectMethod;
    const iqcAqlPolicyCode = await this.resolveIqcAqlPolicyCode({
      iqcYn: effectiveIqcYn,
      inspectMethod: effectiveInspectMethod,
      iqcAqlPolicyCode: dto.iqcAqlPolicyCode !== undefined ? dto.iqcAqlPolicyCode : existing.iqcAqlPolicyCode,
      company,
      plant,
    });

    const updateData: Partial<Pick<ItemMaster,
      | 'itemName'
      | 'itemNo'
      | 'custPartNo'
      | 'itemType'
      | 'productType'
      | 'modelName'
      | 'defectModelGroup'
      | 'spec'
      | 'rev'
      | 'markingText'
      | 'unit'
      | 'color'
      | 'drawNo'
      | 'leadTime'
      | 'safetyStock'
      | 'lotUnitQty'
      | 'boxQty'
      | 'iqcYn'
      | 'inspectMethod'
      | 'iqcAqlPolicyCode'
      | 'tactTime'
      | 'expiryDate'
      | 'expiryExtDays'
      | 'toleranceRate'
      | 'isSplittable'
      | 'sampleQty'
      | 'packUnit'
      | 'storageLocation'
      | 'imageUrl'
      | 'remark'
      | 'useYn'
    >> = {
      ...(dto.itemName !== undefined ? { itemName: dto.itemName } : {}),
      ...(dto.itemNo !== undefined ? { itemNo: dto.itemNo } : {}),
      ...(dto.custPartNo !== undefined ? { custPartNo: dto.custPartNo } : {}),
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.productType !== undefined ? { productType: dto.productType } : {}),
      ...(dto.modelName !== undefined ? { modelName: dto.modelName || null } : {}),
      ...(dto.defectModelGroup !== undefined ? { defectModelGroup: dto.defectModelGroup || null } : {}),
      ...(dto.spec !== undefined ? { spec: dto.spec } : {}),
      ...(dto.rev !== undefined ? { rev: dto.rev } : {}),
      ...(dto.markingText !== undefined ? { markingText: dto.markingText } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.color !== undefined ? { color: dto.color } : {}),
      ...(dto.drawNo !== undefined ? { drawNo: dto.drawNo } : {}),
      ...(dto.leadTime !== undefined ? { leadTime: dto.leadTime } : {}),
      ...(dto.safetyStock !== undefined ? { safetyStock: dto.safetyStock } : {}),
      ...(dto.lotUnitQty !== undefined ? { lotUnitQty: dto.lotUnitQty } : {}),
      ...(dto.boxQty !== undefined ? { boxQty: dto.boxQty } : {}),
      ...(dto.iqcYn !== undefined ? { iqcYn: dto.iqcYn } : {}),
      ...(dto.inspectMethod !== undefined ? { inspectMethod: dto.inspectMethod } : {}),
      ...((dto.iqcAqlPolicyCode !== undefined
        || iqcAqlPolicyCode !== existing.iqcAqlPolicyCode
        || !requiresIqcAqlPolicy(effectiveIqcYn, effectiveInspectMethod))
        ? { iqcAqlPolicyCode }
        : {}),
      ...(dto.tactTime !== undefined ? { tactTime: dto.tactTime } : {}),
      ...(dto.expiryDate !== undefined ? { expiryDate: dto.expiryDate } : {}),
      ...(dto.expiryExtDays !== undefined ? { expiryExtDays: dto.expiryExtDays } : {}),
      ...(dto.toleranceRate !== undefined ? { toleranceRate: dto.toleranceRate } : {}),
      ...(dto.isSplittable !== undefined ? { isSplittable: dto.isSplittable } : {}),
      ...(dto.sampleQty !== undefined ? { sampleQty: dto.sampleQty } : {}),
      ...(dto.packUnit !== undefined ? { packUnit: dto.packUnit } : {}),
      ...(dto.storageLocation !== undefined ? { storageLocation: dto.storageLocation } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.partRepository.update({ itemCode, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(itemCode, company, plant);
  }

  /**
   * 품목 삭제 가능 여부 검사 — 이력/사용처(FK 무관)가 있으면 삭제 차단.
   * 입하/입고/재고/롯트/BOM/생산계획 테이블은 ITEM_MASTERS와 FK로 묶여있지 않으므로
   * (FK는 PROD_PLANS 하나뿐) DB가 막아주지 못한다. 애플리케이션에서 참조 존재를 확인한다.
   */
  private async assertDeletable(itemCode: string, company?: string, plant?: string): Promise<void> {
    const params: unknown[] = [];
    const bind = (v: unknown): number => { params.push(v); return params.length; };
    // 서브쿼리마다 itemCode/tenant를 개별 바인드(바인드 재사용 이슈 회피)
    const codePred = (col = 'ITEM_CODE'): string => {
      let s = `${col} = :${bind(itemCode)}`;
      if (company) s += ` AND COMPANY = :${bind(company)}`;
      if (plant) s += ` AND PLANT_CD = :${bind(plant)}`;
      return s;
    };
    const bomPred = (): string => {
      let s = `(PARENT_ITEM_CODE = :${bind(itemCode)} OR CHILD_ITEM_CODE = :${bind(itemCode)})`;
      if (company) s += ` AND COMPANY = :${bind(company)}`;
      if (plant) s += ` AND PLANT_CD = :${bind(plant)}`;
      return s;
    };
    const sql =
      `SELECT ` +
      `(SELECT COUNT(*) FROM MAT_ARRIVALS   WHERE ${codePred()}) AS ARRIVAL, ` +
      `(SELECT COUNT(*) FROM MAT_RECEIVINGS WHERE ${codePred()}) AS RECEIVING, ` +
      `(SELECT COUNT(*) FROM MAT_STOCKS     WHERE ${codePred()}) AS STOCK, ` +
      `(SELECT COUNT(*) FROM MAT_LOTS       WHERE ${codePred()}) AS LOT, ` +
      `(SELECT COUNT(*) FROM BOM_MASTERS    WHERE ${bomPred()}) AS BOM, ` +
      `(SELECT COUNT(*) FROM PROD_PLANS     WHERE ${codePred()}) AS PRODPLAN ` +
      `FROM DUAL`;

    const rows = await this.partRepository.query<Array<Record<string, unknown>>>(sql, params);
    const r = rows?.[0] ?? {};
    const blockers: string[] = [];
    const add = (v: unknown, label: string): void => {
      const n = Number(v ?? 0);
      if (n > 0) blockers.push(`${label} ${n}건`);
    };
    add(r.ARRIVAL, '입하');
    add(r.RECEIVING, '입고');
    add(r.STOCK, '재고');
    add(r.LOT, '롯트');
    add(r.BOM, 'BOM');
    add(r.PRODPLAN, '생산계획');

    if (blockers.length > 0) {
      throw new ConflictException(
        `이력/사용처가 있는 품목은 삭제할 수 없습니다 (${blockers.join(', ')}). ` +
        `먼저 관련 데이터를 정리하거나, 품목을 미사용(useYn=N)으로 변경하세요.`,
      );
    }
  }

  async delete(itemCode: string, company?: string, plant?: string) {
    await this.findById(itemCode, company, plant);
    await this.assertDeletable(itemCode, company, plant);
    await this.partRepository.delete({ itemCode, ...this.tenantWhere(company, plant) });
    return { itemCode };
  }

  async updateImage(itemCode: string, imageUrl: string | null, company?: string, plant?: string) {
    await this.findById(itemCode, company, plant);
    await this.partRepository.update({ itemCode, ...this.tenantWhere(company, plant) }, { imageUrl });
    return this.findById(itemCode, company, plant);
  }

  async findByType(itemType: string, company?: string, plant?: string) {
    return this.partRepository.find({
      where: { itemType, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { itemCode: 'asc' },
    });
  }
}
