/**
 * @file src/modules/material/services/receipt-cancel.service.ts
 * @description 입고취소 비즈니스 로직 - StockTransaction 역분개 처리 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Between, In, Like, FindOptionsWhere } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { CreateReceiptCancelDto, ReceiptCancelQueryDto } from '../dto/receipt-cancel.dto';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class ReceiptCancelService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    row: { company?: string | null; plant?: string | null } | null | undefined,
    expectedCompany?: string | null,
    expectedPlant?: string | null,
    label = '데이터',
  ) {
    if (expectedCompany && row?.company !== expectedCompany) {
      throw new BadRequestException(`${label}의 회사 정보가 요청 회사와 일치하지 않습니다.`);
    }
    if (expectedPlant && row?.plant !== expectedPlant) {
      throw new BadRequestException(`${label}의 공장 정보가 요청 공장과 일치하지 않습니다.`);
    }
  }

  async findCancellable(query: ReceiptCancelQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const baseWhere: FindOptionsWhere<StockTransaction> = {
      // 입고 트랜잭션은 STOCK_TRANSACTIONS에 transType='RECEIVE'로 기록된다(receiving.service).
      transType: 'RECEIVE',
      cancelRefId: IsNull(),
      ...(company && { company }),
      ...(plant && { plant }),
      ...(fromDate && toDate ? { transDate: Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!) } : {}),
    };

    // 검색: 거래번호 / 품목코드 / 시리얼(LOT) 기준 OR (품목명은 enrich 전 단계라 코드 기준으로 한정)
    const keyword = search?.trim();
    const where: FindOptionsWhere<StockTransaction> | FindOptionsWhere<StockTransaction>[] = keyword
      ? [
          { ...baseWhere, transNo: Like(`%${keyword}%`) },
          { ...baseWhere, itemCode: Like(`%${keyword}%`) },
          { ...baseWhere, matUid: Like(`%${keyword}%`) },
        ]
      : baseWhere;

    const [data, total] = await Promise.all([
      this.stockTransactionRepository.find({
        where,
        skip,
        take: limit,
        order: { transDate: 'DESC' },
      }),
      this.stockTransactionRepository.count({ where }),
    ]);

    // 표시용 enrichment (품목명/단위/창고명/공급사). raw 트랜잭션엔 코드만 있어 화면 컬럼이 비므로 보강한다.
    const tenantWhere = this.tenantWhere(company, plant);
    const itemCodes = [...new Set(data.map((t) => t.itemCode).filter(Boolean))];
    const matUids = [...new Set(data.map((t) => t.matUid).filter((v): v is string => !!v))];
    const warehouseCodes = [...new Set(data.map((t) => t.toWarehouseId).filter((v): v is string => !!v))];

    const [parts, lots, warehouses] = await Promise.all([
      itemCodes.length > 0 ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
      warehouseCodes.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes), ...tenantWhere } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w.warehouseName]));

    // 공급사 업체명 (MAT_LOTS.VENDOR → PARTNER_MASTERS.PARTNER_NAME)
    const vendorCodes = [...new Set(lots.map((l) => l.vendor).filter((v): v is string => !!v))];
    const partners = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({ where: { partnerCode: In(vendorCodes), ...tenantWhere } })
      : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    const enriched = data.map((tx) => {
      const part = partMap.get(tx.itemCode);
      const lot = tx.matUid ? lotMap.get(tx.matUid) : null;
      const vendor = lot?.vendor ?? null;
      return {
        ...tx,
        // 프론트가 취소 API 키로 사용하는 id (= 자연키 TRANS_NO). 누락 시 취소 동작 불가.
        id: tx.transNo,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        warehouseName: tx.toWarehouseId ? (warehouseMap.get(tx.toWarehouseId) ?? tx.toWarehouseId) : null,
        vendor,
        vendorName: vendor ? (partnerMap.get(vendor) ?? vendor) : null,
      };
    });

    return { data: enriched, total, page, limit };
  }

  async cancel(dto: CreateReceiptCancelDto, company?: string, plant?: string) {
    const { transactionId, reason, workerId } = dto;
    return this.tx.run(async (queryRunner) => {
      // 원본 트랜잭션 조회
      const originalTransaction = await queryRunner.manager.findOne(StockTransaction, {
        where: { transNo: transactionId, ...this.tenantWhere(company, plant) },
      });

      if (!originalTransaction) {
        throw new NotFoundException(`입고 트랜잭션을 찾을 수 없습니다: ${transactionId}`);
      }

      if (originalTransaction.cancelRefId) {
        throw new BadRequestException('이미 취소된 트랜잭션입니다.');
      }

      if (originalTransaction.transType !== 'RECEIVE') {
        throw new BadRequestException('입고 트랜잭션만 취소할 수 있습니다.');
      }

      this.assertSameTenant(originalTransaction, company, plant, '원본 입고 거래');

      await this.ensureNoDownstreamProgress(originalTransaction);

      const { itemCode, matUid, toWarehouseId, qty } = originalTransaction;
      const txTenantWhere = this.tenantWhere(originalTransaction.company, originalTransaction.plant);

      if (!toWarehouseId) {
        throw new BadRequestException('입고 창고 정보가 없습니다.');
      }

      // 재고 확인 및 차감
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode: toWarehouseId, matUid: matUid ?? IsNull(), ...txTenantWhere },
      });

      if (!stock || stock.qty < qty) {
        throw new BadRequestException(`취소할 재고가 부족합니다. 현재 재고: ${stock?.qty ?? 0}`);
      }
      this.assertSameTenant(stock, originalTransaction.company, originalTransaction.plant, '입고취소 대상 재고');

      // 재고 차감
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...txTenantWhere },
        { qty: stock.qty - qty, availableQty: stock.availableQty - qty },
      );

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리
      // NOTE: PO 입고수량(PURCHASE_ORDER_ITEMS.receivedQty)은 입하(arrival) 단계에서만 가감한다.
      //       입고(RECEIVE)는 PO receivedQty를 변경하지 않으므로 입고취소도 건드리지 않는다(이중 차감 방지).

      // 역분개 트랜잭션 생성
      const cancelTransNo = await this.numbering.nextInTx(queryRunner, 'CANCEL_TX');
      const cancelTransaction = queryRunner.manager.create(StockTransaction, {
        transNo: cancelTransNo,
        transType: 'RECEIPT_CANCEL',
        transDate: new Date(),
        fromWarehouseId: toWarehouseId,
        itemCode,
        matUid,
        qty: -qty,
        refType: 'TRANSACTION',
        refId: originalTransaction.transNo,
        workerId,
        remark: reason,
        company: originalTransaction.company,
        plant: originalTransaction.plant,
      });

      const savedCancelTrans = await queryRunner.manager.save(cancelTransaction);

      // 원본 트랜잭션에 취소 참조 설정 + 상태 CANCELED.
      // status='CANCELED'로 바꿔야 receiving.service의 기입고수량 SUM(transType='RECEIVE' AND status='DONE')에서
      // 제외되어 LOT의 잔여 입고수량이 정상 복구된다(미변경 시 취소해도 재입고가 막힘).
      await queryRunner.manager.update(StockTransaction, { transNo: originalTransaction.transNo, ...txTenantWhere }, {
        cancelRefId: savedCancelTrans.transNo,
        status: 'CANCELED',
      });
      await this.markReceivingCanceled(queryRunner, originalTransaction, txTenantWhere);

      return {
        transNo: savedCancelTrans.transNo,
        transactionId,
        cancelled: true,
        cancelTransNo: savedCancelTrans.transNo,
      };
    });
  }

  private async markReceivingCanceled(
    queryRunner: import('typeorm').QueryRunner,
    originalTransaction: StockTransaction,
    txTenantWhere: ReturnType<ReceiptCancelService['tenantWhere']>,
  ) {
    if (!['RECEIVE', 'RECEIVE_CONCESSION'].includes(originalTransaction.refType ?? '')) {
      return;
    }

    const refMatch = (originalTransaction.refId ?? '').match(/^(.+)-(\d+)$/);
    if (!refMatch) {
      return;
    }

    await queryRunner.manager.update(
      MatReceiving,
      { receiveNo: refMatch[1], seq: Number(refMatch[2]), ...txTenantWhere },
      { status: 'CANCELED' },
    );
  }

  private async ensureNoDownstreamProgress(originalTransaction: StockTransaction) {
    if (!originalTransaction.matUid) {
      return;
    }

    const matIssueRepo = this.dataSource.getRepository(MatIssue);
    const prodResultRepo = this.dataSource.getRepository(ProdResult);
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);

    const latestIssue = await matIssueRepo.findOne({
      where: {
        matUid: originalTransaction.matUid,
        status: 'DONE',
        ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
      },
      order: { issueDate: 'DESC' },
    });

    if (!latestIssue) {
      return;
    }

    const blockers = [`자재출고=${latestIssue.issueNo}-${latestIssue.seq}`];
    let prodResult: ProdResult | null = null;

    if (latestIssue.prodResultNo) {
      prodResult = await prodResultRepo.findOne({
        where: {
          resultNo: latestIssue.prodResultNo,
          ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
        },
      });
    } else if (latestIssue.orderNo) {
      prodResult = await prodResultRepo.findOne({
        where: {
          orderNo: latestIssue.orderNo,
          status: In(['RUNNING', 'DONE']),
          ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
        },
        order: { createdAt: 'DESC' },
      });
    }

    if (prodResult && prodResult.status !== 'CANCELED') {
      blockers.push(`생산실적=${prodResult.resultNo}(${prodResult.status})`);

      if (prodResult.prdUid) {
        const fgLabel = await fgLabelRepo.findOne({
          where: {
            fgBarcode: prodResult.prdUid,
            ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
          },
        });
        if (fgLabel) {
          blockers.push(`FG=${fgLabel.fgBarcode}(${fgLabel.status})`);
        }
      }
    }

    throw new BadRequestException(
      `입고취소 ${originalTransaction.transNo} 는 뒤 공정이 이미 진행되어 처리할 수 없습니다. ` +
        `현재 상태: ${blockers.join(', ')}. ` +
        `출하 -> 팔레트 -> 박스/OQC -> FG 라벨 -> 생산실적 -> 자재출고 순서로 역처리 후 다시 입고취소를 진행해 주세요.`,
    );
  }
}
