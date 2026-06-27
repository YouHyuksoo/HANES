/**
 * @file src/modules/material/services/mat-issue.service.ts
 * @description 자재출고 비즈니스 로직 서비스(TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In } from 'typeorm';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { CreateMatIssueDto, MatIssueQueryDto } from '../dto/mat-issue.dto';
import { ScanIssueDto } from '../dto/scan-issue.dto';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { ProcMatStockService } from '../../inventory/services/proc-mat-stock.service';

@Injectable()
export class MatIssueService {
  constructor(
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
    private readonly procMatStockService: ProcMatStockService,
  ) {}

  private sortStocksForIssue(stocks: MatStock[], warehouseCode?: string) {
    return [...stocks].sort((a, b) => {
      if (warehouseCode) {
        if (a.warehouseCode === warehouseCode && b.warehouseCode !== warehouseCode) return -1;
        if (a.warehouseCode !== warehouseCode && b.warehouseCode === warehouseCode) return 1;
      }
      return a.warehouseCode.localeCompare(b.warehouseCode);
    });
  }

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    label: string,
    actual: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && actual.company !== company) {
      throw new BadRequestException(`${label}의 회사가 요청 회사와 다릅니다.`);
    }
    if (plant && actual.plant !== plant) {
      throw new BadRequestException(`${label}의 공장이 요청 공장과 다릅니다.`);
    }
  }

  private async flattenIssue(issue: MatIssue, company?: string, plant?: string) {
    if (!issue) return null;
    const tenantWhere = this.tenantWhere(company ?? issue.company, plant ?? issue.plant);

    const lot = issue.matUid
      ? await this.matLotRepository.findOne({ where: { matUid: issue.matUid, ...tenantWhere } })
      : null;
    const part = lot?.itemCode
      ? await this.itemMasterRepository.findOne({ where: { itemCode: lot.itemCode, ...tenantWhere } })
      : null;
    const jobOrder = issue.orderNo
      ? await this.jobOrderRepository.findOne({ where: { orderNo: issue.orderNo, ...tenantWhere } })
      : null;

    return {
      ...issue,
      matUid: issue.matUid,
      itemCode: part?.itemCode ?? null,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
      jobOrderNo: jobOrder?.orderNo ?? null,
    };
  }

  async findAll(query: MatIssueQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, orderNo, matUid, issueType, issueDateFrom, issueDateTo, status } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(orderNo && { orderNo }),
      ...(matUid && { matUid }),
      ...(issueType && { issueType }),
      ...(status && { status }),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (issueDateFrom && issueDateTo) {
      where.issueDate = Between(parseDateStart(issueDateFrom)!, parseDateEnd(issueDateTo)!);
    } else if (issueDateFrom) {
      where.issueDate = Between(parseDateStart(issueDateFrom)!, new Date());
    } else if (issueDateTo) {
      where.issueDate = Between(parseDateStart('1900-01-01')!, parseDateEnd(issueDateTo)!);
    }

    const [data, total] = await Promise.all([
      this.matIssueRepository.find({
        where,
        skip,
        take: limit,
        order: { issueDate: 'DESC' },
      }),
      this.matIssueRepository.count({ where }),
    ]);

    const matUids = [...new Set(data.map((i) => i.matUid).filter(Boolean))];
    const orderNos = [...new Set(data.map((i) => i.orderNo).filter(Boolean))];
    const tenantWhere = this.tenantWhere(company, plant);

    const [lots, jobOrders] = await Promise.all([
      matUids.length > 0
        ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } })
        : Promise.resolve([]),
      orderNos.length > 0
        ? this.jobOrderRepository.find({ where: { orderNo: In(orderNos), ...tenantWhere } })
        : Promise.resolve([]),
    ]);

    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const jobOrderMap = new Map(jobOrders.map((j) => [j.orderNo, j]));

    const lotItemCodes = [...new Set(lots.map((l) => l.itemCode).filter(Boolean))];
    const parts = lotItemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(lotItemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const flattenedData = data.map((issue) => {
      const lot = issue.matUid ? lotMap.get(issue.matUid) : null;
      const part = lot?.itemCode ? partMap.get(lot.itemCode) : null;
      const jobOrder = issue.orderNo ? jobOrderMap.get(issue.orderNo) : null;
      return {
        ...issue,
        matUid: issue.matUid,
        itemCode: part?.itemCode ?? null,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        jobOrderNo: jobOrder?.orderNo ?? null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async findById(issueNo: string, seq: number, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const issue = await this.matIssueRepository.findOne({ where: { issueNo, seq, ...tenantWhere } });

    if (!issue) throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${issueNo}-${seq}`);
    return this.flattenIssue(issue, company, plant);
  }

  async create(dto: CreateMatIssueDto, company?: string, plant?: string) {
    return this.tx.run((queryRunner) => this.createInTx(queryRunner, dto, company, plant));
  }

  async createInTx(queryRunner: import('typeorm').QueryRunner, dto: CreateMatIssueDto, company?: string, plant?: string) {
    const { orderNo, prodResultNo, warehouseCode, issueType, items, remark, workerId } = dto;
    const results = [];
    const issueNo = await this.numbering.nextInTx(queryRunner, 'MAT_ISSUE');
    let seqCounter = 1;
    const tenantWhere = this.tenantWhere(company, plant);

    // 출고 시 processCode가 지정되면 원자재창고 → 공정재고(PROC_MAT_STOCKS=장착 대기)로 이동한다(ADR 0002).
    // 설비는 출고 시점에 정하지 않는다(설비 장착은 별도 단계). processCode가 없으면 단순 출고(MAT_OUT) 유지.
    const processCode = dto.processCode ?? null;
    const isMove = !!processCode;

    for (const item of items) {
      const lot = await queryRunner.manager.findOne(MatLot, {
        where: { matUid: item.matUid, ...tenantWhere },
      });

      if (!lot) {
        throw new BadRequestException(`LOT를 찾을 수 없습니다: ${item.matUid}`);
      }
      this.assertSameTenant('출고 LOT', lot, company, plant);

      if (lot.iqcStatus !== 'PASS') {
        throw new BadRequestException(`IQC 합격 상태가 아닌 LOT입니다: ${lot.matUid}`);
      }

      if (lot.status === 'HOLD') {
        throw new BadRequestException(`보류 상태의 LOT는 출고할 수 없습니다: ${lot.matUid}`);
      }

      const stockRows = await queryRunner.manager.find(MatStock, {
        where: warehouseCode
          ? { matUid: lot.matUid, warehouseCode, ...tenantWhere }
          : { matUid: lot.matUid, ...tenantWhere },
      });
      stockRows.forEach((stock) => this.assertSameTenant('출고 대상 재고', stock, lot.company, lot.plant));
      const stockQty = stockRows.reduce((sum, stock) => sum + (stock.availableQty ?? stock.qty ?? 0), 0);

      if (stockQty < item.issueQty) {
        throw new BadRequestException(`LOT 재고 부족: ${lot.matUid} (현재 ${stockQty}, 요청 ${item.issueQty})`);
      }

      const currentSeq = seqCounter++;
      const issue = queryRunner.manager.create(MatIssue, {
        issueNo,
        seq: currentSeq,
        orderNo,
        prodResultNo: prodResultNo || null,
        matUid: item.matUid,
        issueQty: item.issueQty,
        issueType,
        workerId,
        remark,
        status: 'DONE',
        company: lot.company,
        plant: lot.plant,
      });
      const savedIssue = await queryRunner.manager.save(issue);

      let remainingQty = item.issueQty;
      for (const stock of this.sortStocksForIssue(stockRows, warehouseCode)) {
        if (remainingQty <= 0) break;

        const availableQty = stock.availableQty ?? stock.qty ?? 0;
        if (availableQty <= 0) continue;

        const issueQty = Math.min(remainingQty, availableQty);
        const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: isMove ? 'PROC_MOVE' : 'MAT_OUT',
          fromWarehouseId: stock.warehouseCode,
          toWarehouseId: null,
          itemCode: lot.itemCode,
          matUid: item.matUid,
          qty: -issueQty,
          remark: remark || (isMove ? `공정입고: ${lot.matUid}` : `자재출고: ${lot.matUid}`),
          workerId,
          refType: 'MAT_ISSUE',
          refId: `${savedIssue.issueNo}-${savedIssue.seq}`,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
        });
        await queryRunner.manager.save(stockTx);

        // 원자재창고 차감(기존 유지)
        await queryRunner.manager.update(
          MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...tenantWhere },
          {
            qty: Math.max(0, stock.qty - issueQty),
            availableQty: Math.max(0, stock.availableQty - issueQty),
          },
        );

        // 이동이면 공정 단위 공정재고(PROC_MAT_STOCKS=장착 대기)에 동량 가산
        if (isMove && processCode) {
          await this.procMatStockService.addStockInTx(queryRunner, {
            processCode,
            itemCode: stock.itemCode,
            matUid: item.matUid,
            qty: issueQty,
            transType: 'PROC_IN',
            fromWarehouseId: stock.warehouseCode,
            orderNo: orderNo ?? null,
            refType: 'MAT_ISSUE',
            refId: `${savedIssue.issueNo}-${savedIssue.seq}`,
            workerId,
            company: lot.company,
            plant: lot.plant,
          });
        }

        remainingQty -= issueQty;
      }

      const remainingStocks = await queryRunner.manager.find(MatStock, {
        where: { matUid: lot.matUid, ...tenantWhere },
      });
      remainingStocks.forEach((stock) => this.assertSameTenant('출고 후 잔여 재고', stock, lot.company, lot.plant));
      const totalRemainingQty = remainingStocks.reduce((sum, stock) => sum + (stock.qty ?? 0), 0);

      // MAT_LOTS.currentQty 정합 — 출고분만큼 LOT 잔량 차감(창고에서 LOT이 나감).
      // MAT_STOCKS(창고별 재고)와 MAT_LOTS(LOT 총 잔량)는 다른 차원이라 둘 다 차감이 정상(이중 관리 아님).
      await queryRunner.manager.update(
        MatLot,
        { matUid: lot.matUid, ...tenantWhere },
        { currentQty: Math.max(0, (lot.currentQty ?? 0) - item.issueQty) },
      );

      if (totalRemainingQty <= 0) {
        await queryRunner.manager.update(MatLot, { matUid: lot.matUid, ...tenantWhere }, { status: 'DEPLETED' });
      }

      results.push(await this.flattenIssue(savedIssue, company, plant));
    }

    return results;
  }

  async scanIssue(dto: ScanIssueDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const lot = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid, ...tenantWhere },
    });
    if (!lot) {
      throw new BadRequestException(`LOT를 찾을 수 없습니다: ${dto.matUid}`);
    }
    if (lot.iqcStatus !== 'PASS') {
      throw new BadRequestException(
        `IQC 미합격 LOT입니다: ${dto.matUid} (상태: ${lot.iqcStatus})`,
      );
    }
    if (lot.status === 'HOLD') {
      throw new BadRequestException(
        `보류 상태의 LOT는 출고할 수 없습니다: ${dto.matUid}`,
      );
    }

    const stocks = await this.matStockRepository.find({
      where: dto.warehouseCode
        ? { matUid: dto.matUid, warehouseCode: dto.warehouseCode, ...tenantWhere }
        : { matUid: dto.matUid, ...tenantWhere },
    });
    const stockQty = stocks.reduce((sum, stock) => sum + (stock.availableQty ?? stock.qty ?? 0), 0);

    if (lot.status === 'DEPLETED' || stockQty <= 0) {
      throw new BadRequestException(`이미 소진된 LOT입니다: ${dto.matUid}`);
    }

    const result = await this.create({
      warehouseCode: dto.warehouseCode,
      issueType: dto.issueType,
      items: [{ matUid: lot.matUid, issueQty: stockQty }],
      workerId: dto.workerId,
      remark: dto.remark ?? `바코드 스캔 출고: ${dto.matUid}`,
    }, company, plant);

    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: lot.itemCode, ...tenantWhere },
    });

    return {
      ...result[0],
      matUid: lot.matUid,
      issuedQty: stockQty,
      itemCode: lot.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
    };
  }

  async cancel(issueNo: string, seq: number, reason?: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const rawIssue = await this.matIssueRepository.findOne({ where: { issueNo, seq, ...tenantWhere } });
    if (!rawIssue) {
      throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${issueNo}-${seq}`);
    }
    this.assertSameTenant('자재출고 이력', rawIssue, company, plant);

    if (rawIssue.status !== 'DONE') {
      throw new BadRequestException('이미 취소된 출고입니다.');
    }

    await this.ensureNoDownstreamProgress(rawIssue, company, plant);

    return this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(MatIssue, { issueNo, seq, ...tenantWhere }, { status: 'CANCELED', remark: reason });

      const refId = `${issueNo}-${seq}`;
      const originalTxs = await queryRunner.manager.find(StockTransaction, {
        where: { refType: 'MAT_ISSUE', refId, status: 'DONE', ...tenantWhere },
      });

      // 원본에 WIP_MOVE(공정이동)가 하나라도 있으면 공정재고(WIP_MAT_STOCKS)도 대칭 복원한다.
      let hasMove = false;

      for (const originalTx of originalTxs) {
        this.assertSameTenant('원본 재고거래', originalTx, company, plant);

        const restoreQty = Math.abs(originalTx.qty);
        const isMove = originalTx.transType === 'PROC_MOVE';
        if (isMove) hasMove = true;
        const cancelTransNo = await this.numbering.nextInTx(queryRunner, 'CANCEL_TX');

        // 원자재측 역분개 거래(STOCK_TRANSACTIONS): 원자재창고로 복원한다.
        // 공정재고(PROC_MAT_STOCKS) 차감은 아래 restoreInTx 가 전담한다.
        const cancelTx = queryRunner.manager.create(StockTransaction, {
          transNo: cancelTransNo,
          transType: isMove ? 'PROC_MOVE_CANCEL' : 'MAT_OUT_CANCEL',
          fromWarehouseId: originalTx.fromWarehouseId,
          toWarehouseId: originalTx.fromWarehouseId,
          itemCode: originalTx.itemCode,
          matUid: originalTx.matUid,
          qty: restoreQty,
          remark: reason || `출고취소 재고복구 ${originalTx.transNo}`,
          refType: 'MAT_ISSUE_CANCEL',
          refId,
          cancelRefId: originalTx.transNo,
          status: 'DONE',
          company: originalTx.company,
          plant: originalTx.plant,
        });
        await queryRunner.manager.save(cancelTx);
        await queryRunner.manager.update(
          StockTransaction,
          {
            transNo: originalTx.transNo,
            ...(originalTx.company ? { company: originalTx.company } : {}),
            ...(originalTx.plant ? { plant: originalTx.plant } : {}),
          },
          { status: 'CANCELED' },
        );

        // 원자재창고(원본 fromWarehouseId)에 복원(가산)한다 - 이동/단순출고 공통.
        const stock = originalTx.matUid && originalTx.fromWarehouseId
          ? await queryRunner.manager.findOne(MatStock, {
              where: {
                warehouseCode: originalTx.fromWarehouseId,
                itemCode: originalTx.itemCode,
                matUid: originalTx.matUid,
                ...tenantWhere,
              },
            })
          : null;

        if (stock) {
          this.assertSameTenant('복구 대상 재고', stock, originalTx.company, originalTx.plant);
          await queryRunner.manager.update(
            MatStock,
            { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...tenantWhere },
            {
              qty: stock.qty + restoreQty,
              availableQty: stock.availableQty + restoreQty,
            },
          );
        } else if (originalTx.matUid && originalTx.fromWarehouseId) {
          await queryRunner.manager.save(
            MatStock,
            queryRunner.manager.create(MatStock, {
              warehouseCode: originalTx.fromWarehouseId,
              itemCode: originalTx.itemCode,
              matUid: originalTx.matUid,
              qty: restoreQty,
              reservedQty: 0,
              availableQty: restoreQty,
              company: originalTx.company,
              plant: originalTx.plant,
            }),
          );
        }
      }

      // 공정입고(PROC_MOVE) 출고였다면 공정재고(PROC_MAT_STOCKS)도 대칭 차감 복원한다.
      // 원본 PROC_IN 거래(PROC_MAT_TRANSACTIONS)를 찾아 DEDUCT_BACK + PROC_IN_CANCEL 기록.
      if (hasMove) {
        await this.procMatStockService.restoreInTx(queryRunner, {
          mode: 'DEDUCT_BACK',
          refType: 'MAT_ISSUE',
          refId,
          cancelTransType: 'PROC_IN_CANCEL',
          originTransType: 'PROC_IN',
          orderNo: rawIssue.orderNo ?? null,
          remark: reason ?? null,
          company: rawIssue.company,
          plant: rawIssue.plant,
        });
      }

      if (rawIssue.matUid) {
        // 출고 취소 — LOT 잔량(currentQty)도 출고량만큼 복원(createInTx 차감의 대칭).
        const lotRow = await queryRunner.manager.findOne(MatLot, { where: { matUid: rawIssue.matUid, ...tenantWhere } });
        await queryRunner.manager.update(
          MatLot,
          { matUid: rawIssue.matUid, ...tenantWhere },
          { status: 'NORMAL', currentQty: (lotRow?.currentQty ?? 0) + rawIssue.issueQty },
        );
      }

      return { issueNo, seq, status: 'CANCELED' };
    });
  }

  private async ensureNoDownstreamProgress(issue: MatIssue, company?: string, plant?: string) {
    const prodResultRepo = this.dataSource.getRepository(ProdResult);
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);
    const tenantWhere = this.tenantWhere(company ?? issue.company, plant ?? issue.plant);

    let prodResult: ProdResult | null = null;

    if (issue.prodResultNo) {
      prodResult = await prodResultRepo.findOne({
        where: { resultNo: issue.prodResultNo, ...tenantWhere },
      });
    } else if (issue.orderNo && ['PROD', 'PRODUCTION', 'PROD_AUTO'].includes(issue.issueType)) {
      prodResult = await prodResultRepo.findOne({
        where: { orderNo: issue.orderNo, status: In(['RUNNING', 'DONE']), ...tenantWhere },
        order: { createdAt: 'DESC' },
      });
    }

    if (!prodResult || prodResult.status === 'CANCELED') {
      return;
    }

    const blockers = [`생산실적=${prodResult.resultNo}(${prodResult.status})`];

    if (prodResult.prdUid) {
      const fgLabel = await fgLabelRepo.findOne({
        where: { fgBarcode: prodResult.prdUid },
      });
      if (fgLabel) {
        blockers.push(`FG=${fgLabel.fgBarcode}(${fgLabel.status})`);
      }
    }

    throw new BadRequestException(
      `자재출고 ${issue.issueNo}-${issue.seq} 는 뒤 공정이 이미 진행되어 취소할 수 없습니다. ` +
        `현재 상태: ${blockers.join(', ')}. ` +
        `출하 -> 팔레트 -> 박스/OQC -> FG 라벨 -> 생산실적 순서로 역처리 후 다시 자재출고를 취소해 주세요.`,
    );
  }
}
