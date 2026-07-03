/**
 * @file src/modules/master/services/bom.service.ts
 * @description BOM 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. **findParents**: BOM에 등재된 모품목(부모품목) 목록 조회
 * 2. **findHierarchy**: 부모품목 ID 기준 재귀 트리 구조 조회
 * 3. **CRUD**: 추가/수정/삭제 모두 DB에 반영
 * 4. **exportToExcel**: BOM 데이터를 xlsx 파일로 내보내기
 * 5. **uploadFromExcel**: xlsx 파일에서 BOM 데이터를 읽어 일괄 등록
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import * as XLSX from 'xlsx';
import { BomMaster } from '../../../entities/bom-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { CreateBomDto, UpdateBomDto, BomQueryDto } from '../dto/bom.dto';

/** Excel 업로드 결과 인터페이스 */
export interface BomUploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/** 업로드 미리보기 행 */
export interface BomPreviewRow {
  row: number;
  parentItemCode: string;
  childItemCode: string;
  validFrom: string | null;
  validTo: string | null;
  qtyPer: number | null;
  revision: string;
  status: 'new' | 'duplicate_db' | 'duplicate_file' | 'error';
  message?: string;
}

/** 업로드 미리보기 결과 */
export interface BomPreviewResult {
  rows: BomPreviewRow[];
  duplicateCount: number;
  newCount: number;
  errorCount: number;
}

type BomParentRow = {
  itemCode: string;
  itemName: string | null;
  itemNo: string | null;
  itemType: string | null;
  spec: string | null;
  unit: string | null;
  remark: string | null;
  bomCount: string | number;
  revisions: string | null;
  validFrom: string | null;
  validTo: string | null;
};

type BomChildRow = {
  parentItemCode: string;
  childItemCode: string;
  revision: string;
  qtyPer: number | string;
  seq: number | string;
  bomGrp: string | null;
  processCode: string | null;
  side: string | null;
  ecoNo: string | null;
  validFrom: string | null;
  validTo: string | null;
  useYn: string;
  remark: string | null;
};

type BomTreeFlatRow = BomChildRow & {
  id: string;
  lvl: number | string;
  itemCode: string;
  itemNo: string | null;
  itemName: string | null;
  itemType: string | null;
  unit: string | null;
  processName: string | null;
};

export type BomTreeNode = {
  id: string;
  level: number;
  parentItemCode: string;
  childItemCode: string;
  itemCode: string;
  itemNo: string | null;
  itemName: string | null;
  itemType: string | null;
  qtyPer: number;
  unit: string | null;
  revision: string;
  seq: number;
  processCode: string | null;
  processName: string | null;
  side: string | null;
  validFrom: string | null;
  validTo: string | null;
  useYn: string;
  children: BomTreeNode[];
};

