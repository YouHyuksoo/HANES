/**
 * @file iqc-part-spec.service.ts
 * @description 품목별 IQC 기준 CRUD 서비스
 *
 * 초보자 가이드:
 * 1. findByItemCode: 품목코드로 헤더+검사항목 조회
 * 2. upsert: 헤더 없으면 INSERT, 있으면 UPDATE + 검사항목 전체 교체
 * 3. delete: 헤더 삭제 (CASCADE로 세부항목 자동 삭제)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { IqcPartSpec } from '../../../entities/iqc-part-spec.entity';
import { IqcPartSpecItem } from '../../../entities/iqc-part-spec-item.entity';
import { UpsertIqcPartSpecDto } from '../dto/iqc-part-spec.dto';

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

  async resolveItems(
    itemCode: string,
    company?: string,
    plant?: string,
  ): Promise<Array<{
    itemCode: string;
    seq: number;
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
  }>> {
    const spec = await this.findByItemCode(itemCode, company, plant);
    if (!spec || !spec.items || spec.items.length === 0) return [];

    return spec.items
      .filter((item) => item.useYn === 'Y' && item.inspItem)
      .sort((a, b) => a.seq - b.seq)
      .map((item) => ({
        itemCode,
        seq: item.seq,
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
      }));
  }

  async delete(itemCode: string, company?: string, plant?: string): Promise<void> {
    const spec = await this.specRepo.findOne({ where: { itemCode, ...this.tenantWhere(company, plant) } });
    if (!spec) throw new NotFoundException(`IQC 기준이 없습니다: ${itemCode}`);
    await this.specRepo.remove(spec);
  }
}
