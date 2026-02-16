/**
 * @file src/modules/master/services/bom.service.ts
 * @description BOM 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. **findParents**: BOM에 등재된 모품목(부모품목) 목록 조회
 * 2. **findHierarchy**: 부모품목 ID 기준 재귀 트리 구조 조회
 * 3. **CRUD**: 추가/수정/삭제 모두 DB에 반영
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BomMaster } from '../../../entities/bom-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateBomDto, UpdateBomDto, BomQueryDto } from '../dto/bom.dto';

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(BomMaster)
    private readonly bomRepository: Repository<BomMaster>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
  ) {}

  /** 유효일자 필터 조건 생성 (validFrom <= date AND validTo >= date, NULL은 무제한) */
  private buildDateFilter(queryBuilder: any, effectiveDate?: string) {
    if (!effectiveDate) return queryBuilder;
    const d = new Date(effectiveDate);
    
    return queryBuilder
      .andWhere('(bom.validFrom IS NULL OR bom.validFrom <= :date)', { date: d })
      .andWhere('(bom.validTo IS NULL OR bom.validTo >= :date)', { date: d });
  }

  /** BOM에 등재된 모품목(부모품목) 목록 + 자품목 수 */
  async findParents(search?: string, effectiveDate?: string) {
    let queryBuilder = this.bomRepository.createQueryBuilder('bom')
      .select('bom.parentPartId', 'parentPartId')
      .addSelect('COUNT(bom.id)', 'bomCount')
      .where('bom.deletedAt IS NULL')
      .andWhere('bom.useYn = :useYn', { useYn: 'Y' })
      .groupBy('bom.parentPartId');

    queryBuilder = this.buildDateFilter(queryBuilder, effectiveDate);

    if (search) {
      // 부모 품목 정보 조회를 위해 PartMaster와 조인
      queryBuilder = queryBuilder
        .innerJoin(PartMaster, 'parent', 'parent.id = bom.parentPartId')
        .andWhere(
          '(UPPER(parent.partCode) LIKE UPPER(:search) OR UPPER(parent.partName) LIKE UPPER(:search) OR UPPER(parent.partNo) LIKE UPPER(:search))',
          { search: `%${search}%` }
        );
    }

    const grouped = await queryBuilder.getRawMany();

    if (grouped.length === 0) return [];

    const parentIds = grouped.map((g) => g.parentPartId);
    const parents = await this.partRepository.find({
      where: { id: parentIds as any, deletedAt: IsNull() },
      select: ['id', 'partCode', 'partName', 'partNo', 'partType'],
      order: { partCode: 'asc' },
    });

    const countMap = new Map(grouped.map((g) => [g.parentPartId, parseInt(g.bomCount, 10)]));
    return parents.map((p) => ({
      ...p,
      bomCount: countMap.get(p.id) || 0,
    }));
  }

  async findAll(query: BomQueryDto, company?: string) {
    const { page = 1, limit = 10, parentPartId, childPartId, revision } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.bomRepository.createQueryBuilder('bom')
      .leftJoinAndMapOne('bom.parentPart', PartMaster, 'parentPart', 'parentPart.id = bom.parentPartId')
      .leftJoinAndMapOne('bom.childPart', PartMaster, 'childPart', 'childPart.id = bom.childPartId')
      .where('bom.deletedAt IS NULL');

    if (company) {
      queryBuilder.andWhere('bom.company = :company', { company });
    }

    if (parentPartId) {
      queryBuilder.andWhere('bom.parentPartId = :parentPartId', { parentPartId });
    }

    if (childPartId) {
      queryBuilder.andWhere('bom.childPartId = :childPartId', { childPartId });
    }

    if (revision) {
      queryBuilder.andWhere('bom.revision = :revision', { revision });
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('bom.parentPartId', 'ASC')
        .addOrderBy('bom.seq', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const bom = await this.bomRepository.createQueryBuilder('bom')
      .leftJoinAndMapOne('bom.parentPart', PartMaster, 'parentPart', 'parentPart.id = bom.parentPartId')
      .leftJoinAndMapOne('bom.childPart', PartMaster, 'childPart', 'childPart.id = bom.childPartId')
      .where('bom.id = :id', { id })
      .andWhere('bom.deletedAt IS NULL')
      .getOne();

    if (!bom) throw new NotFoundException(`BOM을 찾을 수 없습니다: ${id}`);
    return bom;
  }

  async findByParentId(parentPartId: string, effectiveDate?: string) {
    let queryBuilder = this.bomRepository.createQueryBuilder('bom')
      .leftJoinAndSelect(PartMaster, 'childPart', 'childPart.id = bom.childPartId')
      .where('bom.parentPartId = :parentPartId', { parentPartId })
      .andWhere('bom.deletedAt IS NULL')
      .andWhere('bom.useYn = :useYn', { useYn: 'Y' });

    queryBuilder = this.buildDateFilter(queryBuilder, effectiveDate);

    return queryBuilder
      .orderBy('bom.seq', 'ASC')
      .getMany();
  }

  /** 재귀 트리 BOM 구조 조회 (depth 제한 + 유효일자 필터) */
  async findHierarchy(parentPartId: string, depth: number = 3, effectiveDate?: string) {
    const buildTree = async (partId: string, currentDepth: number): Promise<any[]> => {
      if (currentDepth > depth) return [];

      let queryBuilder = this.bomRepository.createQueryBuilder('bom')
        .leftJoinAndSelect(PartMaster, 'childPart', 'childPart.id = bom.childPartId')
        .where('bom.parentPartId = :partId', { partId })
        .andWhere('bom.deletedAt IS NULL')
        .andWhere('bom.useYn = :useYn', { useYn: 'Y' });

      queryBuilder = this.buildDateFilter(queryBuilder, effectiveDate);

      const children = await queryBuilder
        .orderBy('bom.seq', 'ASC')
        .getRawMany();

      return Promise.all(
        children.map(async (child) => ({
          id: child.bom_id,
          level: currentDepth,
          partCode: child.childPart_partCode,
          partNo: child.childPart_partNo,
          partName: child.childPart_partName,
          partType: child.childPart_partType,
          qtyPer: Number(child.bom_qtyPer),
          unit: child.childPart_unit,
          revision: child.bom_revision,
          seq: child.bom_seq,
          processCode: child.bom_processCode,
          side: child.bom_side,
          validFrom: child.bom_validFrom,
          validTo: child.bom_validTo,
          useYn: child.bom_useYn,
          childPartId: child.bom_childPartId,
          children: await buildTree(child.bom_childPartId, currentDepth + 1),
        })),
      );
    };

    return buildTree(parentPartId, 1);
  }

  async create(dto: CreateBomDto) {
    if (dto.parentPartId === dto.childPartId) {
      throw new ConflictException('상위 품목과 하위 품목이 같을 수 없습니다.');
    }

    const existing = await this.bomRepository.findOne({
      where: {
        parentPartId: dto.parentPartId,
        childPartId: dto.childPartId,
        revision: dto.revision ?? 'A',
        deletedAt: IsNull(),
      },
    });

    if (existing) throw new ConflictException('이미 존재하는 BOM입니다.');

    const bom = this.bomRepository.create({
      parentPartId: dto.parentPartId,
      childPartId: dto.childPartId,
      qtyPer: dto.qtyPer,
      seq: dto.seq ?? 0,
      revision: dto.revision ?? 'A',
      bomGrp: dto.bomGrp,
      processCode: dto.processCode,
      side: dto.side,
      ecoNo: dto.ecoNo,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    return this.bomRepository.save(bom);
  }

  async update(id: string, dto: UpdateBomDto) {
    await this.findById(id);
    
    const updateData: any = {};
    if (dto.qtyPer !== undefined) updateData.qtyPer = dto.qtyPer;
    if (dto.seq !== undefined) updateData.seq = dto.seq;
    if (dto.bomGrp !== undefined) updateData.bomGrp = dto.bomGrp;
    if (dto.processCode !== undefined) updateData.processCode = dto.processCode;
    if (dto.side !== undefined) updateData.side = dto.side;
    if (dto.ecoNo !== undefined) updateData.ecoNo = dto.ecoNo;
    if (dto.validFrom !== undefined) updateData.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) updateData.validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.bomRepository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.bomRepository.update(id, { deletedAt: new Date() });
    return { id, deletedAt: new Date() };
  }
}
