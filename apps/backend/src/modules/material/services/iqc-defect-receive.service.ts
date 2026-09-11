/**
 * @file src/modules/material/services/iqc-defect-receive.service.ts
 * @description IQC 불합격자재 불량창고 수동입고 (요청사항 2026-09-11 06번)
 *
 * 초보자 가이드:
 * 1. IQC FAIL 판정 시 재고는 입하재고(MAT_ARRIVAL_STOCKS)에 그대로 남는다
 *    (SYS_CONFIGS.IQC_FAIL_DEFECT_MOVE_MODE=MANUAL, 기본값). 자동이동(AUTO)은 옵션.
 * 2. 이 서비스가 "입고 대기(FAIL·특채 아님·입하재고 잔량>0)" 목록을 주고, 사용자가 불량창고를 골라 입고하면
 *    IqcHistoryService.moveLotToDefectWarehouse 로 입하재고 → 불량창고(MAT_STOCKS) 이동 + STOCK_TRANSACTIONS
 *    (TRANS_TYPE=MAT_MOVE, REF_TYPE=IQC_DEFECT_RECEIVE) 기록.
 * 3. 취소는 불량창고 재고가 그대로 있을 때만 역이동(REF_TYPE=IQC_DEFECT_RECEIVE_CANCEL, CANCEL_REF_ID=원본).
 * 4. 목록/이력은 QueryBuilder + IN 일괄 조회로 만든다(N+1 금지).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { IqcHistoryService, IQC_DEFECT_RECEIVE_REF_TYPE } from './iqc-history.service';
import { IqcDefectHistoryQueryDto, IqcDefectPendingQueryDto, IqcDefectReceiveCancelDto, IqcDefectReceiveDto } from '../dto/iqc-defect-receive.dto';
import { parseDateEnd, parseDateStart } from '../../../shared/date.util';

export const IQC_DEFECT_RECEIVE_CANCEL_REF_TYPE = 'IQC_DEFECT_RECEIVE_CANCEL';

export interface IqcDefectPendingRow {
  matUid: string;
  arrivalNo: string | null;
  arrivalSeq: number | null;
  itemCode: string;
  itemName: string | null;
  unit: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  qty: number;
  fromWarehouseCode: string;
  recvDate: Date | null;
  judgedAt: Date | null;
  judgeReason: string | null;
  inspectorName: string | null;
}

export interface IqcDefectHistoryRow {
  transNo: string;
  transDate: Date;
  refType: string;
  matUid: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  workerId: string | null;
  remark: string | null;
  /** 이 입고를 취소한 트랜잭션 번호 (있으면 취소됨) */
  canceledBy: string | null;
  cancelRefId: string | null;
}

