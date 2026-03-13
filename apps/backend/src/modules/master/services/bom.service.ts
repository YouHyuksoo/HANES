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

  /** BOM에 등재된 모품목(부모품목) 목록 + 자품목 수 (단일 JOIN 쿼리) */
  async findParents(search?: string, effectiveDate?: string) {
    try {
      const params: any[] = [];
      let dateFilter = '';
      if (effectiveDate) {
        params.push(effectiveDate, effectiveDate);
        dateFilter = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${params.length - 1}, 'YYYY-MM-DD'))
          AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${params.length}, 'YYYY-MM-DD'))`;
      }

      let searchFilter = '';
      if (search) {
        params.push(`%${search.toUpperCase()}%`);
        const idx = params.length;
        searchFilter = `AND (UPPER(p.ITEM_CODE) LIKE :${idx} OR UPPER(p.ITEM_NAME) LIKE :${idx} OR UPPER(p.PART_NO) LIKE :${idx})`;
      }

      const rows: any[] = await this.bomRepository.query(
        `SELECT p.ITEM_CODE   AS "itemCode",
                p.ITEM_NAME   AS "itemName",
                p.PART_NO     AS "itemNo",
                p.ITEM_TYPE   AS "itemType",
                p.SPEC        AS "spec",
                p.UNIT        AS "unit",
                p.CUSTOMER    AS "customer",
                p.REMARKS     AS "remark",
                COUNT(*)      AS "bomCount"
           FROM BOM_MASTERS b
           JOIN ITEM_MASTERS p ON p.ITEM_CODE = b.PARENT_ITEM_CODE
          WHERE b.USE_YN = 'Y' ${dateFilter} ${searchFilter}
          GROUP BY p.ITEM_CODE, p.ITEM_NAME, p.PART_NO, p.ITEM_TYPE,
                   p.SPEC, p.UNIT, p.CUSTOMER, p.REMARKS
          ORDER BY p.ITEM_CODE ASC`,
        params,
      );

      return rows.map((r) => ({
        ...r,
        bomCount: parseInt(r.bomCount, 10),
      }));
    } catch (error) {
      console.error('[BomService.findParents] Error:', error);
      throw error;
    }
  }

  async findAll(query: BomQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, parentItemCode, childItemCode, revision } = query;
    const skip = (page - 1) * limit;

    const where: any = { useYn: 'Y' };
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (parentItemCode) where.parentItemCode = parentItemCode;
    if (childItemCode) where.childItemCode = childItemCode;
    if (revision) where.revision = revision;

    const [bomList, total] = await this.bomRepository.findAndCount({
      where,
      order: { parentItemCode: 'ASC', seq: 'ASC' },
      skip,
      take: limit,
    });

    if (bomList.length === 0) return { data: [], total: 0, page, limit };

    const parentCodes = [...new Set(bomList.map((b) => b.parentItemCode))];
    const childCodes = [...new Set(bomList.map((b) => b.childItemCode))];
    const allCodes = [...new Set([...parentCodes, ...childCodes])];

    const parts = await this.partRepository.find({
      where: { itemCode: In(allCodes) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'spec', 'unit'],
    });
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const data = bomList.map((b) => ({
      ...b,
      parentPart: partMap.get(b.parentItemCode) || null,
      childPart: partMap.get(b.childItemCode) || null,
    }));

    return { data, total, page, limit };
  }

  async findById(id: string) {
    // id is composite key encoded as "parentItemCode::childItemCode::revision"
    const [parentItemCode, childItemCode, revision] = id.split('::');
    const bom = await this.bomRepository.findOne({
      where: { parentItemCode, childItemCode, revision: revision || 'A' },
    });

    if (!bom) throw new NotFoundException(`BOM을 찾을 수 없습니다: ${id}`);

    const parts = await this.partRepository.find({
      where: { itemCode: In([parentItemCode, childItemCode]) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'spec', 'unit'],
    });
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return {
      ...bom,
      parentPart: partMap.get(parentItemCode) || null,
      childPart: partMap.get(childItemCode) || null,
    };
  }

  async findByParentId(parentItemCode: string, effectiveDate?: string) {
    const params: any[] = [parentItemCode];
    let dateFilter = '';
    if (effectiveDate) {
      params.push(effectiveDate, effectiveDate);
      dateFilter = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${params.length - 1}, 'YYYY-MM-DD'))
        AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${params.length}, 'YYYY-MM-DD'))`;
    }

    const rows: any[] = await this.bomRepository.query(
      `SELECT b.PARENT_ITEM_CODE AS "parentItemCode",
              b.CHILD_ITEM_CODE  AS "childItemCode",
              b.REVISION         AS "revision",
              b.QTY_PER          AS "qtyPer",
              b.SEQ              AS "seq",
              b.BOM_GRP          AS "bomGrp",
              b.OPER             AS "processCode",
              b.SIDE             AS "side",
              b.ECO_NO           AS "ecoNo",
              b.VALID_FROM       AS "validFrom",
              b.VALID_TO         AS "validTo",
              b.USE_YN           AS "useYn",
              b.REMARK           AS "remark"
         FROM BOM_MASTERS b
        WHERE b.PARENT_ITEM_CODE = :1
          AND b.USE_YN = 'Y'
          ${dateFilter}
        ORDER BY b.SEQ ASC`,
      params,
    );

    if (rows.length === 0) return [];

    const childCodes = rows.map((r) => r.childItemCode);
    const parts = await this.partRepository.find({
      where: { itemCode: In(childCodes) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'spec', 'unit'],
    });
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return rows.map((r) => ({
      ...r,
      childPart: partMap.get(r.childItemCode) || null,
    }));
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
        b.PARENT_ITEM_CODE || '::' || b.CHILD_ITEM_CODE || '::' || b.REVISION AS "id",
        b.PARENT_ITEM_CODE AS "parentItemCode",
        b.CHILD_ITEM_CODE  AS "childItemCode",
        b.QTY_PER          AS "qtyPer",
        b.SEQ              AS "seq",
        b.REVISION         AS "revision",
        b.OPER             AS "processCode",
        b.SIDE             AS "side",
        b.VALID_FROM       AS "validFrom",
        b.VALID_TO         AS "validTo",
        b.USE_YN           AS "useYn",
        p.ITEM_CODE        AS "itemCode",
        p.ITEM_NAME        AS "itemName",
        p.PART_NO          AS "itemNo",
        p.ITEM_TYPE        AS "itemType",
        p.UNIT             AS "unit",
        LEVEL              AS "lvl"
      FROM BOM_MASTERS b
      JOIN ITEM_MASTERS p ON b.CHILD_ITEM_CODE = p.ITEM_CODE
      WHERE b.USE_YN = 'Y'
        ${dateFilter}
      START WITH b.PARENT_ITEM_CODE = :${parentIdx}
      CONNECT BY PRIOR b.CHILD_ITEM_CODE = b.PARENT_ITEM_CODE
        AND LEVEL <= ${safeDepth}
        AND b.USE_YN = 'Y'
        ${dateFilterConnect}
      ORDER SIBLINGS BY b.SEQ ASC
    `;

    const rawResults = await this.bomRepository.query(query, params);
    
    // 평면 데이터를 트리 구조로 변환
    return this.buildTreeFromFlatData(rawResults);
  }

  /** 평면 데이터를 트리 구조로 변환 (childItemCode 기준 부모 매칭) */
  private buildTreeFromFlatData(rows: any[]): any[] {
    const roots: any[] = [];
    // childItemCode → node 매핑 (부모 찾을 때 사용)
    const childMap = new Map<string, any>();

    const nodes = rows.map((row) => {
      const node = {
        id: row.id,
        level: Number(row.lvl),
        parentItemCode: row.parentItemCode,
        childItemCode: row.childItemCode,
        itemCode: row.itemCode,
        itemNo: row.itemNo,
        itemName: row.itemName,
        itemType: row.itemType,
        qtyPer: Number(row.qtyPer),
        unit: row.unit,
        revision: row.revision,
        seq: Number(row.seq),
        processCode: row.processCode,
        side: row.side,
        validFrom: row.validFrom,
        validTo: row.validTo,
        useYn: row.useYn,
        children: [],
      };
      childMap.set(node.childItemCode, node);
      return node;
    });

    // 부모-자식 관계 설정: parentItemCode로 부모 노드의 childItemCode를 매칭
    for (const node of nodes) {
      const parent = childMap.get(node.parentItemCode);
      if (parent) {
        parent.children.push(node);
      } else {
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
