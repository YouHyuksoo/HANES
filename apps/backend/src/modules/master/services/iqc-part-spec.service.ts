/**
 * @file iqc-part-spec.service.ts
 * @description 품목별 IQC 기준 CRUD 서비스
 *
 * 초보자 가이드:
 * 1. findByItemCode: 품목코드로 헤더+검사항목 조회
 * 2. upsert: 헤더 없으면 INSERT, 있으면 UPDATE + 검사항목 전체 교체
 * 3. delete: 헤더 삭제 (CASCADE로 세부항목 자동 삭제)
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { IqcPartSpec } from '../../../entities/iqc-part-spec.entity';
import { IqcPartSpecItem } from '../../../entities/iqc-part-spec-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { AqlStandard } from '../../../entities/aql-standard.entity';
import { AqlSamplingRule } from '../../../entities/aql-sampling-rule.entity';
import { IqcPartChoicesQueryDto, UpsertIqcPartSpecDto } from '../dto/iqc-part-spec.dto';

@Injectable()
export class IqcPartSpecService {
  constructor(
    @InjectRepository(IqcPartSpec)
    private readonly specRepo: Repository<IqcPartSpec>,
    @InjectRepository(IqcPartSpecItem)
    private readonly itemRepo: Repository<IqcPartSpecItem>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /** Matches resolveItems: assigned detail is active and references an existing pool item. */
  async findPartChoices(query: IqcPartChoicesQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, useYn, hasInspectItems, search } = query;
    const bindings: unknown[] = [company, plant];
    const filters = ["p.COMPANY = :1", "p.PLANT_CD = :2", "p.ITEM_TYPE = 'RAW_MATERIAL'"];
    if (useYn) {
      bindings.push(useYn);
      filters.push(`p.USE_YN = :${bindings.length}`);
    }
    if (search?.trim()) {
      bindings.push(`%${search.trim().toUpperCase()}%`, `%${search.trim().toUpperCase()}%`);
      filters.push(`(UPPER(p.ITEM_CODE) LIKE :${bindings.length - 1} OR UPPER(p.ITEM_NAME) LIKE :${bindings.length})`);
    }
    const assignedCount = `(SELECT COUNT(*) FROM IQC_PART_SPECS s
      JOIN IQC_PART_SPEC_ITEMS i ON i.COMPANY = s.COMPANY AND i.PLANT_CD = s.PLANT_CD AND i.ITEM_CODE = s.ITEM_CODE
      JOIN IQC_ITEM_POOL pool ON pool.COMPANY = i.COMPANY AND pool.PLANT_CD = i.PLANT_CD AND pool.INSP_ITEM_CODE = i.INSP_ITEM_CODE
      WHERE s.COMPANY = p.COMPANY AND s.PLANT_CD = p.PLANT_CD AND s.ITEM_CODE = p.ITEM_CODE AND i.USE_YN = 'Y')`;
    if (hasInspectItems) filters.push(`${assignedCount} ${hasInspectItems === 'Y' ? '> 0' : '= 0'}`);
    const where = filters.join(' AND ');
    const [data, counts] = await Promise.all([
      this.specRepo.manager.query(`SELECT p.ITEM_CODE AS "itemCode", p.ITEM_NAME AS "itemName",
        p.USE_YN AS "useYn", p.SAMPLE_QTY AS "sampleQty", p.IQC_AQL_POLICY_CODE AS "iqcAqlPolicyCode",
        ${assignedCount} AS "inspectItemCount"
        FROM ITEM_MASTERS p WHERE ${where} ORDER BY p.ITEM_CODE
        OFFSET :${bindings.length + 1} ROWS FETCH NEXT :${bindings.length + 2} ROWS ONLY`, [...bindings, (page - 1) * limit, limit]),
      this.specRepo.manager.query(`SELECT COUNT(*) AS "total" FROM ITEM_MASTERS p WHERE ${where}`, bindings),
    ]);
    return { data, total: Number(counts[0]?.total ?? 0), page, limit };
  }

  async findByItemCode(itemCode: string, company?: string, plant?: string): Promise<IqcPartSpec | null> {
    return this.specRepo.findOne({
      where: { itemCode, ...this.tenantWhere(company, plant) },
      relations: ['items', 'items.inspItem'],
      order: { items: { seq: 'ASC' } },
    });
  }

  async findAll(company?: string, plant?: string, page = 1, limit = 500) {
    const skip = (page - 1) * limit;
    const qb = this.specRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.items', 'i')
      .orderBy('s.itemCode', 'ASC')
      .addOrderBy('i.seq', 'ASC');

    if (company) qb.andWhere('s.company = :company', { company });
    if (plant)   qb.andWhere('s.plant = :plant', { plant });

    const countQb = this.specRepo.createQueryBuilder('s');
    if (company) countQb.andWhere('s.company = :company', { company });
    if (plant)   countQb.andWhere('s.plant = :plant', { plant });

    const [data, total] = await Promise.all([
      qb.skip(skip).take(limit).getMany(),
      countQb.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async upsert(
    dto: UpsertIqcPartSpecDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<IqcPartSpec> {
    return this.tx.run(async (queryRunner) => {
      const tenantWhere = this.tenantWhere(company, plant);
      await this.assertAqlItemStandardsExist(dto, company, plant, queryRunner.manager);
      let spec = await queryRunner.manager.findOne(IqcPartSpec, { where: { itemCode: dto.itemCode, ...tenantWhere } });

      if (!spec) {
        spec = queryRunner.manager.create(IqcPartSpec, {
          itemCode: dto.itemCode,
          sampleQty: dto.sampleQty,
          isDest: dto.isDest,
          useYn: dto.useYn ?? 'Y',
          company,
          plant,
          createdBy: userId,
          updatedBy: userId,
        });
      } else {
        spec.sampleQty = dto.sampleQty;
        spec.isDest = dto.isDest;
        spec.useYn = dto.useYn ?? spec.useYn;
        spec.updatedBy = userId;
      }
      await queryRunner.manager.save(IqcPartSpec, spec);

      // 품목마스터(ITEM_MASTERS.SAMPLE_QTY)가 기본시료수의 기준 —
      // 품목별 IQC 기준에서 기본시료수를 저장하면 품목마스터 값도 동일하게 동기화한다.
      await queryRunner.manager.update(
        ItemMaster,
        { itemCode: dto.itemCode, ...tenantWhere },
        { sampleQty: dto.sampleQty, updatedBy: userId },
      );

      // 기존 검사항목 전체 삭제 후 재삽입
      await queryRunner.manager.delete(IqcPartSpecItem, { itemCode: dto.itemCode, ...tenantWhere });

      if (dto.items.length > 0) {
        const newItems = dto.items.map((it) =>
          queryRunner.manager.create(IqcPartSpecItem, {
            itemCode: dto.itemCode,
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            lsl: it.lsl ?? null,
            usl: it.usl ?? null,
            judgeCriteria: it.judgeCriteria ?? null,
            defectGrade: it.defectGrade ?? null,
            inspectionLevel: it.inspectionLevel ?? null,
            aql: it.aql ?? null,
            inspectionType: it.inspectionType ?? null,
            sampleMethod: it.sampleMethod ?? null,
            sampleQty: it.sampleQty ?? null,
            useYn: it.useYn ?? 'Y',
            company,
            plant,
            createdBy: userId,
            updatedBy: userId,
          }),
        );
        await queryRunner.manager.save(IqcPartSpecItem, newItems);
      }

      const saved = await queryRunner.manager.findOne(IqcPartSpec, {
        where: { itemCode: dto.itemCode, ...tenantWhere },
        relations: ['items', 'items.inspItem'],
        order: { items: { seq: 'ASC' } },
      });
      if (!saved) throw new NotFoundException(`IQC 기준이 없습니다: ${dto.itemCode}`);
      return saved;
    });
  }

  private async assertAqlItemStandardsExist(
    dto: UpsertIqcPartSpecDto,
    company: string,
    plant: string,
    manager: EntityManager,
  ) {
    for (const item of dto.items ?? []) {
      const inspectionType = String(item.inspectionType ?? 'AQL').trim().toUpperCase();
      const sampleMethod = String(item.sampleMethod ?? 'AQL').trim().toUpperCase();
      if (inspectionType !== 'AQL' || sampleMethod === 'FIXED' || item.aql == null || !item.inspectionLevel) continue;

      const inspectionLevel = String(item.inspectionLevel).trim().toUpperCase();
      const aqlValue = Number(item.aql);
      const standard = await manager.findOne(AqlStandard, {
        where: this.buildAqlStandardCodeCandidates(inspectionLevel, aqlValue)
          .map((aqlCode) => ({ company, plant, aqlCode, useYn: 'Y' })),
      });
      if (!standard) {
        throw new BadRequestException(`AQL 기준이 등록되지 않은 조합입니다: ${inspectionLevel} / ${aqlValue}`);
      }

      const ruleCount = await manager.count(AqlSamplingRule, {
        where: { company, plant, aqlCode: standard.aqlCode },
      });
      if (ruleCount === 0) {
        throw new BadRequestException(`AQL sampling rule이 없는 기준입니다: ${standard.aqlCode}`);
      }
    }
  }

  private buildAqlStandardCodeCandidates(inspectionLevel: string, aqlValue: number) {
    const level = inspectionLevel.trim().toUpperCase();
    const values = this.formatAqlValues(aqlValue);
    const codes: string[] = [];
    for (const mode of ['TIGHTENED', 'NORMAL', 'REDUCED']) {
      for (const value of values) codes.push(`AQL-${level}-${mode}-${value}`);
    }
    for (const value of values) codes.push(`AQL-${level}-${value}`);
    return [...new Set(codes.map((code) => code.trim().toUpperCase()))];
  }

  private formatAqlValues(aqlValue: number) {
    const raw = String(aqlValue);
    const fixed1 = Number.isInteger(aqlValue) ? aqlValue.toFixed(1) : raw;
    const trimmed = raw.replace(/\.0+$/, '');
    return [...new Set([raw, fixed1, trimmed])].filter(Boolean);
  }

  async resolveItems(
    itemCode: string,
    company?: string,
    plant?: string,
  ): Promise<Array<{
    itemCode: string;
    seq: number;
    inspItemCode: string;
    inspectItem: string;
    spec: string | null;
    lsl: number | null;
    usl: number | null;
    unit: string | null;
    judgeMethod: string;
    judgeCriteria: string | null;
    defectGrade: string | null;
    inspectionLevel: string | null;
    aql: number | null;
    inspectionType: string;
    sampleMethod: string;
    sampleQty: number | null;
  }>> {
    const spec = await this.findByItemCode(itemCode, company, plant);
    if (!spec || !spec.items || spec.items.length === 0) return [];

    return spec.items
      .filter((item) => item.useYn === 'Y' && item.inspItem)
      .sort((a, b) => a.seq - b.seq)
      .map((item) => ({
        itemCode,
        seq: item.seq,
        inspItemCode: item.inspItemCode,
        inspectItem: item.inspItem.inspItemName,
        spec: item.judgeCriteria ?? item.inspItem.criteria ?? null,
        lsl: item.lsl !== null ? item.lsl : (item.inspItem.lsl ?? null),
        usl: item.usl !== null ? item.usl : (item.inspItem.usl ?? null),
        unit: item.inspItem.unit ?? null,
        judgeMethod: item.inspItem.judgeMethod,
        judgeCriteria: item.judgeCriteria ?? item.inspItem.criteria ?? null,
        defectGrade: item.defectGrade ?? null,
        inspectionLevel: item.inspectionLevel ?? null,
        aql: item.aql != null ? Number(item.aql) : null,
        inspectionType: (item.inspectionType ?? 'AQL').toUpperCase(),
        sampleMethod: (item.sampleMethod ?? 'AQL').toUpperCase(),
        sampleQty: item.sampleQty != null ? Number(item.sampleQty) : null,
      }));
  }

  async delete(itemCode: string, company?: string, plant?: string): Promise<void> {
    const spec = await this.specRepo.findOne({ where: { itemCode, ...this.tenantWhere(company, plant) } });
    if (!spec) throw new NotFoundException(`IQC 기준이 없습니다: ${itemCode}`);
    await this.specRepo.remove(spec);
  }
}