@Injectable()
export class IqcDefectReceiveService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatArrivalStock)
    private readonly arrivalStockRepository: Repository<MatArrivalStock>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    private readonly iqcHistoryService: IqcHistoryService,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return { ...(company ? { company } : {}), ...(plant ? { plant } : {}) };
  }

  /** 불량창고 입고 대기 목록 — IQC FAIL + 특채 아님 + LOT NORMAL + 입하재고 잔량 > 0 */
  async findPending(query: IqcDefectPendingQueryDto, company?: string, plant?: string): Promise<IqcDefectPendingRow[]> {
    const qb = this.matLotRepository
      .createQueryBuilder('lot')
      .innerJoin(MatArrivalStock, 'ast', 'ast.matUid = lot.matUid AND ast.company = lot.company AND ast.plant = lot.plant')
      .leftJoin(ItemMaster, 'part', 'part.itemCode = lot.itemCode AND part.company = lot.company AND part.plant = lot.plant')
      .leftJoin(PartnerMaster, 'vendor', 'vendor.partnerCode = lot.vendor AND vendor.company = lot.company AND vendor.plant = lot.plant')
      .select('lot.matUid', 'matUid')
      .addSelect('lot.arrivalNo', 'arrivalNo')
      .addSelect('lot.arrivalSeq', 'arrivalSeq')
      .addSelect('lot.itemCode', 'itemCode')
      .addSelect('part.itemName', 'itemName')
      .addSelect('part.unit', 'unit')
      .addSelect('lot.vendor', 'vendorCode')
      .addSelect('vendor.partnerName', 'vendorName')
      .addSelect('ast.qty', 'qty')
      .addSelect('ast.warehouseCode', 'fromWarehouseCode')
      .addSelect('lot.recvDate', 'recvDate')
      .where("lot.iqcStatus = 'FAIL'")
      .andWhere("NVL(lot.specialAcceptYn, 'N') <> 'Y'")
      .andWhere("lot.status = 'NORMAL'")
      .andWhere('ast.qty > 0');
    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    const search = query.search?.trim();
    if (search) {
      qb.andWhere('(lot.matUid = :exact OR lot.arrivalNo = :exact OR lot.itemCode LIKE :like OR lot.matUid LIKE :like OR lot.arrivalNo LIKE :like)', {
        exact: search,
        like: `%${search}%`,
      });
    }
    qb.orderBy('lot.recvDate', 'DESC').addOrderBy('lot.matUid', 'ASC');

    const rows = await qb.getRawMany<Omit<IqcDefectPendingRow, 'judgedAt' | 'judgeReason' | 'inspectorName'>>();
    if (rows.length === 0) return [];

    // 최근 FAIL 판정 로그(입하번호+품목) 일괄 조회 — N+1 금지
    const arrivalNos = Array.from(new Set(rows.map((r) => r.arrivalNo).filter((v): v is string => !!v)));
    const itemCodes = Array.from(new Set(rows.map((r) => r.itemCode)));
    const logs = arrivalNos.length > 0
      ? await this.iqcLogRepository.find({
          where: { arrivalNo: In(arrivalNos), itemCode: In(itemCodes), result: 'FAIL', status: 'DONE', ...this.tenantWhere(company, plant) },
          order: { inspectDate: 'DESC' },
        })
      : [];
    const latestLog = new Map<string, IqcLog>();
    for (const log of logs) {
      const key = `${log.arrivalNo}::${log.itemCode}`;
      if (!latestLog.has(key)) latestLog.set(key, log);
    }
    return rows.map((r) => {
      const log = r.arrivalNo ? latestLog.get(`${r.arrivalNo}::${r.itemCode}`) : undefined;
      return {
        ...r,
        qty: Number(r.qty) || 0,
        judgedAt: log?.inspectDate ?? null,
        judgeReason: log?.aqlJudgeReason ?? log?.remark ?? null,
        inspectorName: log?.inspectorName ?? null,
      };
    });
  }

  /** 바코드(시리얼/입하번호) → 입고 대기 행 해석. 없으면 빈 배열(예외 아님). */
  async lookup(barcode: string, company?: string, plant?: string): Promise<IqcDefectPendingRow[]> {
    const code = (barcode ?? '').trim();
    if (!code) return [];
    const rows = await this.findPending({ search: code }, company, plant);
    return rows.filter((r) => r.matUid === code || r.arrivalNo === code);
  }

  /** 불량창고 입고 실행 — 시리얼별 개별 트랜잭션(하나가 실패해도 나머지는 완료되고 결과에 실패 사유를 담는다) */
  async receive(dto: IqcDefectReceiveDto, company?: string, plant?: string) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { warehouseCode: dto.warehouseCode, ...this.tenantWhere(company, plant) },
    });
    if (!warehouse) throw new NotFoundException(`창고를 찾을 수 없습니다: ${dto.warehouseCode}`);
    if (String(warehouse.warehouseType ?? '').toUpperCase() !== 'DEFECT' || warehouse.useYn !== 'Y') {
      throw new BadRequestException(`불량(DEFECT) 유형의 사용 중인 창고만 선택할 수 있습니다: ${dto.warehouseCode}`);
    }

    const matUids = Array.from(new Set(dto.matUids.map((v) => v.trim()).filter(Boolean)));
    const lots = await this.matLotRepository.find({ where: { matUid: In(matUids), ...this.tenantWhere(company, plant) } });
    const lotByUid = new Map(lots.map((l) => [l.matUid, l]));
    const stocks = await this.arrivalStockRepository.find({ where: { matUid: In(matUids), ...this.tenantWhere(company, plant) } });
    const stockByUid = new Map(stocks.map((s) => [s.matUid, s]));

    const done: Array<{ matUid: string; qty: number; transNo: string }> = [];
    const failed: Array<{ matUid: string; reason: string }> = [];
    for (const matUid of matUids) {
      const lot = lotByUid.get(matUid);
      if (!lot) { failed.push({ matUid, reason: 'LOT을 찾을 수 없습니다.' }); continue; }
      if (lot.iqcStatus !== 'FAIL') { failed.push({ matUid, reason: `IQC 불합격(FAIL) LOT만 불량창고에 입고할 수 있습니다 (현재 ${lot.iqcStatus}).` }); continue; }
      if (lot.specialAcceptYn === 'Y') { failed.push({ matUid, reason: '특채 승인된 LOT은 양품 입고 대상입니다.' }); continue; }
      if (lot.status !== 'NORMAL') { failed.push({ matUid, reason: `LOT 상태가 ${lot.status} 입니다.` }); continue; }
      const stock = stockByUid.get(matUid);
      if (!stock || (stock.qty ?? 0) <= 0) { failed.push({ matUid, reason: '입하재고 잔량이 없습니다(이미 입고·이동됨).' }); continue; }
      try {
        const transNo = await this.iqcHistoryService.moveLotToDefectWarehouse({
          matUid,
          itemCode: lot.itemCode,
          defectWarehouseCode: warehouse.warehouseCode,
          refType: IQC_DEFECT_RECEIVE_REF_TYPE,
          remark: dto.remark?.trim() || 'IQC 불합격자재 불량창고 입고',
          workerId: dto.workerId ?? null,
          company: lot.company,
          plant: lot.plant,
        });
        if (!transNo) { failed.push({ matUid, reason: '이동할 재고를 찾지 못했습니다.' }); continue; }
        done.push({ matUid, qty: Number(stock.qty) || 0, transNo });
      } catch (error: unknown) {
        failed.push({ matUid, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return { warehouseCode: warehouse.warehouseCode, done, failed };
  }

  /** 불량창고 입고 취소 — 불량창고 재고가 그대로 남아 있을 때만 입하재고로 원복 */
  async cancel(dto: IqcDefectReceiveCancelDto, company?: string, plant?: string) {
    const original = await this.stockTransactionRepository.findOne({
      where: { transNo: dto.transNo, refType: IQC_DEFECT_RECEIVE_REF_TYPE, status: 'DONE', ...this.tenantWhere(company, plant) },
    });
    if (!original || !original.matUid || !original.toWarehouseId || !original.fromWarehouseId) {
      throw new NotFoundException(`불량창고 입고 트랜잭션을 찾을 수 없습니다: ${dto.transNo}`);
    }
    const already = await this.stockTransactionRepository.findOne({
      where: { cancelRefId: original.transNo, refType: IQC_DEFECT_RECEIVE_CANCEL_REF_TYPE, ...this.tenantWhere(company, plant) },
    });
    if (already) throw new BadRequestException(`이미 취소된 입고입니다: ${dto.transNo} (취소 ${already.transNo})`);

    const { matUid, itemCode, qty } = original;
    return this.tx.run(async (queryRunner) => {
      const decreased = await queryRunner.manager.createQueryBuilder().update(MatStock)
        .set({ qty: () => '"QTY" - :stockDelta', availableQty: () => '"AVAILABLE_QTY" - :stockDelta' })
        .where({ warehouseCode: original.toWarehouseId, itemCode, matUid, ...this.tenantWhere(original.company, original.plant) })
        .andWhere('"QTY" >= :stockDelta AND "AVAILABLE_QTY" >= :stockDelta')
        .setParameters({ stockDelta: qty }).execute();
      if ((decreased.affected ?? 0) !== 1) {
        throw new BadRequestException(`불량창고 재고가 이미 사용·이동되어 입고를 취소할 수 없습니다. LOT: ${matUid}`);
      }

      const arrivalStock = await queryRunner.manager.findOne(MatArrivalStock, {
        where: { matUid, ...this.tenantWhere(original.company, original.plant) },
      });
      if (arrivalStock) {
        await queryRunner.manager.update(
          MatArrivalStock,
          { company: arrivalStock.company, plant: arrivalStock.plant, matUid },
          { qty: (arrivalStock.qty ?? 0) + qty, availableQty: (arrivalStock.availableQty ?? 0) + qty, status: 'NORMAL' },
        );
      } else {
        await queryRunner.manager.save(MatArrivalStock, {
          company: original.company,
          plant: original.plant,
          matUid,
          itemCode,
          warehouseCode: original.fromWarehouseId,
          qty,
          availableQty: qty,
          status: 'NORMAL',
        });
      }

      const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');
      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_MOVE',
        transDate: new Date(),
        fromWarehouseId: original.toWarehouseId,
        toWarehouseId: original.fromWarehouseId,
        itemCode,
        matUid,
        qty,
        refType: IQC_DEFECT_RECEIVE_CANCEL_REF_TYPE,
        cancelRefId: original.transNo,
        remark: dto.remark?.trim() || '불량창고 입고 취소 (입하재고 원복)',
        status: 'DONE',
        company: original.company,
        plant: original.plant,
      });
      return { transNo, canceledTransNo: original.transNo, matUid, qty };
    });
  }

  /** 불량창고 입고/취소 이력 (자동이동 IQC_FAIL 포함) */
  async findHistory(query: IqcDefectHistoryQueryDto, company?: string, plant?: string): Promise<IqcDefectHistoryRow[]> {
    const qb = this.stockTransactionRepository
      .createQueryBuilder('tx')
      .leftJoin(ItemMaster, 'part', 'part.itemCode = tx.itemCode AND part.company = tx.company AND part.plant = tx.plant')
      .select('tx.transNo', 'transNo')
      .addSelect('tx.transDate', 'transDate')
      .addSelect('tx.refType', 'refType')
      .addSelect('tx.matUid', 'matUid')
      .addSelect('tx.itemCode', 'itemCode')
      .addSelect('part.itemName', 'itemName')
      .addSelect('tx.qty', 'qty')
      .addSelect('tx.fromWarehouseId', 'fromWarehouseId')
      .addSelect('tx.toWarehouseId', 'toWarehouseId')
      .addSelect('tx.workerId', 'workerId')
      .addSelect('tx.remark', 'remark')
      .addSelect('tx.cancelRefId', 'cancelRefId')
      .where('tx.refType IN (:...refTypes)', {
        refTypes: [IQC_DEFECT_RECEIVE_REF_TYPE, IQC_DEFECT_RECEIVE_CANCEL_REF_TYPE, 'IQC_FAIL', 'IQC_FAIL_CANCEL'],
      })
      .andWhere("tx.status = 'DONE'");
    if (company) qb.andWhere('tx.company = :company', { company });
    if (plant) qb.andWhere('tx.plant = :plant', { plant });
    const from = query.fromDate ? parseDateStart(query.fromDate) : null;
    const to = query.toDate ? parseDateEnd(query.toDate) : null;
    if (from) qb.andWhere('tx.transDate >= :from', { from });
    if (to) qb.andWhere('tx.transDate <= :to', { to });
    const search = query.search?.trim();
    if (search) {
      qb.andWhere('(tx.matUid LIKE :like OR tx.itemCode LIKE :like OR tx.transNo LIKE :like)', { like: `%${search}%` });
    }
    qb.orderBy('tx.transDate', 'DESC').addOrderBy('tx.transNo', 'DESC');
    const rows = await qb.getRawMany<Omit<IqcDefectHistoryRow, 'canceledBy'>>();
    if (rows.length === 0) return [];

    const transNos = rows.map((r) => r.transNo);
    const cancels = await this.stockTransactionRepository.find({
      where: { cancelRefId: In(transNos), ...this.tenantWhere(company, plant) },
      select: ['transNo', 'cancelRefId'],
    });
    const canceledBy = new Map(cancels.map((c) => [c.cancelRefId as string, c.transNo]));
    return rows.map((r) => ({ ...r, qty: Number(r.qty) || 0, canceledBy: canceledBy.get(r.transNo) ?? null }));
  }
}
