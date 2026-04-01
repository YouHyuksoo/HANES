/**
 * @file services/erp-material.service.ts
 * @description G12: 자재 관련 ERP 양방향 인터페이스 서비스
 *
 * 초보자 가이드:
 * 1. **ERP → MES (Inbound)**: PO 정보 수신 → PurchaseOrder/PurchaseOrderItem upsert
 * 2. **MES → ERP (Outbound)**: 입고/반품/출고/보정 실적 전송
 * 3. 모든 인터페이스 이벤트는 InterLog에 기록
 * 4. 실패 시 최대 3회 재시도, 3회 실패 시 FAILED 상태
 * 5. ERP 전송 실패가 MES 트랜잭션을 롤백하지 않음 (eventual consistency)
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InterLog } from '../../../entities/inter-log.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { SysConfigService } from '../../system/services/sys-config.service';

/** ERP PO 수신 데이터 구조 */
interface ErpPoData {
  poNo: string;
  orderDate: string;
  partnerId: string;
  partnerName: string;
  items: {
    seq: number;
    itemCode: string;
    itemName: string;
    orderQty: number;
    unit: string;
    deliveryDate?: string;
  }[];
  company?: string;
  plant?: string;
}

/** MES → ERP 실적 전송 데이터 구조 */
interface ErpExportData {
  messageType: 'RECEIVING' | 'RETURN' | 'ISSUE' | 'ADJUSTMENT';
  refNo: string;
  itemCode: string;
  qty: number;
  date: string;
  poNo?: string;
  reason?: string;
  company?: string;
  plant?: string;
}

@Injectable()
export class ErpMaterialService {
  private readonly logger = new Logger(ErpMaterialService.name);

  constructor(
    @InjectRepository(InterLog)
    private readonly interLogRepo: Repository<InterLog>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepo: Repository<PurchaseOrderItem>,
    private readonly dataSource: DataSource,
    private readonly sysConfigService: SysConfigService,
  ) {}

  // ==========================================================================
  // ERP → MES: PO 정보 수신 (Inbound)
  // ==========================================================================

  /** ERP에서 PO 데이터를 수신하여 PurchaseOrder/PurchaseOrderItem에 upsert */
  async importPurchaseOrder(data: ErpPoData) {
    const transDate = new Date();
    const seq = await this.getNextSeq(transDate);

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        // PO upsert
        let po = await queryRunner.manager.findOne(PurchaseOrder, { where: { poNo: data.poNo } });
        if (po) {
          await queryRunner.manager.update(PurchaseOrder, { poNo: data.poNo }, {
            orderDate: new Date(data.orderDate),
            partnerId: data.partnerId,
            partnerName: data.partnerName,
          });
        } else {
          po = queryRunner.manager.create(PurchaseOrder, {
            poNo: data.poNo,
            orderDate: new Date(data.orderDate),
            partnerId: data.partnerId,
            partnerName: data.partnerName,
            status: 'CONFIRMED',
            company: data.company,
            plant: data.plant,
          });
          await queryRunner.manager.save(po);
        }

        // PO Items upsert
        for (const item of data.items) {
          const existing = await queryRunner.manager.findOne(PurchaseOrderItem, {
            where: { poNo: data.poNo, seq: item.seq },
          });
          if (existing) {
            await queryRunner.manager.update(PurchaseOrderItem,
              { poNo: data.poNo, seq: item.seq },
              { orderQty: item.orderQty },
            );
          } else {
            await queryRunner.manager.save(PurchaseOrderItem, {
              poNo: data.poNo,
              seq: item.seq,
              itemCode: item.itemCode,
              itemName: item.itemName,
              orderQty: item.orderQty,
              receivedQty: 0,
              company: data.company,
              plant: data.plant,
            });
          }
        }

        await queryRunner.commitTransaction();
      } catch (error: unknown) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

