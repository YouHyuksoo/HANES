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
import { Repository, IsNull, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
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
    try {
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
      where: { id: In(parentIds), deletedAt: IsNull() },
      select: ['id', 'partCode', 'partName', 'partNo', 'partType'],
      order: { partCode: 'asc' },
    });

    const countMap = new Map(grouped.map((g) => [g.parentPartId, parseInt(g.bomCount, 10)]));
    return parents.map((p) => ({
      ...p,
      bomCount: countMap.get(p.id) || 0,
    }));
    } catch (error) {
      console.error('[BomService.findParents] Error:', error);
      throw error;
    }
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

  /** 
   * Oracle CONNECT BY로 BOM 계층 조회 (단일 쿼리)
   * START WITH: 시작 부모 품목
   * CONNECT BY PRIOR: 자식으로 재귀 탐색
   * LEVEL: 계층 깊이
   */
  async findHierarchy(parentPartId: string, depth: number = 3, effectiveDate?: string) {
    const dateFilter = effectiveDate 
      ? `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE('${effectiveDate}', 'YYYY-MM-DD'))
         AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE('${effectiveDate}', 'YYYY-MM-DD'))`
      : '';

    const query = `
      SELECT 
        b.ID as id,
        b.PARENT_PART_ID as parentPartId,
        b.CHILD_PART_ID as childPartId,
        b.QTY_PER as qtyPer,
        b.SEQ as seq,
        b.REVISION as revision,
        b.OPER as processCode,
        b.SIDE as side,
        b.VALID_FROM as validFrom,
        b.VALID_TO as validTo,
        b.USE_YN as useYn,
        p.PART_CODE as partCode,
        p.PART_NAME as partName,
        p.PART_NO as partNo,
        p.PART_TYPE as partType,
        p.UNIT as unit,
        LEVEL as lvl
      FROM BOM_MASTERS b
      JOIN PART_MASTERS p ON b.CHILD_PART_ID = p.ID
      WHERE b.DELETED_AT IS NULL 
        AND b.USE_YN = 'Y'
        ${dateFilter}
      START WITH b.PARENT_PART_ID = '${parentPartId}'
      CONNECT BY PRIOR b.CHILD_PART_ID = b.PARENT_PART_ID
        AND LEVEL <= ${depth}
        AND b.DELETED_AT IS NULL
        AND b.USE_YN = 'Y'
        ${dateFilter}
      ORDER SIBLINGS BY b.SEQ ASC
    `;

    const rawResults = await this.bomRepository.query(query);
    
    // 평면 데이터를 트리 구조로 변환
    return this.buildTreeFromFlatData(rawResults);
  }

  /** 평면 데이터를 트리 구조로 변환 */
  private buildTreeFromFlatData(rows: any[]): any[] {
    const map = new Map<string, any>();
    const roots: any[] = [];

    // 먼저 모든 노드를 맵에 저장
    for (const row of rows) {
      const node = {
        id: row.ID || row.id,
        level: Number(row.LVL || row.lvl),
        partCode: row.PARTCODE || row.partCode,
        partNo: row.PARTNO || row.partNo,
        partName: row.PARTNAME || row.partName,
        partType: row.PARTTYPE || row.partType,
        qtyPer: Number(row.QTYPER || row.qtyPer),
        unit: row.UNIT || row.unit,
        revision: row.REVISION || row.revision,
        seq: Number(row.SEQ || row.seq),
        processCode: row.PROCESSCODE || row.processCode,
        side: row.SIDE || row.side,
        validFrom: row.VALIDFROM || row.validFrom,
        validTo: row.VALIDTO || row.validTo,
        useYn: row.USEYN || row.useYn,
        childPartId: row.CHILDPARTID || row.childPartId,
        children: [],
      };
      map.set(node.id, node);
    }

    // 부모-자식 관계 설정
    for (const row of rows) {
      const nodeId = row.ID || row.id;
      const parentId = row.PARENTPARTID || row.parentPartId;
      const node = map.get(nodeId);
      
      // parentId가 현재 row들 중에 있는지 확인
      const parent = map.get(parentId);
      if (parent && parent.id !== node.id) {
        parent.children.push(node);
      } else if (node.level === 1) {
        roots.push(node);
      }
    }

    return roots;
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
