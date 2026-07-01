/**
 * @file src/modules/material/services/arrival.service.ts
 * @description 입하관리 비즈니스 로직 - PO 기반/수동 입하 및 역분개 취소 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **PO 입하**: PurchaseOrder 기반 분할 입하 (receivedQty 누적, PO status 재계산)
 * 2. **수동 입하**: PO 없이 직접 입하 등록
 * 3. **입하 취소**: 역분개 방식 (원본 CANCELED + 반대 트랜잭션 생성)
 * 4. **입하재고 분리**: 입하 시 MAT_ARRIVAL_STOCKS에 대기재고를 쌓고, 실제 입고 시 MAT_STOCKS로 이동
 *
 * NOTE: 입하 시점에 내부 LOT를 생성하고, 입고 시점에 원자재 현재고로 이동한다.
 * NOTE: lotNo 필드는 matUid로 리네이밍됨 (자재 고유 식별자)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, EntityManager, FindOptionsWhere, QueryRunner } from 'typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatArrivalTransaction } from '../../../entities/mat-arrival-transaction.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  ArrivalStockQueryDto,
  CancelArrivalDto,
  PoLineReceiptDto,
  PoLineQueryDto,
  ArrivalResultQueryDto,
} from '../dto/arrival.dto';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class ArrivalService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatArrival)
    private readonly matArrivalRepository: Repository<MatArrival>,
    @InjectRepository(MatArrivalStock)
    private readonly matArrivalStockRepository: Repository<MatArrivalStock>,
    @InjectRepository(MatArrivalTransaction)
    private readonly matArrivalTransactionRepository: Repository<MatArrivalTransaction>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(VendorBarcodeMapping)
    private readonly vendorBarcodeMappingRepository: Repository<VendorBarcodeMapping>,
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
  ) {}

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  /** 입하 가능 PO 목록 조회 (CONFIRMED/PARTIAL 상태) */
  async findReceivablePOs(company?: string, plant?: string) {
    const where: FindOptionsWhere<PurchaseOrder> = {
      status: In(['CONFIRMED', 'PARTIAL']),
    };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const pos = await this.purchaseOrderRepository.find({
      where,
      order: { orderDate: 'DESC' },
    });

    // PO 아이템 조회
    const poNos = pos.map((po) => po.poNo);
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const items = await this.purchaseOrderItemRepository.find({
      where: { poNo: In(poNos), ...tenantWhere },
    });

    const itemCodes = items.map((item) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // PO별 아이템 그룹화
    const itemsByPoNo = new Map<string, typeof items>();
    for (const item of items) {
      if (!itemsByPoNo.has(item.poNo)) {
        itemsByPoNo.set(item.poNo, []);
      }
      itemsByPoNo.get(item.poNo)!.push(item);
    }

    return pos.map((po) => {
      const poItems = itemsByPoNo.get(po.poNo) || [];
      const enrichedItems = poItems.map((item) => ({
        ...item,
        remainingQty: item.orderQty - item.receivedQty,
        itemCode: partMap.get(item.itemCode)?.itemCode ?? item.itemCode,
        itemName: partMap.get(item.itemCode)?.itemName,
        unit: partMap.get(item.itemCode)?.unit,
      }));

      return {
        ...po,
        items: enrichedItems,
        totalOrderQty: poItems.reduce((sum, i) => sum + i.orderQty, 0),
        totalReceivedQty: poItems.reduce((sum, i) => sum + i.receivedQty, 0),
        totalRemainingQty: poItems.reduce((sum, i) => sum + (i.orderQty - i.receivedQty), 0),
      };
    });
  }

  /** 특정 PO의 입하 가능 품목 조회 */
  async getPoItems(poNo: string, company?: string, plant?: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poNo}`);

    const items = await this.purchaseOrderItemRepository.find({
      where: { poNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    const itemCodes = items.map((item: PurchaseOrderItem) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      })
      : [];
    const partMap = new Map(parts.map((p: ItemMaster) => [p.itemCode, p]));

    return {
      ...po,
      items: items
        .map((item: PurchaseOrderItem) => ({
          ...item,
          remainingQty: item.orderQty - item.receivedQty,
          itemCode: partMap.get(item.itemCode)?.itemCode ?? item.itemCode,
          itemName: partMap.get(item.itemCode)?.itemName,
          unit: partMap.get(item.itemCode)?.unit,
        }))
        .filter((item) => item.remainingQty > 0),
    };
  }

  /** PO 기반 입하 등록 (핵심 트랜잭션) */
  async createPoArrival(dto: CreatePoArrivalDto, company?: string, plant?: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo: dto.poId, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${dto.poId}`);
    this.assertSameTenant('PO', { company, plant }, po);
    if (!['CONFIRMED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException(`입하 불가 상태입니다: ${po.status}`);
    }

    const poItems = await this.purchaseOrderItemRepository.find({
      where: { poNo: dto.poId, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    poItems.forEach((poItem) => this.assertSameTenant('PO 품목', { company: po.company, plant: po.plant }, poItem));

    // 잔량 검증 — poItemId는 "poNo-seq" 형식 또는 seq 번호
    // 입하잔량 = 발주수량 - 입하합계. 입하취소 시 receivedQty가 직접 감소되어 잔량이 복원된다.
    // (별도 반품합계 보정은 두지 않는다 — STOCK_TRANSACTIONS에 RETURN/MAT_IN_CANCEL 기록 경로가 없어 항상 0이며,
    //  receivedQty 직접 가감과 중복되면 이중 복원 위험.)
    const poItemBySeq = new Map(poItems.map((pi) => [pi.seq, pi]));
    const poItemByKey = new Map(poItems.map((pi) => [`${pi.poNo}-${pi.seq}`, pi]));

    for (const item of dto.items) {
      const poItem = poItemBySeq.get(Number(item.poItemId)) ?? poItemByKey.get(item.poItemId);
      if (!poItem) throw new BadRequestException(`PO 품목을 찾을 수 없습니다: ${item.poItemId}`);
      const remaining = poItem.orderQty - poItem.receivedQty;
      if (item.receivedQty > remaining) {
        throw new BadRequestException(
          `입하수량(${item.receivedQty})이 잔량(${remaining})을 초과합니다. (발주: ${poItem.orderQty}, 입하합계: ${poItem.receivedQty})`,
        );
      }
    }

    // 품목/창고 일괄 선조회 (트랜잭션 밖, N+1 제거)
    const itemCodes = [...new Set(dto.items.map((i) => i.itemCode).filter(Boolean))];
    const whCodes = [...new Set(dto.items.map((i) => i.warehouseId).filter(Boolean))];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const allParts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const allWarehouses = whCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(whCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(allParts.map((p) => [p.itemCode, p] as const));
    const whMap = new Map(allWarehouses.map((w) => [w.warehouseCode, w] as const));

    return this.tx.run(async (queryRunner) => {
      const results = [];
      const arrivalNo = await this.numbering.nextInTx(queryRunner, 'ARRIVAL');
      let arrivalSeq = 1;

      for (const item of dto.items) {
        const part = partMap.get(item.itemCode);
        const txDate = new Date();
        const matUid = await this.numbering.nextMatSerial(queryRunner, txDate);

        // 1. MatArrival 생성 (입하 업무 테이블) — LOT은 라벨 발행 시 생성됨
        const arrival = queryRunner.manager.create(MatArrival, {
          arrivalNo,
          seq: arrivalSeq++,
          invoiceNo: dto.invoiceNo,
          poId: dto.poId,
          poItemId: item.poItemId,
          poNo: po.poNo,
          vendorCode: po.partnerCode,
          vendorName: po.partnerName,
          supUid: item.supUid || null,
          itemCode: item.itemCode,
          qty: item.receivedQty,
          warehouseCode: item.warehouseId,
          arrivalType: 'PO',
          workerId: dto.workerId,
          remark: item.remark || dto.remark,
          iqcStatus: 'PENDING',
          status: 'DONE',
          company: po.company,
          plant: po.plant,
        });
        await queryRunner.manager.save(arrival);

        // 2. 내부 LOT 생성
        const lot = queryRunner.manager.create(MatLot, {
          matUid,
          itemCode: item.itemCode,
          initQty: item.receivedQty,
          currentQty: item.receivedQty,
          recvDate: txDate,
          manufactureDate: parseDateStart(item.manufactureDate),
          expireDate: null,
          arrivalNo,
          arrivalSeq: arrival.seq,
          origin: matUid,
          vendor: po.partnerCode ?? '',
          invoiceNo: item.invoiceNo || dto.invoiceNo || null,
          poNo: po.poNo,
          mfgPartnerCode: null,
          iqcStatus: 'PENDING',
          status: 'NORMAL',
          company: po.company,
          plant: po.plant,
          createdBy: dto.workerId ?? null,
        });
        const savedLot = await queryRunner.manager.save(lot);

        // 3. 입하재고 + 입하원장 기록. 원자재 현재고(MAT_STOCKS)는 입고 시점에만 증가한다.
        const savedTx = await this.recordIqc005StockArrival(queryRunner, savedLot, item.warehouseId, {
          company: po.company,
          plant: po.plant,
          username: dto.workerId ?? 'SYSTEM',
        });

        // 4. PurchaseOrderItem.receivedQty 증가
        const poItem = poItems.find((pi) => pi.seq === Number(item.poItemId) || `${pi.poNo}-${pi.seq}` === item.poItemId);
        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, {
            poNo: poItem.poNo,
            seq: poItem.seq,
            ...(po.company ? { company: po.company } : {}),
            ...(po.plant ? { plant: po.plant } : {}),
          }, {
            receivedQty: poItem.receivedQty + item.receivedQty,
          });
        }

        const warehouse = whMap.get(item.warehouseId);

        results.push({
          ...savedTx,
          arrivalNo,
          matUid,
          itemCode: item.itemCode,
          itemName: part?.itemName ?? null,
          itemType: part?.itemType ?? null,
          unit: part?.unit ?? null,
          warehouseCode: item.warehouseId,
          warehouseName: warehouse?.warehouseName ?? null,
        });
      }

      // 5. PO 상태 재계산
      await this.updatePOStatus(queryRunner.manager, po.poNo, po.company, po.plant);

      return results;
    });
  }

  /** 수동 입하 등록 */
  async createManualArrival(dto: CreateManualArrivalDto, company?: string, plant?: string) {
    return this.tx.run(async (queryRunner) => {
      const tenantWhere = {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      };
      const arrivalNo = await this.numbering.nextInTx(queryRunner, 'ARRIVAL');
      const txDate = new Date();
      const matUid = await this.numbering.nextMatSerial(queryRunner, txDate);

      // 품목 정보 조회
      const part = await this.itemMasterRepository.findOne({ where: { itemCode: dto.itemCode, ...tenantWhere } });

      // 1. MatArrival 생성 (입하 업무 테이블) — LOT은 라벨 발행 시 생성됨
      const arrival = queryRunner.manager.create(MatArrival, {
        arrivalNo,
        seq: 1,
        invoiceNo: dto.invoiceNo,
        vendorCode: dto.vendorCode,
        vendorName: dto.vendor,
        supUid: dto.supUid || null,
        itemCode: dto.itemCode,
        qty: dto.qty,
        warehouseCode: dto.warehouseId,
        arrivalType: 'MANUAL',
        workerId: dto.workerId,
        remark: dto.remark,
        iqcStatus: 'PENDING',
        status: 'DONE',
        company,
        plant,
      });
      await queryRunner.manager.save(arrival);

      // 2. 내부 LOT 생성
      const lot = queryRunner.manager.create(MatLot, {
        matUid,
        itemCode: dto.itemCode,
        initQty: dto.qty,
        currentQty: dto.qty,
        recvDate: txDate,
        manufactureDate: parseDateStart(dto.manufactureDate),
        expireDate: null,
        arrivalNo,
        arrivalSeq: 1,
        origin: matUid,
        vendor: dto.vendorCode ?? dto.vendor ?? '',
        invoiceNo: dto.invoiceNo ?? null,
        poNo: null,
        mfgPartnerCode: null,
        iqcStatus: 'PENDING',
        status: 'NORMAL',
        company,
        plant,
        createdBy: dto.workerId ?? null,
      });
      const savedLot = await queryRunner.manager.save(lot);

      // 3. 입하재고 + 입하원장 기록. 원자재 현재고(MAT_STOCKS)는 입고 시점에만 증가한다.
      const savedTx = await this.recordIqc005StockArrival(queryRunner, savedLot, dto.warehouseId, {
        company: company ?? null,
        plant: plant ?? null,
        username: dto.workerId ?? 'SYSTEM',
      });

      // warehouse 정보 조회 (part는 이미 위에서 조회)
      const warehouse = await this.warehouseRepository.findOne({
        where: { warehouseCode: dto.warehouseId, ...tenantWhere },
      });

      return {
        ...savedTx,
        arrivalNo,
        matUid,
        itemCode: dto.itemCode,
        itemName: part?.itemName ?? null,
        itemType: part?.itemType ?? null,
        unit: part?.unit ?? null,
        warehouseCode: dto.warehouseId,
        warehouseName: warehouse?.warehouseName ?? null,
      };
    });
  }

  /** 입하 이력 조회 (ARRIVAL_IN + ARRIVAL_CANCEL) */
  async findAll(query: ArrivalQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate, status, transType, matUid, arrivalNo } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.matArrivalTransactionRepository.createQueryBuilder('tx')
      .where('tx.transType IN (:...transTypes)', { transTypes: ['ARRIVAL_IN', 'ARRIVAL_CANCEL'] });

    if (company) queryBuilder.andWhere('tx.company = :company', { company });
    if (plant) queryBuilder.andWhere('tx.plant = :plant', { plant });

    if (status) {
      queryBuilder.andWhere('tx.status = :status', { status });
    }

    if (transType) {
      queryBuilder.andWhere('tx.transType = :transType', { transType });
    }

    if (matUid) {
      queryBuilder.andWhere('UPPER(tx.matUid) LIKE :matUid', { matUid: `%${matUid.toUpperCase()}%` });
    }

    if (arrivalNo) {
      queryBuilder.andWhere('UPPER(tx.arrivalNo) LIKE :arrivalNo', { arrivalNo: `%${arrivalNo.toUpperCase()}%` });
    }

    if (fromDate) {
      queryBuilder.andWhere("tx.transDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      queryBuilder.andWhere("tx.transDate < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });
    }

    if (search) {
      const normalizedSearch = `%${search.toUpperCase()}%`;
      queryBuilder.andWhere(
        `(
          UPPER(tx.transNo) LIKE :search
          OR UPPER(tx.arrivalNo) LIKE :search
          OR UPPER(tx.refId) LIKE :search
          OR UPPER(tx.matUid) LIKE :search
          OR UPPER(tx.itemCode) LIKE :search
          OR tx.itemCode IN (
            SELECT item_code
            FROM item_masters
            WHERE UPPER(item_code) LIKE :search
              OR UPPER(item_name) LIKE :search
          )
        )`,
        { search: normalizedSearch },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('tx.transDate', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    // part, lot, warehouse 정보 조회
    const itemCodes = data.map((item) => item.itemCode).filter(Boolean);
    const matUids = data.map((item) => item.matUid).filter(Boolean) as string[];
    const warehouseIds = data.map((item) => item.warehouseCode).filter(Boolean) as string[];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    const [parts, lots, warehouses] = await Promise.all([
      itemCodes.length > 0 ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
      warehouseIds.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseIds), ...tenantWhere } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // MatArrival 정보 조회 (인보이스번호, 거래처 등)
    // refId(ARRIVAL) 또는 LOT FK 기준으로 먼저 매칭하고, 레거시 데이터만 itemCode fallback을 사용한다.
    const arrivalWhere = data
      .map((tx) => {
        const lot = tx.matUid ? lotMap.get(tx.matUid) : null;
        const arrivalNo = tx.refType === 'ARRIVAL' && tx.refId ? tx.refId : lot?.arrivalNo;
        if (!arrivalNo) return null;
        return {
          arrivalNo,
          ...(lot?.arrivalSeq != null ? { seq: lot.arrivalSeq } : {}),
          ...(tx.itemCode ? { itemCode: tx.itemCode } : {}),
          ...tenantWhere,
        };
      })
      .filter(Boolean) as Array<Partial<MatArrival>>;

    const arrivalRecords = arrivalWhere.length > 0
      ? await this.matArrivalRepository.find({ where: arrivalWhere })
      : itemCodes.length > 0
        ? await this.matArrivalRepository.find({ where: { itemCode: In(itemCodes), status: 'DONE', ...tenantWhere } })
        : [];
    const arrivalByExactKey = new Map<string, MatArrival>();
    for (const arrival of arrivalRecords) {
      arrivalByExactKey.set(`${arrival.arrivalNo}::${arrival.seq}::${arrival.itemCode}`, arrival);
      arrivalByExactKey.set(`${arrival.arrivalNo}::${arrival.itemCode}`, arrival);
      arrivalByExactKey.set(arrival.arrivalNo, arrival);
    }
    const arrivalByItemCode = new Map(arrivalRecords.map((a) => [a.itemCode, a]));

    const flattenedData = data.map((item) => {
      const part = partMap.get(item.itemCode);
      const lot = item.matUid ? lotMap.get(item.matUid) : null;
      const warehouse = item.warehouseCode ? warehouseMap.get(item.warehouseCode) : null;
      const arrivalNo = item.refType === 'ARRIVAL' && item.refId ? item.refId : lot?.arrivalNo;
      const arrival = arrivalNo && item.itemCode
        ? arrivalByExactKey.get(`${arrivalNo}::${lot?.arrivalSeq ?? ''}::${item.itemCode}`)
          ?? arrivalByExactKey.get(`${arrivalNo}::${item.itemCode}`)
          ?? arrivalByExactKey.get(arrivalNo)
        : item.itemCode ? arrivalByItemCode.get(item.itemCode) : null;

      return {
        ...item,
        // flat 필드 (하위 호환)
        itemCode: part?.itemCode ?? item.itemCode,
        itemName: part?.itemName ?? null,
        itemType: part?.itemType ?? null,
        unit: part?.unit ?? null,
        warehouseCode: item.warehouseCode,
        warehouseName: warehouse?.warehouseName ?? null,
        arrivalNo: arrival?.arrivalNo,
        invoiceNo: arrival?.invoiceNo,
        vendorCode: arrival?.vendorCode,
        vendorName: arrival?.vendorName,
        arrivalType: arrival?.arrivalType,
        // 중첩 객체 (프론트엔드 타입 호환)
        part: part ? { itemCode: part.itemCode, itemName: part.itemName, unit: part.unit } : null,
        lot: lot ? { matUid: lot.matUid, poNo: lot.poNo, vendor: lot.vendor } : null,
        toWarehouse: warehouse ? { warehouseCode: warehouse.warehouseCode, warehouseName: warehouse.warehouseName } : null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────────
  // IQC006 입하실적조회
  // ─────────────────────────────────────────────────────────────────

  /** 입하번호+품번 그룹 단위 시리얼 수 서브쿼리 (입하 당시 시리얼만, origin=자기자신/NULL — 분할·병합 파생 제외) */
  private static readonly SERIAL_COUNT_EXPR =
    `(SELECT COUNT(*) FROM "MAT_LOTS" ml WHERE ml."ARRIVAL_NO"=a."ARRIVAL_NO" AND ml."ITEM_CODE"=a."ITEM_CODE" AND ml."COMPANY"=a."COMPANY" AND ml."PLANT_CD"=a."PLANT_CD" AND (ml."ORIGIN"=ml."MAT_UID" OR ml."ORIGIN" IS NULL))`;

  /** 입고완료(RECEIVE 합계 >= INIT_QTY)된 시리얼 수 서브쿼리 (입하번호+품번 그룹, 입하 당시 시리얼만) */
  private static readonly RECEIVED_COUNT_EXPR =
    `(SELECT COUNT(*) FROM "MAT_LOTS" ml WHERE ml."ARRIVAL_NO"=a."ARRIVAL_NO" AND ml."ITEM_CODE"=a."ITEM_CODE" AND ml."COMPANY"=a."COMPANY" AND ml."PLANT_CD"=a."PLANT_CD" AND (ml."ORIGIN"=ml."MAT_UID" OR ml."ORIGIN" IS NULL) AND ml."INIT_QTY" <= NVL((SELECT SUM(st."QTY") FROM "STOCK_TRANSACTIONS" st WHERE st."MAT_UID"=ml."MAT_UID" AND st."TRANS_TYPE"='RECEIVE' AND st."STATUS"<>'CANCELED'),0))`;

  /**
   * IQC006 — 입하실적 목록 (입하번호+SEQ 단위 집계)
   * 상태 도출(우선순위): 취소 → 입고완료 → IQC완료 → IQC진행중 → 입하완료
   */
  async listArrivalResults(query: ArrivalResultQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, fromDate, toDate, itemCode, arrivalNo, status } = query;
    const offset = (page - 1) * limit;

    const sc = ArrivalService.SERIAL_COUNT_EXPR;
    const rc = ArrivalService.RECEIVED_COUNT_EXPR;

    const binds: unknown[] = [];
    const cond: string[] = [];
    cond.push(`a."COMPANY" = :${binds.push(company ?? null)}`);
    cond.push(`a."PLANT_CD" = :${binds.push(plant ?? null)}`);
    if (fromDate) cond.push(`a."ARRIVAL_DATE" >= TO_DATE(:${binds.push(fromDate)}, 'YYYY-MM-DD')`);
    if (toDate) cond.push(`a."ARRIVAL_DATE" < TO_DATE(:${binds.push(toDate)}, 'YYYY-MM-DD') + 1`);
    if (itemCode) cond.push(`a."ITEM_CODE" LIKE :${binds.push(`%${itemCode.toUpperCase()}%`)}`);
    if (arrivalNo) cond.push(`a."ARRIVAL_NO" LIKE :${binds.push(`%${arrivalNo.toUpperCase()}%`)}`);

    // 입하번호 + PO + 품번 그룹 단위 집계 (시리얼은 우측에서 별도 조회)
    const grouped =
      `SELECT a."ARRIVAL_NO" AS "arrivalNo", a."PO_NO" AS "poNo", a."ITEM_CODE" AS "itemCode",` +
      ` MIN(a."SEQ") AS "seq", MIN(a."ARRIVAL_DATE") AS "arrivalDate", MAX(a."CREATED_AT") AS "createdAt", SUM(a."QTY") AS "qty",` +
      ` MAX(a."IQC_STATUS") AS "iqcStatus", MAX(a."VENDOR_CODE") AS "vendorCode", MAX(a."VENDOR_NAME") AS "vendorName",` +
      ` MAX(i."ITEM_NAME") AS "itemName", MAX(i."ITEM_TYPE") AS "itemType", MAX(NVL(i."IQC_FLAG",'N')) AS "iqcFlag",` +
      ` COUNT(CASE WHEN a."STATUS" <> 'CANCELED' THEN 1 END) AS "activeCount",` +
      ` (SELECT MIN(poi."LINE_NO") FROM "PURCHASE_ORDER_ITEMS" poi WHERE poi."PO_ID"=a."PO_NO" AND poi."ITEM_CODE"=a."ITEM_CODE" AND poi."COMPANY"=a."COMPANY" AND poi."PLANT_CD"=a."PLANT_CD") AS "lineNo",` +
      ` NVL((SELECT MIN(poi."REV_NO") FROM "PURCHASE_ORDER_ITEMS" poi WHERE poi."PO_ID"=a."PO_NO" AND poi."ITEM_CODE"=a."ITEM_CODE" AND poi."COMPANY"=a."COMPANY" AND poi."PLANT_CD"=a."PLANT_CD"), 1) AS "relNo",` +
      // 제조사: 입하 시리얼(MAT_LOTS)의 MFG_PARTNER_CODE 기준 (제조사 변경은 그룹 일괄 갱신이라 대표값 MAX 사용)
      ` (SELECT MAX(ml."MFG_PARTNER_CODE") FROM "MAT_LOTS" ml WHERE ml."ARRIVAL_NO"=a."ARRIVAL_NO" AND ml."ITEM_CODE"=a."ITEM_CODE" AND ml."COMPANY"=a."COMPANY" AND ml."PLANT_CD"=a."PLANT_CD") AS "mfgPartnerCode",` +
      ` (SELECT MAX(pm."PARTNER_NAME") FROM "MAT_LOTS" ml JOIN "PARTNER_MASTERS" pm ON pm."PARTNER_CODE"=ml."MFG_PARTNER_CODE" WHERE ml."ARRIVAL_NO"=a."ARRIVAL_NO" AND ml."ITEM_CODE"=a."ITEM_CODE" AND ml."COMPANY"=a."COMPANY" AND ml."PLANT_CD"=a."PLANT_CD") AS "mfgPartnerName",` +
      ` ${sc} AS "serialCount", ${rc} AS "receivedCount"` +
      ` FROM "MAT_ARRIVALS" a` +
      ` LEFT JOIN "ITEM_MASTERS" i ON i."ITEM_CODE"=a."ITEM_CODE" AND i."COMPANY"=a."COMPANY" AND i."PLANT_CD"=a."PLANT_CD"` +
      ` WHERE ${cond.join(' AND ')}` +
      ` GROUP BY a."ARRIVAL_NO", a."PO_NO", a."ITEM_CODE", a."COMPANY", a."PLANT_CD"`;

    // 그룹 대표 상태(우선순위): 전량취소 → 입고완료 → IQC완료 → IQC진행중 → 입하완료
    const inner =
      `SELECT g.*, CASE` +
      ` WHEN g."activeCount"=0 THEN 'CANCELED'` +
      ` WHEN g."serialCount">0 AND g."receivedCount">=g."serialCount" THEN 'RECEIVED'` +
      ` WHEN g."iqcStatus" IN ('PASS','FAIL') THEN 'IQC_DONE'` +
      ` WHEN g."iqcFlag"='Y' THEN 'IQC_PROGRESS'` +
      ` ELSE 'ARRIVED' END AS "derivedStatus"` +
      ` FROM (${grouped}) g`;

    let filter = '';
    if (status) filter = ` WHERE base."derivedStatus" = :${binds.push(status)}`;

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*) AS "cnt" FROM (${inner}) base${filter}`,
      [...binds],
    );
    const total = Number(countRows?.[0]?.cnt ?? 0);

    const offBind = binds.push(offset);
    const limBind = binds.push(limit);
    const dataSql =
      `SELECT base.* FROM (${inner}) base${filter}` +
      ` ORDER BY base."createdAt" DESC, base."arrivalDate" DESC, base."arrivalNo" DESC, base."itemCode"` +
      ` OFFSET :${offBind} ROWS FETCH NEXT :${limBind} ROWS ONLY`;
    const rows = await this.dataSource.query(dataSql, binds);

    const data = (rows as Record<string, unknown>[]).map((r) => {
      const serialCount = Number(r.serialCount ?? 0);
      const receivedCount = Number(r.receivedCount ?? 0);
      const derivedStatus = String(r.derivedStatus ?? 'ARRIVED');
      return {
        arrivalNo: r.arrivalNo,
        seq: Number(r.seq ?? 1),
        poNo: r.poNo ?? null,
        lineNo: r.lineNo ?? null,
        relNo: r.relNo ?? null,
        arrivalDate: r.arrivalDate,
        createdAt: r.createdAt ?? null,
        itemCode: r.itemCode,
        itemName: r.itemName ?? null,
        qty: Number(r.qty ?? 0),
        serialCount,
        receivedCount,
        // 구분: 소모품=CM, 그 외(원자재 등)=RM (목업 IqcType)
        poType: r.itemType === 'CONSUMABLE' ? 'CM' : 'RM',
        status: derivedStatus,
        iqcStatus: r.iqcStatus ?? null,
        vendorCode: r.vendorCode ?? null,
        vendorName: r.vendorName ?? null,
        mfgPartnerCode: r.mfgPartnerCode ?? null,
        mfgPartnerName: r.mfgPartnerName ?? null,
        // 입하취소 가능: 미취소 & 입고 이력 없음
        cancelable: derivedStatus !== 'CANCELED' && receivedCount === 0,
      };
    });

    return { data, total, page, limit };
  }

  /** IQC006 — 특정 입하 그룹(arrivalNo+품번)의 시리얼 목록 (입고/취소 여부 포함) */
  async getArrivalSerials(arrivalNo: string, itemCode: string, company?: string, plant?: string) {
    const binds: unknown[] = [arrivalNo, itemCode, company ?? null, plant ?? null];
    const sql =
      `SELECT ml."MAT_UID" AS "matUid", ml."INIT_QTY" AS "qty", ml."STATUS" AS "lotStatus", ml."IQC_STATUS" AS "iqcStatus",` +
      ` NVL((SELECT SUM(st."QTY") FROM "STOCK_TRANSACTIONS" st WHERE st."MAT_UID"=ml."MAT_UID" AND st."TRANS_TYPE"='RECEIVE' AND st."STATUS"<>'CANCELED'),0) AS "receivedQty"` +
      ` FROM "MAT_LOTS" ml` +
      ` WHERE ml."ARRIVAL_NO"=:1 AND ml."ITEM_CODE"=:2 AND ml."COMPANY"=:3 AND ml."PLANT_CD"=:4` +
      ` AND (ml."ORIGIN"=ml."MAT_UID" OR ml."ORIGIN" IS NULL)` + // 분할/병합 파생 시리얼 제외
      ` ORDER BY ml."MAT_UID"`;
    const rows = await this.dataSource.query(sql, binds);
    return (rows as Record<string, unknown>[]).map((r) => {
      const qty = Number(r.qty ?? 0);
      const receivedQty = Number(r.receivedQty ?? 0);
      const stockIn = qty > 0 && receivedQty >= qty;
      const canceled = String(r.lotStatus ?? '') === 'CANCELED';
      return {
        matUid: r.matUid,
        qty,
        iqcStatus: r.iqcStatus ?? null,
        stockInYn: stockIn ? 'Y' : 'N',
        cancelYn: canceled ? 'Y' : 'N',
        checkable: !stockIn && !canceled,
      };
    });
  }

  /**
   * IQC006 — 입하(arrivalNo+seq) 제조사 변경
   * 해당 입하의 시리얼(MAT_LOTS) mfgPartnerCode 일괄 갱신 (메타데이터, LOT 정체성 불변)
   */
  async changeManufacturer(
    arrivalNo: string,
    itemCode: string,
    mfgPartnerCode: string,
    company?: string,
    plant?: string,
  ) {
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    // 입하 그룹(arrivalNo+품번) 존재 확인 (미취소 행 1건 이상)
    const arrivals = await this.matArrivalRepository.find({
      where: { arrivalNo, itemCode, ...tenantWhere },
    });
    if (arrivals.length === 0) throw new NotFoundException(`입하 정보를 찾을 수 없습니다: ${arrivalNo}/${itemCode}`);
    if (arrivals.every((a) => a.status === 'CANCELED')) {
      throw new BadRequestException('취소된 입하는 제조사를 변경할 수 없습니다.');
    }

    // 제조사 거래처 검증 (PARTNER_TYPE='MFG')
    const partner = await this.partnerMasterRepository.findOne({
      where: { partnerCode: mfgPartnerCode, ...tenantWhere },
      select: ['partnerCode', 'partnerType'],
    });
    if (!partner) throw new BadRequestException(`거래처를 찾을 수 없습니다: ${mfgPartnerCode}`);
    if (partner.partnerType !== 'MFG') {
      throw new BadRequestException('제조사(PARTNER_TYPE=MFG) 거래처만 지정할 수 있습니다.');
    }

    // 해당 입하 그룹의 입하 당시 시리얼들 mfgPartnerCode 갱신
    const result = await this.matLotRepository.update(
      { arrivalNo, itemCode, ...tenantWhere },
      { mfgPartnerCode },
    );

    return { arrivalNo, itemCode, mfgPartnerCode, updatedSerials: result.affected ?? 0 };
  }

  /**
   * IQC006 — 입하(arrivalNo) 전체 취소
   * 동일 arrivalNo의 모든 품목·시리얼 ARRIVAL_IN 트랜잭션을 일괄 역분개.
   * 입고 완료 시리얼이 하나라도 있으면 기존 cancel 로직이 차단한다.
   */
  async cancelByArrival(
    arrivalNo: string,
    reason: string,
    company?: string,
    plant?: string,
    workerId?: string,
  ) {
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    // arrivalNo 전체의 입하 당시 시리얼 (분할/병합 파생 제외)
    const lots = await this.matLotRepository.find({
      where: { arrivalNo, ...tenantWhere },
      select: ['matUid', 'origin'],
    });
    const sourceLots = lots.filter((l) => !l.origin || l.origin === l.matUid);
    if (sourceLots.length === 0) {
      throw new NotFoundException(`입하 시리얼을 찾을 수 없습니다: ${arrivalNo}`);
    }
    const matUids = sourceLots.map((l) => l.matUid);

    const txns = await this.matArrivalTransactionRepository.find({
      where: { matUid: In(matUids), transType: 'ARRIVAL_IN', status: 'DONE', ...tenantWhere },
      select: ['transNo'],
    });
    if (txns.length === 0) {
      throw new BadRequestException('취소할 입하 트랜잭션이 없습니다. (이미 취소되었거나 입하 이력이 없습니다)');
    }

    let canceled = 0;
    for (const tx of txns) {
      await this.cancel({ transactionId: tx.transNo, reason, workerId }, company, plant);
      canceled++;
    }
    return { arrivalNo, canceledTransactions: canceled };
  }

  /** 입하 취소 (역분개 트랜잭션) */
  async cancel(dto: CancelArrivalDto, company?: string, plant?: string) {
    const original = await this.matArrivalTransactionRepository.findOne({
      where: { transNo: dto.transactionId, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (!original) throw new NotFoundException(`트랜잭션을 찾을 수 없습니다: ${dto.transactionId}`);
    if (original.status === 'CANCELED') throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    if (original.transType !== 'ARRIVAL_IN') throw new BadRequestException('입하 트랜잭션만 취소할 수 있습니다.');
    this.assertSameTenant('입하 원본 트랜잭션', { company, plant }, original);

    // G3: 입하 취소 조건 제한 — IQC 판정 이후 취소 불가 (무검사품은 입고 전)
    const tenantWhere = {
      ...(original.company ? { company: original.company } : company ? { company } : {}),
      ...(original.plant ? { plant: original.plant } : plant ? { plant } : {}),
    };
    if (original.itemCode) {
      const iqcRecord = await this.iqcLogRepository.findOne({
        where: { arrivalNo: original.refId ?? undefined, itemCode: original.itemCode, ...tenantWhere },
        order: { inspectDate: 'DESC' },
      });
      if (iqcRecord && (iqcRecord.result === 'PASS' || iqcRecord.result === 'FAIL')) {
        throw new BadRequestException('IQC 판정이 완료된 입하는 취소할 수 없습니다.');
      }
    }

    await this.ensureNoDownstreamProgress(original, company, plant);

    const cancelTransNo = `${original.transNo}-C`;

    return this.tx.run(async (queryRunner) => {
      // 1. 원본 CANCELED 처리
      await queryRunner.manager.update(MatArrivalTransaction, { transNo: original.transNo, ...tenantWhere }, { status: 'CANCELED' });

      // 1-1. MatArrival도 CANCELED 처리 (matUid → LOT.arrivalNo FK 기준)
      let canceledArrival: MatArrival | null = null;
      if (original.matUid) {
        // matUid → MatLot.arrivalNo로 정확한 입하 건 식별
        const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid: original.matUid, ...tenantWhere } });
        if (lot?.arrivalNo) {
          canceledArrival = await queryRunner.manager.findOne(MatArrival, {
            where: { arrivalNo: lot.arrivalNo, seq: lot.arrivalSeq ?? 1, ...tenantWhere },
          });
          await queryRunner.manager.update(MatArrival, { arrivalNo: lot.arrivalNo, seq: lot.arrivalSeq ?? 1, ...tenantWhere }, { status: 'CANCELED' });
        }
      } else if (original.itemCode) {
        // matUid 없는 레거시 데이터 — 기존 로직 유지
        const arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
          where: { itemCode: original.itemCode, status: 'DONE', ...tenantWhere },
          order: { arrivalDate: 'DESC' },
        });
        if (arrivalRecord) {
          canceledArrival = arrivalRecord;
          await queryRunner.manager.update(MatArrival, { arrivalNo: arrivalRecord.arrivalNo, seq: arrivalRecord.seq, ...tenantWhere }, { status: 'CANCELED' });
        }
      }

      // 2. 역분개 트랜잭션 생성
      const cancelTx = queryRunner.manager.create(MatArrivalTransaction, {
        transNo: cancelTransNo,
        transType: 'ARRIVAL_CANCEL',
        arrivalNo: original.arrivalNo,
        arrivalSeq: original.arrivalSeq,
        warehouseCode: original.warehouseCode,
        itemCode: original.itemCode,
        matUid: original.matUid,
        qty: -original.qty,
        remark: dto.reason,
        workerId: dto.workerId,
        cancelRefId: original.transNo,
        refType: 'CANCEL',
        company: original.company,
        plant: original.plant,
      });
      const savedCancelTx = await queryRunner.manager.save(cancelTx);

      // 3. 입하재고 감소
      await this.decreaseArrivalStock(
        queryRunner.manager,
        original.matUid,
        original.itemCode,
        original.qty,
        original.company,
        original.plant,
      );

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리

      // 5. PO receivedQty 감소 + PO status 재계산
      if (original.refType === 'PO' && original.refId) {
        const poItemId = canceledArrival?.poItemId ?? original.refId;
        const refSeq = Number(poItemId);
        const poNoFromComposite = String(poItemId).match(/^(.+)-(\d+)$/);
        const poNo = canceledArrival?.poNo ?? canceledArrival?.poId ?? poNoFromComposite?.[1];
        const poSeq = !isNaN(refSeq) ? refSeq : poNoFromComposite ? Number(poNoFromComposite[2]) : NaN;
        const poItem = poNo && !isNaN(poSeq)
          ? await queryRunner.manager.findOne(PurchaseOrderItem, { where: { poNo, seq: poSeq, ...tenantWhere } })
          : null;
        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, { poNo: poItem.poNo, seq: poItem.seq, ...tenantWhere }, {
            receivedQty: Math.max(0, poItem.receivedQty - original.qty),
          });
          await this.updatePOStatus(queryRunner.manager, poItem.poNo, original.company, original.plant);
        }
      }

      // part, lot, warehouse 정보 조회
      const [part, lot, toWarehouse] = await Promise.all([
        this.itemMasterRepository.findOne({ where: { itemCode: original.itemCode, ...tenantWhere } }),
        original.matUid
          ? this.matLotRepository.findOne({
              where: { matUid: original.matUid, ...tenantWhere },
            })
          : null,
        original.warehouseCode
          ? this.warehouseRepository.findOne({
              where: { warehouseCode: original.warehouseCode, ...tenantWhere },
            })
          : null,
      ]);

      return {
        ...savedCancelTx,
        itemCode: original.itemCode,
        itemName: part?.itemName ?? null,
        itemType: part?.itemType ?? null,
        unit: part?.unit ?? null,
        matUid: original.matUid,
        warehouseCode: original.warehouseCode,
        warehouseName: toWarehouse?.warehouseName ?? null,
      };
    });
  }

  private async ensureNoDownstreamProgress(original: { matUid?: string | null; transNo: string }, company?: string, plant?: string) {
    if (!original.matUid) {
      return;
    }

    const matIssueRepo = this.dataSource.getRepository(MatIssue);
    const prodResultRepo = this.dataSource.getRepository(ProdResult);
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);

    const latestIssue = await matIssueRepo.findOne({
      where: { matUid: original.matUid, status: 'DONE', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      order: { issueDate: 'DESC' },
    });

    if (!latestIssue) {
      return;
    }

    const blockers = [`자재출고=${latestIssue.issueNo}-${latestIssue.seq}`];

    let prodResult: ProdResult | null = null;
    if (latestIssue.prodResultNo) {
      prodResult = await prodResultRepo.findOne({
        where: { resultNo: latestIssue.prodResultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });
    } else if (latestIssue.orderNo) {
      prodResult = await prodResultRepo.findOne({
        where: {
          orderNo: latestIssue.orderNo,
          status: In(['RUNNING', 'DONE']),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        order: { createdAt: 'DESC' },
      });
    }

    if (prodResult && prodResult.status !== 'CANCELED') {
      blockers.push(`생산실적=${prodResult.resultNo}(${prodResult.status})`);

      if (prodResult.prdUid) {
        const fgLabel = await fgLabelRepo.findOne({
          where: { fgBarcode: prodResult.prdUid },
        });
        if (fgLabel) {
          blockers.push(`FG=${fgLabel.fgBarcode}(${fgLabel.status})`);
        }
      }
    }

    throw new BadRequestException(
      `입하 ${original.transNo} 는 뒤 공정이 이미 진행되어 취소할 수 없습니다. ` +
        `현재 상태: ${blockers.join(', ')}. ` +
        `출하 -> 팔레트 -> 박스/OQC -> FG 라벨 -> 생산실적 -> 자재출고 순서로 역처리 후 다시 입하를 취소해 주세요.`,
    );
  }

  /** 오늘 입하 통계 */
  async getStats(company?: string, plant?: string) {
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const [todayCount, todayQtyResult, unrecevedPoCount, totalCount] = await Promise.all([
      this.matArrivalTransactionRepository
        .createQueryBuilder('tx')
        .where('tx.transType = :transType', { transType: 'ARRIVAL_IN' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere("tx.transDate >= TO_DATE(:today, 'YYYY-MM-DD')", { today })
        .andWhere("tx.transDate < TO_DATE(:today, 'YYYY-MM-DD') + INTERVAL '1' DAY", { today })
        .andWhere(company ? 'tx.company = :company' : '1=1', { company })
        .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
        .getCount(),
      this.matArrivalTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.transType = :transType', { transType: 'ARRIVAL_IN' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere("tx.transDate >= TO_DATE(:today, 'YYYY-MM-DD')", { today })
        .andWhere("tx.transDate < TO_DATE(:today, 'YYYY-MM-DD') + INTERVAL '1' DAY", { today })
        .andWhere(company ? 'tx.company = :company' : '1=1', { company })
        .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
        .getRawOne(),
      this.purchaseOrderRepository.count({
        where: { status: In(['CONFIRMED', 'PARTIAL']), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      }),
      this.matArrivalTransactionRepository.count({
        where: { transType: 'ARRIVAL_IN', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      }),
    ]);

    return {
      todayCount,
      todayQty: parseInt(todayQtyResult?.sumQty) || 0,
      unrecevedPoCount,
      totalCount,
    };
  }

  /** 입하재고현황 조회 (MAT_ARRIVALS 기반 + 입하재고 조인) */
  async getArrivalStockStatus(query: ArrivalStockQueryDto, company?: string, plant?: string) {
    const { search, fromDate, toDate } = query;

    const qb = this.matArrivalRepository.createQueryBuilder('a')
      .where('a.status = :status', { status: 'DONE' });
    if (company) qb.andWhere('a.company = :company', { company });
    if (plant) qb.andWhere('a.plant = :plant', { plant });

    if (fromDate) {
      qb.andWhere("a.arrivalDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      qb.andWhere("a.arrivalDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });
    }

    const arrivals = await qb.orderBy('a.arrivalDate', 'DESC').getMany();

    if (arrivals.length === 0) {
      return {
        data: [],
        stats: { totalArrivalQty: 0, totalCurrentStock: 0, partCount: 0, lotCount: 0 },
      };
    }

    // 관련 ID 수집 (MatArrival에는 matUid 없음 — itemCode 기준으로 조회)
    const itemCodes = [...new Set(arrivals.map((a) => a.itemCode))];
    const warehouseCodes = [...new Set(arrivals.map((a) => a.warehouseCode))];
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    // 병렬 조회
    const [parts, warehouses, stocks] = await Promise.all([
      this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }),
      this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes), ...tenantWhere } }),
      this.matArrivalStockRepository.find({
        where: {
          itemCode: In(itemCodes),
          warehouseCode: In(warehouseCodes),
          ...tenantWhere,
        },
      }),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // Arrival stock map: warehouseCode_itemCode -> qty
    const stockMap = new Map<string, number>();
    for (const s of stocks) {
      const key = `${s.warehouseCode}_${s.itemCode}`;
      stockMap.set(key, (stockMap.get(key) || 0) + s.qty);
    }

    let data = arrivals.map((a) => {
      const part = partMap.get(a.itemCode);
      const warehouse = warehouseMap.get(a.warehouseCode);
      const stockKey = `${a.warehouseCode}_${a.itemCode}`;
      const currentStock = stockMap.get(stockKey) ?? 0;

      return {
        arrivalNo: a.arrivalNo,
        seq: a.seq,
        invoiceNo: a.invoiceNo,
        poNo: a.poNo,
        vendorName: a.vendorName,
        itemCode: a.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        arrivalQty: a.qty,
        currentStock,
        warehouseName: warehouse?.warehouseName || a.warehouseCode,
        arrivalType: a.arrivalType,
        arrivalDate: a.arrivalDate,
      };
    });

    // 검색 필터 (메모리 필터링)
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((d) =>
        (d.itemCode && d.itemCode.toLowerCase().includes(s)) ||
        (d.itemName && d.itemName.toLowerCase().includes(s)) ||
        (d.poNo && d.poNo.toLowerCase().includes(s)) ||
        (d.invoiceNo && d.invoiceNo.toLowerCase().includes(s)) ||
        (d.arrivalNo && d.arrivalNo.toLowerCase().includes(s)),
      );
    }

    // 통계
    const stats = {
      totalArrivalQty: data.reduce((sum, d) => sum + d.arrivalQty, 0),
      totalCurrentStock: data.reduce((sum, d) => sum + d.currentStock, 0),
      partCount: new Set(data.map((d) => d.itemCode)).size,
      lotCount: 0,
    };

    return { data, stats };
  }

  /**
   * 바코드로 입하 정보 조회
   *
   * 1차: MAT_ARRIVALS 테이블에서 ARRIVAL_NO 또는 PO_NO로 바코드 직접 조회
   * 2차 (1차 실패): VENDOR_BARCODE_MAPPINGS에서 ITEM_CODE 매핑 후 최신 입하 조회
   * IQC 상태는 iqcYn='N'이면 NONE, 'Y'이면 IQC_LOGS 최신 결과로 결정
   */
  async findByBarcode(barcode: string, company?: string, plant?: string) {
    // 1차 시도: arrivalNo 또는 poNo로 직접 조회
    let arrival: MatArrival | null = await this.matArrivalRepository.findOne({
      where: { arrivalNo: barcode, status: 'DONE', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      order: { arrivalDate: 'DESC' },
    });

    if (!arrival) {
      arrival = await this.matArrivalRepository.findOne({
        where: { poNo: barcode, status: 'DONE', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        order: { arrivalDate: 'DESC' },
      });
    }

    // 2차 시도: VendorBarcodeMapping에서 itemCode 매핑
    if (!arrival) {
      const mapping = await this.vendorBarcodeMappingRepository.findOne({
        where: { vendorBarcode: barcode, useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });

      if (mapping) {
        arrival = await this.matArrivalRepository.findOne({
          where: { itemCode: mapping.itemCode, status: 'DONE', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          order: { arrivalDate: 'DESC' },
        });
      }
    }

    if (!arrival) {
      throw new NotFoundException(`바코드에 해당하는 입하 정보를 찾을 수 없습니다: ${barcode}`);
    }

    // 품목 정보 조회
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: arrival.itemCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    const iqcYn = part?.iqcYn ?? 'Y';

    // IQC 상태 결정
    let iqcStatus: 'PASS' | 'FAIL' | 'IN_PROGRESS' | 'NONE' = 'NONE';

    if (iqcYn === 'Y') {
      // IQC_LOGS에서 해당 입하번호의 최신 검사 결과 조회
      const latestIqcLog = await this.iqcLogRepository.findOne({
        where: { arrivalNo: arrival.arrivalNo },
        order: { inspectDate: 'DESC' },
      });

      if (!latestIqcLog) {
        iqcStatus = 'IN_PROGRESS'; // IQC 대상이지만 아직 검사 미완
      } else if (latestIqcLog.result === 'PASS') {
        iqcStatus = 'PASS';
      } else if (latestIqcLog.result === 'FAIL') {
        iqcStatus = 'FAIL';
      } else {
        iqcStatus = 'IN_PROGRESS';
      }
    }

    // PO 기반 입하의 경우 발주수량 조회
    let orderQty = 0;
    if (arrival.poId && arrival.poItemId) {
      // poItemId는 seq 번호 또는 "poNo-seq" 형식
      const poItemSeq = Number(arrival.poItemId);
      const poItem = !isNaN(poItemSeq)
        ? await this.purchaseOrderItemRepository.findOne({
            where: { poNo: arrival.poNo || arrival.poId, seq: poItemSeq, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          })
        : null;
      if (poItem) {
        orderQty = poItem.orderQty;
      }
    }

    return {
      arrivalNo: arrival.arrivalNo,
      poNo: arrival.poNo ?? '',
      itemCode: arrival.itemCode,
      itemName: part?.itemName ?? '',
      orderQty,
      receivedQty: arrival.qty,
      unit: part?.unit ?? '',
      supplier: arrival.vendorName,
      iqcYn,
      iqcStatus,
    };
  }

  /** PO 상태 재계산 */
  private async updatePOStatus(manager: EntityManager, poNo: string, company?: string | null, plant?: string | null) {
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const poItems = await manager.find(PurchaseOrderItem, {
      where: { poNo, ...tenantWhere },
    });

    const allReceived = poItems.every(
      (item: PurchaseOrderItem) => item.receivedQty >= item.orderQty,
    );
    const someReceived = poItems.some(
      (item: PurchaseOrderItem) => item.receivedQty > 0,
    );

    let newStatus: string;
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'CONFIRMED';
    }

    await manager.update(PurchaseOrder, { poNo, ...tenantWhere }, { status: newStatus });
  }

  /** MatStock upsert (현재고 증감) */
  private async upsertStock(manager: EntityManager, warehouseCode: string, itemCode: string, matUid: string | null, qtyDelta: number, company?: string, plant?: string) {
    const resolvedMatUid = matUid || '*';
    const existing = await manager.findOne(MatStock, {
      where: { warehouseCode, itemCode, matUid: resolvedMatUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (existing) {
      const newQty = Math.max(0, existing.qty + qtyDelta);
      await manager.update(MatStock,
        {
          warehouseCode: existing.warehouseCode,
          itemCode: existing.itemCode,
          matUid: existing.matUid,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        { qty: newQty, availableQty: Math.max(0, newQty - existing.reservedQty) },
      );
    } else if (qtyDelta > 0) {
      const newStock = manager.create(MatStock, {
        warehouseCode,
        itemCode,
        matUid: resolvedMatUid,
        qty: qtyDelta,
        availableQty: qtyDelta,
        company,
        plant,
      });
      await manager.save(newStock);
    }
  }

  private async decreaseArrivalStock(
    manager: EntityManager,
    matUid: string,
    itemCode: string,
    qty: number,
    company?: string | null,
    plant?: string | null,
  ) {
    const stock = await manager.findOne(MatArrivalStock, {
      where: {
        matUid,
        itemCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!stock) {
      throw new BadRequestException(`입하재고를 찾을 수 없습니다. LOT: ${matUid}`);
    }
    if (stock.availableQty < qty || stock.qty < qty) {
      throw new BadRequestException(`입하재고가 부족합니다. LOT: ${matUid}, 요청=${qty}, 입하재고=${stock.availableQty}`);
    }

    const newQty = stock.qty - qty;
    await manager.update(MatArrivalStock, {
      company: stock.company,
      plant: stock.plant,
      matUid: stock.matUid,
    }, {
      qty: newQty,
      availableQty: Math.max(0, stock.availableQty - qty),
      status: newQty > 0 ? 'AVAILABLE' : 'DEPLETED',
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // IQC005 Phase A — PO 라인 단위 입하 (시리얼 N건 발급)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * IQC005 메인 그리드용 PO 라인 목록.
   * PO 라인 단위로 평면화하여 (poNo, seq, lineNo, revNo, status, useType 등) 반환.
   */
  async listPoLines(query: PoLineQueryDto, company?: string | null, plant?: string | null) {
    const qb = this.purchaseOrderItemRepository
      .createQueryBuilder('pi')
      .innerJoin(PurchaseOrder, 'po', 'po.PO_NO = pi.PO_ID')
      .leftJoin(ItemMaster, 'item', 'item.ITEM_CODE = pi.ITEM_CODE')
      .select([
        'pi.PO_ID AS "poNo"',
        'pi.SEQ AS "poSeq"',
        'NVL(pi.LINE_NO, pi.SEQ) AS "lineNo"',
        'NVL(pi.REV_NO, 1) AS "revNo"',
        'pi.ITEM_CODE AS "itemCode"',
        'item.ITEM_NAME AS "itemName"',
        'pi.ORDER_QTY AS "orderQty"',
        'pi.RECEIVED_QTY AS "receivedQty"',
        '(pi.ORDER_QTY - pi.RECEIVED_QTY) AS "remainingQty"',
        'po.ORDER_DATE AS "orderDate"',
        'po.PARTNER_NAME AS "partnerName"',
        "NVL(po.USE_TYPE, 'PROD') AS \"useType\"",
        "NVL(pi.LINE_STATUS, 'OPEN') AS \"lineStatus\"",
      ]);

    // 기본적으로 CLOSE 제외 — 입하 완료된 라인은 이 화면에서 볼 필요 없음
    if (query.status) {
      qb.where("NVL(pi.LINE_STATUS, 'OPEN') = :st", { st: query.status });
    } else {
      qb.where("NVL(pi.LINE_STATUS, 'OPEN') != 'CLOSE'");
    }
    if (query.itemCode) qb.andWhere('pi.ITEM_CODE = :ic', { ic: query.itemCode });
    if (query.poNo) qb.andWhere('pi.PO_ID LIKE :pno', { pno: `%${query.poNo}%` });
    if (company) qb.andWhere('pi.COMPANY = :co', { co: company });
    if (plant) qb.andWhere('pi.PLANT_CD = :pl', { pl: plant });

    qb.orderBy('po.ORDER_DATE', 'DESC').addOrderBy('NVL(pi.LINE_NO, pi.SEQ)', 'ASC');

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      poNo: r.poNo,
      poSeq: Number(r.poSeq),
      lineNo: Number(r.lineNo),
      revNo: Number(r.revNo),
      itemCode: r.itemCode,
      itemName: r.itemName ?? '',
      orderQty: Number(r.orderQty),
      receivedQty: Number(r.receivedQty),
      remainingQty: Number(r.remainingQty),
      orderDate: r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : null,
      partnerName: r.partnerName ?? '',
      useType: r.useType ?? 'PROD',
      lineStatus:
        (r.lineStatus === 'CLOSE' || r.lineStatus === 'CLOSED') ? 'CLOSE'
        : r.lineStatus === 'PARTIAL' ? 'PARTIAL'
        : 'OPEN',
    }));
  }

  /**
   * IQC005 PO 1라인 입하 등록.
   *
   * 흐름:
   * 1. PO 라인 조회 (poNo, seq) + 잔량 검증
   * 2. PO 헤더 조회 (partner 등)
   * 3. 제조사 검증 (PARTNER_TYPE='MFG')
   * 4. ITEM_MASTERS.LOT_UNIT_QTY로 시리얼 개수 산정 (자투리 포함)
   * 5. 채번: ARRIVAL_NO 1건, MAT_UID N건 (NumberingService.nextArrivalNoV2 / nextMatSerial)
   * 6. MAT_LOTS N건 insert (동일 ARRIVAL_NO, 시리얼별 INIT_QTY)
   * 7. PO 라인 누적 입하 수량 + 상태 갱신
   * 8. MAT_ARRIVAL_STOCKS + MAT_ARRIVAL_TRANSACTIONS N건 기록
   * 9. MAT_ARRIVALS 헤더 N건 기록
   *
   * @returns 발급된 시리얼 목록 (UI 라벨 모달용)
   */
  async receivePoLine(
    dto: PoLineReceiptDto,
    user: { username?: string; company?: string | null; plant?: string | null },
  ): Promise<{ arrivalNo: string; serials: MatLot[] }> {
    const username = user?.username ?? 'SYSTEM';
    return this.tx.run(async (qr) => {
      // 1. PO 라인 — ERP 비즈니스 3키 (poNo + lineNo + revNo)로 식별
      const poItem = await qr.manager.findOne(PurchaseOrderItem, {
        where: { poNo: dto.poNo, lineNo: dto.lineNo, revNo: dto.revNo },
      });
      if (!poItem) {
        throw new NotFoundException(`PO 라인 없음: ${dto.poNo} L${dto.lineNo} R${dto.revNo}`);
      }
      const remaining = poItem.orderQty - poItem.receivedQty;
      if (dto.receivedQty > remaining) {
        throw new BadRequestException(
          `입하 수량(${dto.receivedQty})이 PO 잔량(${remaining}) 초과`,
        );
      }

      // 2. PO 헤더
      const po = await qr.manager.findOne(PurchaseOrder, { where: { poNo: dto.poNo } });
      if (!po) throw new NotFoundException(`PO 헤더 없음: ${dto.poNo}`);

      // 3. 제조사
      const mfg = await qr.manager.findOne(PartnerMaster, {
        where: { partnerCode: dto.mfgPartnerCode, partnerType: 'MFG' },
      });
      if (!mfg) {
        throw new BadRequestException(
          `제조사 없음 또는 MFG 타입 아님: ${dto.mfgPartnerCode}`,
        );
      }

      const warehouse = await qr.manager.findOne(Warehouse, {
        where: {
          warehouseCode: dto.warehouseCode,
          ...(user?.company ? { company: user.company } : {}),
          ...(user?.plant ? { plant: user.plant } : {}),
        },
      });
      if (!warehouse) {
        throw new NotFoundException(`입하 창고 없음: ${dto.warehouseCode}`);
      }
      if (!['RAW', 'RM'].includes(warehouse.warehouseType)) {
        throw new BadRequestException(
          `자재 입하는 원자재 창고만 선택할 수 있습니다: ${dto.warehouseCode} (${warehouse.warehouseType})`,
        );
      }

      // 4. 시리얼 단위 (LOT_UNIT_QTY) — 품목 마스터 미등록(ERP 인터페이스 전)이면 단일 LOT으로 처리
      const item = await qr.manager.findOne(ItemMaster, {
        where: { itemCode: poItem.itemCode },
      });
      const unit = item?.lotUnitQty && item.lotUnitQty > 0 ? item.lotUnitQty : dto.receivedQty;
      const serialCount = Math.ceil(dto.receivedQty / unit);

      // 5. 채번 (IQC005 신규 채번 메서드, 트랜잭션 내)
      const txDate = parseDateStart(dto.receivedDate)!;
      const arrivalNo = await this.numbering.nextArrivalNoV2(qr, txDate);
      const serialNos: string[] = [];
      for (let i = 0; i < serialCount; i++) {
        serialNos.push(await this.numbering.nextMatSerial(qr, txDate));
      }

      // 6. MAT_LOTS N건 생성 (자투리 포함)
      const lots: MatLot[] = [];
      let qtyLeft = dto.receivedQty;
      for (let i = 0; i < serialCount; i++) {
        const qty = Math.min(unit, qtyLeft);
        qtyLeft -= qty;
        const lot = qr.manager.create(MatLot, {
          matUid: serialNos[i],
          itemCode: poItem.itemCode,
          initQty: qty,
          currentQty: qty,
          recvDate: txDate,
          manufactureDate: null,
          expireDate: null,
          arrivalNo,
          arrivalSeq: i + 1,
          origin: serialNos[i],
          vendor: po.partnerCode ?? '',
          invoiceNo: '',
          poNo: po.poNo,
          mfgPartnerCode: dto.mfgPartnerCode,
          iqcStatus: 'PENDING',
          status: 'NORMAL',
          company: user?.company ?? null,
          plant: user?.plant ?? null,
          createdBy: username,
        });
        lots.push(lot);
      }
      const savedLots = await qr.manager.save(MatLot, lots);

      // 7. PO 라인 잔량 + 상태 갱신
      poItem.receivedQty += dto.receivedQty;
      poItem.lineStatus = poItem.receivedQty >= poItem.orderQty ? 'CLOSE' : 'PARTIAL';
      await qr.manager.save(PurchaseOrderItem, poItem);

      // 8. 입하재고 + 입하원장 기록 (시리얼당 1건)
      for (const lot of savedLots) {
        await this.recordIqc005StockArrival(qr, lot, dto.warehouseCode, {
          company: user?.company ?? null,
          plant: user?.plant ?? null,
          username,
        });
      }

      // 9. MAT_ARRIVALS 헤더 기록 (시리얼당 1행, 같은 ARRIVAL_NO + 다른 SEQ)
      let arrivalSeqCounter = 1;
      for (const lot of savedLots) {
        const arrivalRow = qr.manager.create(MatArrival, {
          arrivalNo,
          seq: arrivalSeqCounter++,
          invoiceNo: '',
          poId: po.poNo,
          poItemId: `${po.poNo}#${poItem.seq}`,
          poNo: po.poNo,
          vendorCode: po.partnerCode ?? '',
          vendorName: po.partnerName ?? '',
          itemCode: lot.itemCode,
          qty: lot.initQty,
          warehouseCode: dto.warehouseCode,
          arrivalDate: txDate,
          arrivalType: 'PO',
          workerId: username,
          remark: dto.remark ?? null,
          iqcStatus: 'PENDING',
          supUid: lot.matUid,
          status: 'DONE',
          company: user?.company ?? null,
          plant: user?.plant ?? null,
          createdBy: username,
        });
        await qr.manager.save(MatArrival, arrivalRow);
      }

      return { arrivalNo, serials: savedLots };
    });
  }

  /** IQC005 — 단일 시리얼 단위 입하재고 + 입하원장 1건. */
  private async recordIqc005StockArrival(
    qr: QueryRunner,
    lot: MatLot,
    warehouseCode: string,
    ctx: { company: string | null; plant: string | null; username: string },
  ): Promise<MatArrivalTransaction> {
    const stock = qr.manager.create(MatArrivalStock, {
      warehouseCode,
      itemCode: lot.itemCode,
      matUid: lot.matUid,
      arrivalNo: lot.arrivalNo,
      arrivalSeq: lot.arrivalSeq,
      qty: lot.initQty,
      availableQty: lot.initQty,
      status: 'AVAILABLE',
      company: ctx.company ?? lot.company,
      plant: ctx.plant ?? lot.plant,
      createdBy: ctx.username,
    });
    await qr.manager.save(MatArrivalStock, stock);

    const transNo = await this.numbering.next('STOCK_TX', qr, ctx.username);
    const tx = qr.manager.create(MatArrivalTransaction, {
      transNo,
      transType: 'ARRIVAL_IN',
      transDate: new Date(),
      arrivalNo: lot.arrivalNo,
      arrivalSeq: lot.arrivalSeq,
      warehouseCode,
      itemCode: lot.itemCode,
      matUid: lot.matUid,
      qty: lot.initQty,
      refType: 'ARRIVAL',
      refId: lot.arrivalNo,
      workerId: ctx.username,
      status: 'DONE',
      company: ctx.company ?? lot.company,
      plant: ctx.plant ?? lot.plant,
      createdBy: ctx.username,
    });
    return qr.manager.save(MatArrivalTransaction, tx);
  }
}