      // 성공 로그
      await this.logInterface(transDate, seq, 'INBOUND', 'ERP_PO_IMPORT', 'SUCCESS', data.poNo, JSON.stringify(data));
      return { success: true, poNo: data.poNo };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logInterface(transDate, seq, 'INBOUND', 'ERP_PO_IMPORT', 'FAILED', data.poNo, JSON.stringify(data), errMsg);
      throw error;
    }
  }

  /** ERP PO 일괄 동기화 (배치용) */
  async syncPurchaseOrders(poList: ErpPoData[]) {
    const results = [];
    for (const po of poList) {
      try {
        const result = await this.importPurchaseOrder(po);
        results.push(result);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        results.push({ success: false, poNo: po.poNo, error: errMsg });
      }
    }
    return results;
  }

  // ==========================================================================
  // MES → ERP: 실적 전송 (Outbound)
  // ==========================================================================

  /** 입고 실적 ERP 전송 */
  async exportReceiving(refNo: string, itemCode: string, qty: number, poNo: string, company?: string, plant?: string) {
    return this.exportToErp({
      messageType: 'RECEIVING',
      refNo, itemCode, qty,
      date: new Date().toISOString().slice(0, 10),
      poNo, company, plant,
    });
  }

  /** 반품 실적 ERP 전송 */
  async exportReturn(refNo: string, itemCode: string, qty: number, reason: string, company?: string, plant?: string) {
    return this.exportToErp({
      messageType: 'RETURN',
      refNo, itemCode, qty,
      date: new Date().toISOString().slice(0, 10),
      reason, company, plant,
    });
  }

  /** 기타출고 실적 ERP 전송 */
  async exportIssue(refNo: string, itemCode: string, qty: number, company?: string, plant?: string) {
    return this.exportToErp({
      messageType: 'ISSUE',
      refNo, itemCode, qty,
      date: new Date().toISOString().slice(0, 10),
      company, plant,
    });
  }

  /** 재고보정 실적 ERP 전송 */
  async exportAdjustment(refNo: string, itemCode: string, qty: number, reason: string, company?: string, plant?: string) {
    return this.exportToErp({
      messageType: 'ADJUSTMENT',
      refNo, itemCode, qty,
      date: new Date().toISOString().slice(0, 10),
      reason, company, plant,
    });
  }

  /** 공통 ERP 전송 로직 */
  private async exportToErp(data: ErpExportData) {
    const enabled = await this.sysConfigService.getValue('ERP_EXPORT_ENABLED');
    if (enabled !== 'Y') {
      this.logger.debug(`ERP 전송 비활성화 상태 — ${data.messageType} ${data.refNo} 스킵`);
      return { success: true, skipped: true };
    }

    const transDate = new Date();
    const seq = await this.getNextSeq(transDate);
    const payload = JSON.stringify(data);

    try {
      // TODO: 실제 ERP API 호출 (어댑터 패턴)
      // const erpApiUrl = await this.sysConfigService.getValue('ERP_API_URL');
      // const response = await httpClient.post(erpApiUrl, data);
      this.logger.log(`ERP 전송 시뮬레이션: ${data.messageType} ${data.refNo}`);

      await this.logInterface(transDate, seq, 'OUTBOUND', `ERP_${data.messageType}`, 'SUCCESS', data.refNo, payload);
      return { success: true, refNo: data.refNo };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logInterface(transDate, seq, 'OUTBOUND', `ERP_${data.messageType}`, 'FAILED', data.refNo, payload, errMsg);

      // 재시도 대기 상태로 기록 (스케줄러가 재시도)
      return { success: false, refNo: data.refNo, error: errMsg };
    }
  }

  // ==========================================================================
  // 실패 건 재시도
  // ==========================================================================

  /** FAILED 상태 건 재시도 (최대 3회) */
  async retryFailed() {
    const failedLogs = await this.interLogRepo.find({
      where: { status: 'FAILED', direction: 'OUTBOUND' },
      order: { transDate: 'ASC' },
    });

    const results = [];
    for (const log of failedLogs) {
      if (log.retryCount >= 3) continue;

      try {
        const data = JSON.parse(log.payload || '{}');
        // TODO: 실제 ERP API 재호출
        this.logger.log(`ERP 재시도 (${log.retryCount + 1}/3): ${log.messageType} ${log.interfaceId}`);

        await this.interLogRepo.update(
          { transDate: log.transDate, seq: log.seq },
          { status: 'SUCCESS', retryCount: log.retryCount + 1 },
        );
        results.push({ transDate: log.transDate, seq: log.seq, status: 'SUCCESS' });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const newRetry = log.retryCount + 1;
        await this.interLogRepo.update(
          { transDate: log.transDate, seq: log.seq },
          { retryCount: newRetry, errorMsg: errMsg, status: newRetry >= 3 ? 'FAILED' : 'RETRY' },
        );
        results.push({ transDate: log.transDate, seq: log.seq, status: newRetry >= 3 ? 'FAILED' : 'RETRY' });
      }
    }
    return results;
  }

  // ==========================================================================
  // 통계
  // ==========================================================================

  /** 오늘 인터페이스 통계 */
  async getTodayStats() {
    const today = new Date().toISOString().slice(0, 10);
    const logs = await this.dataSource.query(
      `SELECT "STATUS", COUNT(*) AS "cnt" FROM "INTER_LOGS" WHERE "TRANS_DATE" = TO_DATE(:1, 'YYYY-MM-DD') GROUP BY "STATUS"`,
      [today],
    );
    const stats = { success: 0, failed: 0, retry: 0, pending: 0, total: 0 };
    for (const row of logs) {
      const cnt = Number(row.cnt);
      stats.total += cnt;
      if (row.STATUS === 'SUCCESS') stats.success = cnt;
      else if (row.STATUS === 'FAILED') stats.failed = cnt;
      else if (row.STATUS === 'RETRY') stats.retry = cnt;
      else if (row.STATUS === 'PENDING') stats.pending = cnt;
    }
    return stats;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async getNextSeq(transDate: Date): Promise<number> {
    const dateStr = transDate.toISOString().slice(0, 10);
    const result = await this.dataSource.query(
      `SELECT NVL(MAX("SEQ"), 0) + 1 AS "nextSeq" FROM "INTER_LOGS" WHERE "TRANS_DATE" = TO_DATE(:1, 'YYYY-MM-DD')`,
      [dateStr],
    );
    return result[0].nextSeq;
  }

  private async logInterface(
    transDate: Date, seq: number, direction: string, messageType: string,
    status: string, interfaceId?: string, payload?: string, errorMsg?: string,
  ) {
    await this.interLogRepo.save({
      transDate, seq, direction, messageType, status,
      interfaceId: interfaceId || null,
      payload: payload || null,
      errorMsg: errorMsg || null,
      sendAt: direction === 'OUTBOUND' ? new Date() : null,
      recvAt: direction === 'INBOUND' ? new Date() : null,
    });
  }
}
