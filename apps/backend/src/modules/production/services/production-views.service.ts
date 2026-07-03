/**
 * @file src/modules/production/services/production-views.service.ts
 * @description 생산관리 조회 전용 서비스 - 작업진행현황, 샘플검사이력, 포장실적, 반제품/제품재고
 *
 * 초보자 가이드:
 * 1. **작업진행현황**: JobOrder + ProdResult 집계를 조합한 대시보드 데이터
 * 2. **샘플검사이력**: InspectResult 테이블 조회
 * 3. **포장실적**: BoxMaster 테이블 조회
 * 4. **반제품/제품재고**: Stock 테이블에서 itemType=WIP/FG 필터링
 * 5. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import {
  ProgressQueryDto,
  SampleInspectQueryDto,
  PackResultQueryDto,
  WipStockQueryDto,
} from '../dto/production-views.dto';

@Injectable()
export class ProductionViewsService {
  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(InspectResult)
    private readonly inspectResultRepository: Repository<InspectResult>,
    @InjectRepository(BoxMaster)
    private readonly boxMasterRepository: Repository<BoxMaster>,
    @InjectRepository(ProductStock)
    private readonly stockRepository: Repository<ProductStock>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    @InjectRepository(SgLabel)
    private readonly sgLabelRepository: Repository<SgLabel>,
  ) {}

  /**
   * 작업지시 진행현황 조회 (대시보드)
   */
  async getProgress(query: ProgressQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, status, planDateFrom, planDateTo, search, shift } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'p')

    if (company) queryBuilder.andWhere('jo.company = :company', { company });
    if (plant) queryBuilder.andWhere('jo.plant = :plant', { plant });

    /* shift 필터: 해당 교대의 ProdResult가 존재하는 작업지시만 조회 */
    if (shift) {
      const shiftJoin: string[] = ['pr.ORDER_NO = jo.ORDER_NO', 'pr.SHIFT_CODE = :shift'];
      if (company) shiftJoin.push('pr.COMPANY = :company');
      if (plant) shiftJoin.push('pr.PLANT_CD = :plant');
      queryBuilder.innerJoin(
        ProdResult,
        'pr',
        shiftJoin.join(' AND '),
        { shift },
      );
    }

    queryBuilder
      .orderBy('jo.priority', 'ASC')
      .addOrderBy('jo.planDate', 'ASC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('jo.status = :status', { status });
    }

    if (planDateFrom) {
      queryBuilder.andWhere("jo.planDate >= TO_DATE(:planDateFrom, 'YYYY-MM-DD')", { planDateFrom });
    }
    if (planDateTo) {
      queryBuilder.andWhere("jo.planDate < TO_DATE(:planDateTo, 'YYYY-MM-DD') + 1", { planDateTo });
    }

    if (search) {
      queryBuilder.andWhere(
        '(jo.orderNo ILIKE :search OR p.itemCode ILIKE :search OR p.itemName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 샘플검사이력 조회
   */
  async getSampleInspect(query: SampleInspectQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, passYn, fromDate, toDate, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.inspectResultRepository
      .createQueryBuilder('ir')
      .leftJoinAndSelect('ir.prodResult', 'pr')
      .leftJoinAndSelect('pr.jobOrder', 'jo')
      .leftJoinAndSelect('jo.part', 'p')
      .orderBy('ir.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (company) {
      queryBuilder.andWhere('pr.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('pr.plant = :plant', { plant });
    }

    if (passYn) {
      queryBuilder.andWhere('ir.passYn = :passYn', { passYn });
    }

    if (fromDate) {
      queryBuilder.andWhere("ir.inspectDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      queryBuilder.andWhere("ir.inspectDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });
    }

    if (search) {
      queryBuilder.andWhere('pr.prdUid ILIKE :search', { search: `%${search}%` });
    }

    const [data, total] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 포장실적 조회 — BoxMaster + ItemMaster JOIN
   */
  async getPackResult(query: PackResultQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, fromDate, toDate, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.boxMasterRepository
      .createQueryBuilder('bm')
      .leftJoin('ITEM_MASTERS', 'im', 'im.ITEM_CODE = bm.ITEM_CODE AND im.COMPANY = bm.COMPANY AND im.PLANT_CD = bm.PLANT_CD')
      .select([
        'bm.BOX_NO AS "boxNo"',
        'bm.ITEM_CODE AS "itemCode"',
        'im.ITEM_NAME AS "itemName"',
        'bm.QTY AS "packQty"',
        'bm.STATUS AS "status"',
        'bm.PALLET_NO AS "palletNo"',
        'bm.OQC_STATUS AS "oqcStatus"',
        'bm.CREATED_BY AS "packer"',
        'bm.CREATED_AT AS "packDate"',
        'bm.CLOSE_TIME AS "closeTime"',
      ]);

    if (company) qb.andWhere('bm.COMPANY = :company', { company });
    if (plant) qb.andWhere('bm.PLANT_CD = :plant', { plant });

    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(bm.BOX_NO LIKE :sCode OR bm.ITEM_CODE LIKE :sCode OR im.ITEM_NAME LIKE :sRaw)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }

    if (fromDate) {
      qb.andWhere("bm.CREATED_AT >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      qb.andWhere("bm.CREATED_AT < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });
    }

    qb.orderBy('bm.CREATED_AT', 'DESC');

    const total = await qb.getCount();
    const data = await qb.offset(skip).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  /**
   * 반제품/제품 재고 조회
   * - FINISHED: PRODUCT_STOCKS WHERE WAREHOUSE_CODE='FG_WIP' (완제품 공정창고)
   * - SEMI_PRODUCT: PRODUCT_STOCKS WHERE WAREHOUSE_CODE='SFG_WIP' (반제품 공정창고)
   * - 전체: IN ('FG_WIP', 'SFG_WIP')
   */
  async getWipStock(query: WipStockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemType, qualityStatus, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.stockRepository
      .createQueryBuilder('s')
      .leftJoin(
        'ITEM_MASTERS',
        'im',
        'im.ITEM_CODE = s.ITEM_CODE AND im.COMPANY = s.COMPANY AND im.PLANT_CD = s.PLANT_CD',
      )
      .leftJoin(
        'WAREHOUSES',
        'wh',
        'wh.WAREHOUSE_CODE = s.WAREHOUSE_CODE AND wh.COMPANY = s.COMPANY AND wh.PLANT_CD = s.PLANT_CD',
      )
      .select([
        's.ITEM_CODE AS "itemCode"',
        'im.ITEM_NAME AS "itemName"',
        's.ITEM_TYPE AS "itemType"',
        's.QUALITY_STATUS AS "qualityStatus"',
        's.WAREHOUSE_CODE AS "whCode"',
        'wh.WAREHOUSE_NAME AS "whName"',
        's.QTY AS "qty"',
        'im.UNIT AS "unit"',
        's.UPDATED_AT AS "updatedAt"',
      ])
      .where('s.ITEM_TYPE IN (:...itemTypes)', {
        itemTypes: itemType ? [itemType] : ['SEMI_PRODUCT', 'FINISHED'],
      })
      // 공정 재고: FG_WIP(완제품)/SFG_WIP(반제품) 공정창고만.
      .andWhere(
        itemType === 'FINISHED'
          ? "s.WAREHOUSE_CODE = 'FG_WIP'"
          : itemType === 'SEMI_PRODUCT'
            ? "s.WAREHOUSE_CODE = 'SFG_WIP'"
            : "s.WAREHOUSE_CODE IN ('FG_WIP', 'SFG_WIP')",
      );

    if (company) {
      qb.andWhere('s.COMPANY = :company', { company });
    }
    if (plant) {
      qb.andWhere('s.PLANT_CD = :plant', { plant });
    }
    if (qualityStatus) {
      qb.andWhere('s.QUALITY_STATUS = :qualityStatus', { qualityStatus });
    }

    if (search) {
      qb.andWhere('(UPPER(s.ITEM_CODE) LIKE :searchUpper OR UPPER(im.ITEM_NAME) LIKE :searchUpper)', {
        searchUpper: `%${search.toUpperCase()}%`,
      });
    }

    qb.orderBy('s.UPDATED_AT', 'DESC');

    const total = await qb.getCount();
    const data = await qb.offset(skip).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  async getWipStockLabels(itemCode: string, itemType: string, company?: string, plant?: string) {
    if (itemType === 'SEMI_PRODUCT') {
      const qb = this.sgLabelRepository
        .createQueryBuilder('sg')
        .select([
          'sg.sgBarcode AS "barcode"',
          'sg.itemCode AS "itemCode"',
          'sg.status AS "status"',
          'sg.orderNo AS "orderNo"',
          'sg.resultNo AS "resultNo"',
          'sg.issueProcessCode AS "issueProcessCode"',
          'sg.currentProcessCode AS "currentProcessCode"',
          'sg.mountedEquipCode AS "mountedEquipCode"',
          'sg.warehouseCode AS "warehouseCode"',
          'sg.initQty AS "initQty"',
          'sg.remainQty AS "remainQty"',
          'sg.issuedAt AS "issuedAt"',
        ])
        .where('sg.itemCode = :itemCode', { itemCode })
        .andWhere("sg.status NOT IN ('CONSUMED', 'DEFECT')");
      if (company) qb.andWhere('sg.company = :company', { company });
      if (plant) qb.andWhere('sg.plant = :plant', { plant });
      qb.orderBy('sg.issuedAt', 'DESC');

      const data = await qb.getRawMany();
      return { data, total: data.length, page: 1, limit: data.length };
    }

    const qb = this.fgLabelRepository
      .createQueryBuilder('fg')
      .leftJoin(
        'PRODUCT_TRANSACTIONS',
        'tx',
        `tx.REF_TYPE = 'BOX' AND tx.REF_ID = fg.BOX_NO AND tx.STATUS = 'DONE' AND tx.TRANS_TYPE IN ('WIP_OUT', 'FG_IN') AND tx.COMPANY = fg.COMPANY AND tx.PLANT_CD = fg.PLANT_CD`,
      )
      .select([
        'fg.fgBarcode AS "barcode"',
        'fg.itemCode AS "itemCode"',
        'fg.boxNo AS "boxNo"',
        'fg.status AS "status"',
        'fg.inspectPassYn AS "inspectPassYn"',
        'fg.orderNo AS "orderNo"',
        'fg.equipCode AS "equipCode"',
        'fg.issuedAt AS "issuedAt"',
      ])
      .where('fg.itemCode = :itemCode', { itemCode })
      .andWhere("fg.status NOT IN ('VOIDED', 'SHIPPED')")
      .andWhere('tx.TRANS_NO IS NULL');
    if (company) qb.andWhere('fg.company = :company', { company });
    if (plant) qb.andWhere('fg.plant = :plant', { plant });
    qb.orderBy('fg.issuedAt', 'DESC');

    const data = await qb.getRawMany();
    return { data, total: data.length, page: 1, limit: data.length };
  }

  /**
   * @deprecated use getWipStockLabels(itemCode, itemType)
   */
  async getWipStockFgLabels(itemCode: string, company?: string, plant?: string) {
    return this.getWipStockLabels(itemCode, 'FINISHED', company, plant);
  }
}
