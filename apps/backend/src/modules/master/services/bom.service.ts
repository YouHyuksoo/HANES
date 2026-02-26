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
import { Repository, In } from 'typeorm';
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
        .select('bom.parentItemCode', 'parentItemCode')
        .addSelect('COUNT(bom.id)', 'bomCount')
        .where('bom.useYn = :useYn', { useYn: 'Y' })
        .groupBy('bom.parentItemCode');

      queryBuilder = this.buildDateFilter(queryBuilder, effectiveDate);

    if (search) {
      // 부모 품목 정보 조회를 위해 PartMaster와 조인
      queryBuilder = queryBuilder
        .innerJoin(PartMaster, 'parent', 'parent.itemCode = bom.parentItemCode')
        .andWhere(
          '(UPPER(parent.itemCode) LIKE UPPER(:search) OR UPPER(parent.itemName) LIKE UPPER(:search) OR UPPER(parent.itemNo) LIKE UPPER(:search))',
          { search: `%${search}%` }
        );
    }

    const grouped = await queryBuilder.getRawMany();

    if (grouped.length === 0) return [];

    const parentIds = grouped.map((g) => g.parentItemCode);
    const parents = await this.partRepository.find({
      where: { itemCode: In(parentIds) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'spec', 'unit', 'customer', 'remark'],
      order: { itemCode: 'asc' },
    });

    const countMap = new Map(grouped.map((g) => [g.parentItemCode, parseInt(g.bomCount, 10)]));
    return parents.map((p) => ({
      ...p,
      bomCount: countMap.get(p.itemCode) || 0,
    }));
    } catch (error) {
      console.error('[BomService.findParents] Error:', error);
      throw error;
    }
  }

  async findAll(query: BomQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, parentItemCode, childItemCode, revision } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.bomRepository.createQueryBuilder('bom')
      .leftJoinAndMapOne('bom.parentPart', PartMaster, 'parentPart', 'parentPart.itemCode = bom.parentItemCode')
      .leftJoinAndMapOne('bom.childPart', PartMaster, 'childPart', 'childPart.itemCode = bom.childItemCode')

    if (company) {
      queryBuilder.andWhere('bom.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('bom.plant = :plant', { plant });
    }

    if (parentItemCode) {
      queryBuilder.andWhere('bom.parentItemCode = :parentItemCode', { parentItemCode });
    }

    if (childItemCode) {
      queryBuilder.andWhere('bom.childItemCode = :childItemCode', { childItemCode });
    }

    if (revision) {
      queryBuilder.andWhere('bom.revision = :revision', { revision });
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('bom.parentItemCode', 'ASC')
        .addOrderBy('bom.seq', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    // id is composite key encoded as "parentItemCode::childItemCode::revision"
    const [parentItemCode, childItemCode, revision] = id.split('::');
    const bom = await this.bomRepository.createQueryBuilder('bom')
      .leftJoinAndMapOne('bom.parentPart', PartMaster, 'parentPart', 'parentPart.itemCode = bom.parentItemCode')
      .leftJoinAndMapOne('bom.childPart', PartMaster, 'childPart', 'childPart.itemCode = bom.childItemCode')
      .where('bom.parentItemCode = :parentItemCode', { parentItemCode })
      .andWhere('bom.childItemCode = :childItemCode', { childItemCode })
      .andWhere('bom.revision = :revision', { revision: revision || 'A' })
      .getOne();

    if (!bom) throw new NotFoundException(`BOM을 찾을 수 없습니다: ${id}`);
    return bom;
  }

  async findByParentId(parentItemCode: string, effectiveDate?: string) {
    let queryBuilder = this.bomRepository.createQueryBuilder('bom')
      .leftJoinAndSelect(PartMaster, 'childPart', 'childPart.itemCode = bom.childItemCode')
      .where('bom.parentItemCode = :parentItemCode', { parentItemCode })
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
  async findHierarchy(parentItemCode: string, depth: number = 3, effectiveDate?: string) {
    const safeDepth = Math.min(Math.max(Math.floor(Number(depth) || 3), 1), 10);
    const params: string[] = [];

    let dateFilter = '';
    if (effectiveDate) {
      params.push(effectiveDate, effectiveDate);
      dateFilter = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${params.length - 1}, 'YYYY-MM-DD'))
         AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${params.length}, 'YYYY-MM-DD'))`;
    }

    const parentIdx = params.length + 1;
    params.push(parentItemCode);

    let dateFilterConnect = '';
    if (effectiveDate) {
      params.push(effectiveDate, effectiveDate);
      dateFilterConnect = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${params.length - 1}, 'YYYY-MM-DD'))
         AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${params.length}, 'YYYY-MM-DD'))`;
    }

    const query = `
      SELECT
        b.ID as id,
        b.PARENT_ITEM_CODE as parentItemCode,
        b.CHILD_ITEM_CODE as childItemCode,
        b.QTY_PER as qtyPer,
        b.SEQ as seq,
        b.REVISION as revision,
        b.OPER as processCode,
        b.SIDE as side,
        b.VALID_FROM as validFrom,
        b.VALID_TO as validTo,
        b.USE_YN as useYn,
        p.ITEM_CODE as itemCode,
        p.ITEM_NAME as itemName,
        p.PART_NO as partNo,
        p.PART_TYPE as itemType,
        p.UNIT as unit,
        LEVEL as lvl
      FROM BOM_MASTERS b
      JOIN ITEM_MASTERS p ON b.CHILD_ITEM_CODE = p.ITEM_CODE
      WHERE b.DELETED_AT IS NULL
        AND b.USE_YN = 'Y'
        ${dateFilter}
      START WITH b.PARENT_ITEM_CODE = :${parentIdx}
      CONNECT BY PRIOR b.CHILD_ITEM_CODE = b.PARENT_ITEM_CODE
        AND LEVEL <= ${safeDepth}
        AND b.DELETED_AT IS NULL
        AND b.USE_YN = 'Y'
        ${dateFilterConnect}
      ORDER SIBLINGS BY b.SEQ ASC
    `;

    const rawResults = await this.bomRepository.query(query, params);
    
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
        itemCode: row.PARTCODE || row.itemCode,
        partNo: row.PARTNO || row.partNo,
        itemName: row.PARTNAME || row.itemName,
        itemType: row.PARTTYPE || row.itemType,
        qtyPer: Number(row.QTYPER || row.qtyPer),
        unit: row.UNIT || row.unit,
        revision: row.REVISION || row.revision,
        seq: Number(row.SEQ || row.seq),
        processCode: row.PROCESSCODE || row.processCode,
        side: row.SIDE || row.side,
        validFrom: row.VALIDFROM || row.validFrom,
        validTo: row.VALIDTO || row.validTo,
        useYn: row.USEYN || row.useYn,
        childItemCode: row.CHILDITEMCODE || row.childItemCode,
        children: [],
      };
      map.set(node.id, node);
    }

    // 부모-자식 관계 설정
    for (const row of rows) {
      const nodeId = row.ID || row.id;
      const parentId = row.PARENTITEMCODE || row.parentItemCode;
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
    if (dto.parentItemCode === dto.childItemCode) {
      throw new ConflictException('상위 품목과 하위 품목이 같을 수 없습니다.');
    }

    const existing = await this.bomRepository.findOne({
      where: {
        parentItemCode: dto.parentItemCode,
        childItemCode: dto.childItemCode,
        revision: dto.revision ?? 'A',
      },
    });

    if (existing) throw new ConflictException('이미 존재하는 BOM입니다.');

    const bom = this.bomRepository.create({
      parentItemCode: dto.parentItemCode,
      childItemCode: dto.childItemCode,
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
    const bom = await this.findById(id);

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

    await this.bomRepository.update(
      { parentItemCode: bom.parentItemCode, childItemCode: bom.childItemCode, revision: bom.revision },
      updateData,
    );
    return this.findById(id);
  }

  async delete(id: string) {
    const bom = await this.findById(id);
    await this.bomRepository.delete({ parentItemCode: bom.parentItemCode, childItemCode: bom.childItemCode, revision: bom.revision });
    return { id };
  }
}