type BomExcelRow = Record<string, unknown>;

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(BomMaster)
    private readonly bomRepository: Repository<BomMaster>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
  ) {}

  /** 유효일자 필터 조건 생성 (validFrom <= date AND validTo >= date, NULL은 무제한) */
  private buildDateFilter(queryBuilder: SelectQueryBuilder<BomMaster>, effectiveDate?: string) {
    if (!effectiveDate) return queryBuilder;
    const d = new Date(effectiveDate);
    
    return queryBuilder
      .andWhere('(bom.validFrom IS NULL OR bom.validFrom <= :date)', { date: d })
      .andWhere('(bom.validTo IS NULL OR bom.validTo >= :date)', { date: d });
  }

  /** BOM에 등재된 모품목(부모품목) 목록 + 자품목 수 (단일 JOIN 쿼리) */
  async findParents(search?: string, effectiveDate?: string, company?: string, plant?: string) {
    try {
      const params: unknown[] = [];
      // 바인드는 SQL 등장 순서대로 push. LIKE 3개도 같은 값이지만 각각 별도 push.
      const bind = (v: unknown): number => { params.push(v); return params.length; };

      let dateFilter = '';
      if (effectiveDate) {
        const f = bind(effectiveDate);
        const t = bind(effectiveDate);
        dateFilter = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${f}, 'YYYY-MM-DD'))
          AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${t}, 'YYYY-MM-DD'))`;
      }

      let searchFilter = '';
      if (search) {
        const v = `%${search.toUpperCase()}%`;
        const a = bind(v);
        const b = bind(v);
        const c = bind(v);
        searchFilter = `AND (p.ITEM_CODE LIKE :${a} OR p.ITEM_NAME LIKE :${b} OR p.PART_NO LIKE :${c})`;
      }

      let tenantFilter = '';
      if (company) tenantFilter += ` AND b.COMPANY = :${bind(company)}`;
      if (plant) tenantFilter += ` AND b.PLANT_CD = :${bind(plant)}`;

      const rows = await this.bomRepository.query<BomParentRow[]>(
        `SELECT p.ITEM_CODE   AS "itemCode",
                p.ITEM_NAME   AS "itemName",
                p.PART_NO     AS "itemNo",
                p.ITEM_TYPE   AS "itemType",
                p.SPEC        AS "spec",
                p.UNIT        AS "unit",
                p.REMARK     AS "remark",
                COUNT(*)      AS "bomCount",
                TO_CHAR(MIN(b.VALID_FROM), 'YYYY-MM-DD') AS "validFrom",
                TO_CHAR(MAX(b.VALID_TO), 'YYYY-MM-DD') AS "validTo",
                LISTAGG(DISTINCT b.REVISION, ',') WITHIN GROUP (ORDER BY b.REVISION) AS "revisions"
           FROM BOM_MASTERS b
           JOIN ITEM_MASTERS p ON p.ITEM_CODE = b.PARENT_ITEM_CODE
          WHERE b.USE_YN = 'Y' ${dateFilter} ${searchFilter} ${tenantFilter}
          GROUP BY p.ITEM_CODE, p.ITEM_NAME, p.PART_NO, p.ITEM_TYPE,
                   p.SPEC, p.UNIT, p.REMARK
          ORDER BY p.ITEM_CODE ASC`,
        params,
      );

      return rows.map((r) => ({
        ...r,
        bomCount: Number(r.bomCount),
        revisions: r.revisions ? r.revisions.split(',') : [],
      }));
    } catch (error) {
      console.error('[BomService.findParents] Error:', error);
      throw error;
    }
  }

  async findAll(query: BomQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, parentItemCode, childItemCode, revision } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<BomMaster> = { useYn: 'Y' };
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
      where: { itemCode: In(allCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'productType', 'spec', 'unit'],
    });
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const data = bomList.map((b) => ({
      ...b,
      validFrom: this.toDateOnly(b.validFrom),
      validTo: this.toDateOnly(b.validTo),
      parentPart: partMap.get(b.parentItemCode) || null,
      childPart: partMap.get(b.childItemCode) || null,
    }));

    return { data, total, page, limit };
  }

  async findById(id: string, company?: string, plant?: string) {
    // id is composite key encoded as "parentItemCode::childItemCode::validFrom(YYYY-MM-DD)"
    const [parentItemCode, childItemCode, validFromKey] = id.split('::');
    const validFrom = this.keyDate(validFromKey);
    const bom = await this.bomRepository.findOne({
      where: { parentItemCode, childItemCode, ...(validFrom ? { validFrom } : {}), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (!bom) throw new NotFoundException(`BOM을 찾을 수 없습니다: ${id}`);

    const parts = await this.partRepository.find({
      where: { itemCode: In([parentItemCode, childItemCode]), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'productType', 'spec', 'unit'],
    });
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return {
      ...bom,
      validFrom: this.toDateOnly(bom.validFrom),
      validTo: this.toDateOnly(bom.validTo),
      parentPart: partMap.get(parentItemCode) || null,
      childPart: partMap.get(childItemCode) || null,
    };
  }

  async findByParentId(parentItemCode: string, effectiveDate?: string, company?: string, plant?: string) {
    const params: unknown[] = [];
    const bind = (v: unknown): number => { params.push(v); return params.length; };

    // WHERE 등장 순서: parent → date → tenant
    const parentIdx = bind(parentItemCode);
    let dateFilter = '';
    if (effectiveDate) {
      const f = bind(effectiveDate);
      const t = bind(effectiveDate);
      dateFilter = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${f}, 'YYYY-MM-DD'))
        AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${t}, 'YYYY-MM-DD'))`;
    }
    let tenantFilter = '';
    if (company) tenantFilter += ` AND b.COMPANY = :${bind(company)}`;
    if (plant) tenantFilter += ` AND b.PLANT_CD = :${bind(plant)}`;

    const rows = await this.bomRepository.query<BomChildRow[]>(
      `SELECT b.PARENT_ITEM_CODE AS "parentItemCode",
              b.CHILD_ITEM_CODE  AS "childItemCode",
              b.REVISION         AS "revision",
              b.QTY_PER          AS "qtyPer",
              b.SEQ              AS "seq",
              b.BOM_GRP          AS "bomGrp",
              b.OPER             AS "processCode",
              b.SIDE             AS "side",
              b.ECO_NO           AS "ecoNo",
              TO_CHAR(b.VALID_FROM, 'YYYY-MM-DD') AS "validFrom",
              TO_CHAR(b.VALID_TO, 'YYYY-MM-DD') AS "validTo",
              b.USE_YN           AS "useYn",
              b.REMARK           AS "remark"
         FROM BOM_MASTERS b
        WHERE b.PARENT_ITEM_CODE = :${parentIdx}
          AND b.USE_YN = 'Y'
          ${dateFilter}
          ${tenantFilter}
        ORDER BY b.SEQ ASC`,
      params,
    );

    if (rows.length === 0) return [];

    const childCodes = rows.map((r) => r.childItemCode);
    const parts = await this.partRepository.find({
      where: { itemCode: In(childCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'productType', 'spec', 'unit'],
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
  async findHierarchy(parentItemCode: string, depth: number = 3, effectiveDate?: string, company?: string, plant?: string) {
    const safeDepth = Math.min(Math.max(Math.floor(Number(depth) || 3), 1), 10);
    const params: string[] = [];
    // 바인드는 SQL 등장 순서대로 push (oracledb positional). 각 절마다 별도 바인드.
    const bind = (v: string): number => {
      params.push(v);
      return params.length;
    };

    // 1) WHERE 절 날짜 필터
    let dateFilter = '';
    if (effectiveDate) {
      const f = bind(effectiveDate);
      const t = bind(effectiveDate);
      dateFilter = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${f}, 'YYYY-MM-DD'))
         AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${t}, 'YYYY-MM-DD'))`;
    }

    // 2) WHERE 절 테넌트 필터
    let tenantFilterWhere = '';
    if (company) tenantFilterWhere += ` AND b.COMPANY = :${bind(company)}`;
    if (plant) tenantFilterWhere += ` AND b.PLANT_CD = :${bind(plant)}`;

    // 3) START WITH
    const parentIdx = bind(parentItemCode);

    // 4) CONNECT BY 절 날짜 필터
    let dateFilterConnect = '';
    if (effectiveDate) {
      const f = bind(effectiveDate);
      const t = bind(effectiveDate);
      dateFilterConnect = `AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= TO_DATE(:${f}, 'YYYY-MM-DD'))
         AND (b.VALID_TO IS NULL OR b.VALID_TO >= TO_DATE(:${t}, 'YYYY-MM-DD'))`;
    }

    // 5) CONNECT BY 절 테넌트 필터
    let tenantFilterConnect = '';
    if (company) tenantFilterConnect += ` AND b.COMPANY = :${bind(company)}`;
    if (plant) tenantFilterConnect += ` AND b.PLANT_CD = :${bind(plant)}`;

    const query = `
      SELECT
        b.PARENT_ITEM_CODE || '::' || b.CHILD_ITEM_CODE || '::' || TO_CHAR(b.VALID_FROM, 'YYYY-MM-DD') AS "id",
        b.PARENT_ITEM_CODE AS "parentItemCode",
        b.CHILD_ITEM_CODE  AS "childItemCode",
        b.QTY_PER          AS "qtyPer",
        b.SEQ              AS "seq",
        b.REVISION         AS "revision",
        b.OPER             AS "processCode",
        pm.PROCESS_NAME    AS "processName",
        b.SIDE             AS "side",
        TO_CHAR(b.VALID_FROM, 'YYYY-MM-DD') AS "validFrom",
        TO_CHAR(b.VALID_TO, 'YYYY-MM-DD') AS "validTo",
        b.USE_YN           AS "useYn",
        p.ITEM_CODE        AS "itemCode",
        p.ITEM_NAME        AS "itemName",
        p.PART_NO          AS "itemNo",
        p.ITEM_TYPE        AS "itemType",
        p.UNIT             AS "unit",
        LEVEL              AS "lvl"
      FROM BOM_MASTERS b
      JOIN ITEM_MASTERS p ON b.CHILD_ITEM_CODE = p.ITEM_CODE
      LEFT JOIN PROCESS_MASTERS pm ON b.OPER = pm.PROCESS_CODE
      WHERE b.USE_YN = 'Y'
        ${dateFilter}
        ${tenantFilterWhere}
      START WITH b.PARENT_ITEM_CODE = :${parentIdx}
      CONNECT BY PRIOR b.CHILD_ITEM_CODE = b.PARENT_ITEM_CODE
        AND LEVEL <= ${safeDepth}
        AND b.USE_YN = 'Y'
        ${dateFilterConnect}
        ${tenantFilterConnect}
      ORDER SIBLINGS BY b.SEQ ASC
    `;

    const rawResults = await this.bomRepository.query<BomTreeFlatRow[]>(query, params);
    
    // 평면 데이터를 트리 구조로 변환
    return this.buildTreeFromFlatData(rawResults);
  }

  /** 평면 데이터를 트리 구조로 변환 (childItemCode 기준 부모 매칭) */
  private buildTreeFromFlatData(rows: BomTreeFlatRow[]): BomTreeNode[] {
    const roots: BomTreeNode[] = [];
    // childItemCode → node 매핑 (부모 찾을 때 사용)
    const childMap = new Map<string, BomTreeNode>();

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
        processName: row.processName,
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

  /**
   * 날짜형 값(문자열/Date)을 YYYY-MM-DD로 정규화 (실패 시 null).
   * BOM 중복 판정 키(모품목+자품목+적용일자)를 등록/미리보기/업로드에서 동일하게 만들기 위한 단일 경로.
   */
  private toDateOnly(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const parsed = new Date(s);
    if (isNaN(parsed.getTime())) return null;
    return this.toDateOnly(parsed);
  }

  /**
   * 날짜형 값을 로컬(서버 KST) 자정 Date로 변환 — PK VALID_FROM 조회/저장 값 단일 경로.
   * new Date('YYYY-MM-DD')는 UTC 자정(KST 09:00)이라 DB의 자정 값과 어긋난다.
   */
  private keyDate(value: unknown): Date | null {
    const s = this.toDateOnly(value);
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  async create(dto: CreateBomDto, company?: string, plant?: string) {
    if (dto.parentItemCode === dto.childItemCode) {
      throw new ConflictException('상위 품목과 하위 품목이 같을 수 없습니다.');
    }

    const validFromYmd = this.toDateOnly(dto.validFrom);
    if (!validFromYmd) {
      throw new ConflictException('적용일자(validFrom)는 필수입니다. (YYYY-MM-DD)');
    }

    const existing = await this.bomRepository.find({
      where: {
        parentItemCode: dto.parentItemCode,
        childItemCode: dto.childItemCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      select: ['validFrom'],
    });
    if (existing.some((b) => this.toDateOnly(b.validFrom) === validFromYmd)) {
      throw new ConflictException('동일 상위·하위 품목에 같은 적용일자의 BOM이 이미 존재합니다.');
    }

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
      validFrom: this.keyDate(validFromYmd)!,
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
      company: company || null,
      plant: plant || null,
    });

    await this.bomRepository.save(bom);
    return this.findById(`${bom.parentItemCode}::${bom.childItemCode}::${validFromYmd}`, company, plant);
  }

  async update(id: string, dto: UpdateBomDto, company?: string, plant?: string) {
    const bom = await this.findById(id, company, plant);

    const updateData: Partial<Pick<BomMaster, 'qtyPer' | 'seq' | 'revision' | 'bomGrp' | 'processCode' | 'side' | 'ecoNo' | 'validFrom' | 'validTo' | 'remark' | 'useYn'>> = {};
    if (dto.qtyPer !== undefined) updateData.qtyPer = dto.qtyPer;
    if (dto.seq !== undefined) updateData.seq = dto.seq;
    if (dto.bomGrp !== undefined) updateData.bomGrp = dto.bomGrp;
    if (dto.processCode !== undefined) updateData.processCode = dto.processCode;
    if (dto.side !== undefined) updateData.side = dto.side;
    if (dto.ecoNo !== undefined) updateData.ecoNo = dto.ecoNo;
    if (dto.revision !== undefined) updateData.revision = dto.revision;
    if (dto.validTo !== undefined) updateData.validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    // 적용일자는 PK — 변경 시 동일 모+자에 같은 적용일자가 이미 있으면 중복
    const oldValidFrom = this.toDateOnly(bom.validFrom);
    const newValidFrom = this.toDateOnly(dto.validFrom);
    if (newValidFrom && newValidFrom !== oldValidFrom) {
      const siblings = await this.bomRepository.find({
        where: {
          parentItemCode: bom.parentItemCode,
          childItemCode: bom.childItemCode,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        select: ['validFrom'],
      });
      if (siblings.some((b) => this.toDateOnly(b.validFrom) === newValidFrom)) {
        throw new ConflictException('동일 상위·하위 품목에 같은 적용일자의 BOM이 이미 존재합니다.');
      }
      updateData.validFrom = this.keyDate(newValidFrom)!;
    }

    await this.bomRepository.update(
      {
        parentItemCode: bom.parentItemCode,
        childItemCode: bom.childItemCode,
        ...(oldValidFrom ? { validFrom: this.keyDate(oldValidFrom)! } : {}),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      updateData,
    );
    return this.findById(
      `${bom.parentItemCode}::${bom.childItemCode}::${newValidFrom ?? oldValidFrom ?? ''}`,
      company,
      plant,
    );
  }

  async delete(id: string, company?: string, plant?: string) {
    const bom = await this.findById(id, company, plant);
    const validFrom = this.keyDate(bom.validFrom);
    await this.bomRepository.delete({
      parentItemCode: bom.parentItemCode,
      childItemCode: bom.childItemCode,
      ...(validFrom ? { validFrom } : {}),
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    });
    return { id };
  }

  /** BOM 데이터를 Excel(xlsx) 파일로 내보내기 */
  async exportToExcel(parentItemCode?: string, company?: string, plant?: string): Promise<Buffer> {
    const where: FindOptionsWhere<BomMaster> = { useYn: 'Y' };
    if (parentItemCode) where.parentItemCode = parentItemCode;
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const bomList = await this.bomRepository.find({ where, order: { parentItemCode: 'ASC', seq: 'ASC' } });
    const headers = ['상위품목코드', '하위품목코드', '소요량', '리비전', '순서', 'BOM그룹', '공정코드', '사이드', 'ECO번호', '유효시작일', '유효종료일', '비고'];
    const fmtDate = (d: Date | null) => this.toDateOnly(d) ?? '';
    const rows = bomList.length > 0
      ? bomList.map((b) => [b.parentItemCode, b.childItemCode, b.qtyPer, b.revision, b.seq, b.bomGrp ?? '', b.processCode ?? '', b.side ?? '', b.ecoNo ?? '', fmtDate(b.validFrom), fmtDate(b.validTo), b.remark ?? ''])
      : [Array(headers.length).fill('')];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** 업로드 양식용 빈 xlsx 템플릿 반환 (헤더 행만 포함) */
  downloadTemplate(): Buffer {
    const headers = ['상위품목코드', '하위품목코드', '소요량', '리비전', '순서', 'BOM그룹', '공정코드', '사이드', 'ECO번호', '유효시작일', '유효종료일', '비고'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** 업로드 미리보기 — 중복(모+자+유효시작일) 및 오류 행 사전 확인 */
  async previewUpload(buffer: Buffer, company?: string, plant?: string): Promise<BomPreviewResult> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const jsonRows = XLSX.utils.sheet_to_json<BomExcelRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const str = (v: unknown) => String(v ?? '').trim();
    const fmtDate = (v: unknown): string | null => this.toDateOnly(v);

    const rows: BomPreviewRow[] = [];
    const fileKeySet = new Set<string>();
    const dbKeys: { parentItemCode: string; childItemCode: string; validFrom: Date | null }[] = [];

    for (let i = 0; i < jsonRows.length; i++) {
      const r = jsonRows[i];
      const rowNum = i + 2;
      const parentCode = str(r['상위품목코드']);
      const childCode = str(r['하위품목코드']);
      const qtyRaw = r['소요량'];
      const revision = str(r['리비전']) || 'A';
      const validFrom = fmtDate(r['유효시작일']);
      const validTo = fmtDate(r['유효종료일']);

      if (!parentCode || !childCode) {
        rows.push({ row: rowNum, parentItemCode: parentCode, childItemCode: childCode, validFrom, validTo, qtyPer: null, revision, status: 'error', message: '상위/하위품목코드 필수' });
        continue;
      }
      if (!validFrom || !validTo) {
        rows.push({ row: rowNum, parentItemCode: parentCode, childItemCode: childCode, validFrom, validTo, qtyPer: qtyRaw === '' || qtyRaw === null || isNaN(Number(qtyRaw)) ? null : Number(qtyRaw), revision, status: 'error', message: '유효시작일, 유효종료일 필수' });
        continue;
      }
      if (qtyRaw === '' || qtyRaw === null || isNaN(Number(qtyRaw))) {
        rows.push({ row: rowNum, parentItemCode: parentCode, childItemCode: childCode, validFrom, validTo, qtyPer: null, revision, status: 'error', message: '소요량 누락 또는 숫자 아님' });
        continue;
      }
      if (parentCode === childCode) {
        rows.push({ row: rowNum, parentItemCode: parentCode, childItemCode: childCode, validFrom, validTo, qtyPer: Number(qtyRaw), revision, status: 'error', message: '상위=하위 불가' });
        continue;
      }

      const fileKey = `${parentCode}::${childCode}::${validFrom ?? ''}`;
      if (fileKeySet.has(fileKey)) {
        rows.push({ row: rowNum, parentItemCode: parentCode, childItemCode: childCode, validFrom, validTo, qtyPer: Number(qtyRaw), revision, status: 'duplicate_file', message: '파일 내 중복 (동일 모·자·적용일자)' });
        continue;
      }
      fileKeySet.add(fileKey);
      dbKeys.push({ parentItemCode: parentCode, childItemCode: childCode, validFrom: validFrom ? new Date(validFrom) : null });
      rows.push({ row: rowNum, parentItemCode: parentCode, childItemCode: childCode, validFrom, validTo, qtyPer: Number(qtyRaw), revision, status: 'new' });
    }

    // DB 중복 확인 (모+자+유효시작일)
    if (dbKeys.length > 0) {
      const existBoms = await this.bomRepository.find({
        where: dbKeys.map((k) => ({
          parentItemCode: k.parentItemCode,
          childItemCode: k.childItemCode,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        })),
        select: ['parentItemCode', 'childItemCode', 'validFrom'],
      });
      // DB 기존 행의 모+자+유효시작일(PK) 키 셋
      const dbKeySet = new Set(existBoms.map((b) => `${b.parentItemCode}::${b.childItemCode}::${this.toDateOnly(b.validFrom) ?? ''}`));

      for (const row of rows) {
        if (row.status !== 'new') continue;
        const key = `${row.parentItemCode}::${row.childItemCode}::${row.validFrom ?? ''}`;
        if (dbKeySet.has(key)) {
          row.status = 'duplicate_db';
          row.message = 'DB에 동일 모·자·적용일자 존재';
        }
      }
    }

    const duplicateCount = rows.filter((r) => r.status === 'duplicate_db' || r.status === 'duplicate_file').length;
    const newCount = rows.filter((r) => r.status === 'new').length;
    const errorCount = rows.filter((r) => r.status === 'error').length;
    return { rows, duplicateCount, newCount, errorCount };
  }

  /** Excel(xlsx)에서 BOM 일괄 등록 (신규만 INSERT, 기존 PK 스킵) */
  async uploadFromExcel(buffer: Buffer, company?: string, plant?: string, userId?: string): Promise<BomUploadResult> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const jsonRows = XLSX.utils.sheet_to_json<BomExcelRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (jsonRows.length === 0) return { inserted: 0, skipped: 0, errors: [{ row: 2, message: '데이터가 없습니다.' }] };

    /* 1) 품목코드 일괄 존재 확인 */
    const allItemCodes = new Set<string>();
    for (const row of jsonRows) {
      const p = String(row['상위품목코드'] ?? '').trim();
      const c = String(row['하위품목코드'] ?? '').trim();
      if (p) allItemCodes.add(p);
      if (c) allItemCodes.add(c);
    }
    const parts = allItemCodes.size > 0
      ? await this.partRepository.find({
          where: { itemCode: In([...allItemCodes]), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          select: ['itemCode'],
        })
      : [];
    const validCodes = new Set(parts.map((p) => p.itemCode));

    /* 2) 기존 BOM 일괄 조회 — 중복 스킵 판정은 PK인 모+자+적용일자 (미리보기와 동일 규칙) */
    const pairList = jsonRows
      .map((r) => ({ p: String(r['상위품목코드'] ?? '').trim(), c: String(r['하위품목코드'] ?? '').trim() }))
      .filter((pk) => pk.p && pk.c);
    const existBoms = await this.bomRepository.find({
      where: pairList.map((pk) => ({
        parentItemCode: pk.p,
        childItemCode: pk.c,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      })),
      select: ['parentItemCode', 'childItemCode', 'validFrom'],
    });
    const existValidSet = new Set(existBoms.map((b) => `${b.parentItemCode}::${b.childItemCode}::${this.toDateOnly(b.validFrom) ?? ''}`));

    /* 3) 행별 검증 및 INSERT */
    const result: BomUploadResult = { inserted: 0, skipped: 0, errors: [] };
    const doneValidSet = new Set<string>();
    const str = (v: unknown) => String(v ?? '').trim();

    for (let i = 0; i < jsonRows.length; i++) {
      const row = jsonRows[i];
      const rowNum = i + 2;
      const parentCode = str(row['상위품목코드']);
      const childCode = str(row['하위품목코드']);
      const qtyRaw = row['소요량'];
      const revision = str(row['리비전']) || 'A';
      const validFrom = this.toDateOnly(row['유효시작일']);
      const validTo = this.toDateOnly(row['유효종료일']);

      if (!parentCode || !childCode) { result.errors.push({ row: rowNum, message: '상위품목코드, 하위품목코드는 필수입니다.' }); continue; }
      if (qtyRaw === '' || qtyRaw === null || qtyRaw === undefined || isNaN(Number(qtyRaw))) { result.errors.push({ row: rowNum, message: '소요량이 누락되었거나 숫자가 아닙니다.' }); continue; }
      if (!validFrom || !validTo) { result.errors.push({ row: rowNum, message: '유효시작일, 유효종료일은 필수입니다. (YYYY-MM-DD)' }); continue; }
      if (parentCode === childCode) { result.errors.push({ row: rowNum, message: '상위 품목과 하위 품목이 같을 수 없습니다.' }); continue; }
      if (!validCodes.has(parentCode)) { result.errors.push({ row: rowNum, message: `상위품목코드 [${parentCode}]가 품목마스터에 없습니다.` }); continue; }
      if (!validCodes.has(childCode)) { result.errors.push({ row: rowNum, message: `하위품목코드 [${childCode}]가 품목마스터에 없습니다.` }); continue; }

      // 중복 스킵: PK인 모+자+적용일자 (미리보기 duplicate 규칙과 동일)
      const dupKey = `${parentCode}::${childCode}::${validFrom}`;
      if (existValidSet.has(dupKey) || doneValidSet.has(dupKey)) { result.skipped++; continue; }

      try {
        const bom = this.bomRepository.create({
          parentItemCode: parentCode, childItemCode: childCode, revision,
          qtyPer: Number(qtyRaw), seq: Number(row['순서'] ?? 0) || 0,
          bomGrp: str(row['BOM그룹']) || null, processCode: str(row['공정코드']) || null,
          side: str(row['사이드']) || null, ecoNo: str(row['ECO번호']) || null,
          validFrom: this.keyDate(validFrom)!,
          validTo: new Date(validTo),
          remark: str(row['비고']) || null, useYn: 'Y',
          company: company ?? null, plant: plant ?? null,
          createdBy: userId ?? null, updatedBy: userId ?? null,
        });
        await this.bomRepository.save(bom);
        doneValidSet.add(dupKey);
        result.inserted++;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ row: rowNum, message: `저장 실패: ${msg}` });
      }
    }
    console.log(`[BomService.uploadFromExcel] 완료 — 등록: ${result.inserted}, 스킵: ${result.skipped}, 오류: ${result.errors.length}`);
    return result;
  }
}
