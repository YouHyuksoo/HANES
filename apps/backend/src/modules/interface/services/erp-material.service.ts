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
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';

/** ERP PO 수신 데이터 구조 */
interface ErpPoData {
  poNo: string;
  orderDate: string;
  partnerCode: string;
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
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  // ==========================================================================
  // ERP → MES: PO 정보 수신 (Inbound)
  // ==========================================================================

  /** ERP에서 PO 데이터를 수신하여 PurchaseOrder/PurchaseOrderItem에 upsert */
  async importPurchaseOrder(data: ErpPoData) {
    const transDate = new Date();
    const seq = await this.getNextSeq();
    const tenantWhere = {
      ...(data.company ? { company: data.company } : {}),
      ...(data.plant ? { plant: data.plant } : {}),
    };

    try {
      await this.tx.run(async (queryRunner) => {
        // PO upsert
        let po = await queryRunner.manager.findOne(PurchaseOrder, { where: { poNo: data.poNo, ...tenantWhere } });
        if (po) {
          await queryRunner.manager.update(PurchaseOrder, { poNo: data.poNo, ...tenantWhere }, {
            orderDate: parseDateStart(data.orderDate),
            partnerCode: data.partnerCode,
            partnerName: data.partnerName,
          });
        } else {
          po = queryRunner.manager.create(PurchaseOrder, {
            poNo: data.poNo,
            orderDate: parseDateStart(data.orderDate),
            partnerCode: data.partnerCode,
            partnerName: data.partnerName,
            status: 'CONFIRMED',
            company: data.company,
            plant: data.plant,
          });
          await queryRunner.manager.save(po);
        }

        // PO Items upsert — 기존 항목 일괄 선조회로 N+1 제거
        const existingItems = await queryRunner.manager.find(PurchaseOrderItem, {
          where: { poNo: data.poNo, ...tenantWhere },
        });
        const existingItemMap = new Map(existingItems.map((ei) => [ei.seq, ei]));

        for (const item of data.items) {
          if (existingItemMap.has(item.seq)) {
            await queryRunner.manager.update(PurchaseOrderItem,
              { poNo: data.poNo, seq: item.seq, ...tenantWhere },
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
      });

      // 성공 로그
      await this.logInterface(transDate, seq, 'INBOUND', 'ERP_PO_IMPORT', 'SUCCESS', data.poNo, JSON.stringify(data), undefined, data.company, data.plant);
      return { success: true, poNo: data.poNo };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logInterface(transDate, seq, 'INBOUND', 'ERP_PO_IMPORT', 'FAILED', data.poNo, JSON.stringify(data), errMsg, data.company, data.plant);
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
    const seq = await this.getNextSeq();
    const payload = JSON.stringify(data);

    try {
      await this.sendToErp(data);

      await this.logInterface(transDate, seq, 'OUTBOUND', `ERP_${data.messageType}`, 'SUCCESS', data.refNo, payload, undefined, data.company, data.plant);
      return { success: true, refNo: data.refNo };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logInterface(transDate, seq, 'OUTBOUND', `ERP_${data.messageType}`, 'FAILED', data.refNo, payload, errMsg, data.company, data.plant);

      // 재시도 대기 상태로 기록 (스케줄러가 재시도)
      return { success: false, refNo: data.refNo, error: errMsg };
    }
  }

  // ==========================================================================
  // 실패 건 재시도
  // ==========================================================================

  /** FAILED 상태 건 재시도 (최대 3회) */
  async retryFailed(company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const failedLogs = await this.interLogRepo.find({
      where: { status: 'FAILED', direction: 'OUTBOUND', ...tenantWhere },
      order: { transDate: 'ASC' },
    });

    const results = [];
    for (const log of failedLogs) {
      if (log.retryCount >= 3) continue;

      try {
        const data = JSON.parse(log.payload || '{}');
        this.logger.log(`ERP 재시도 (${log.retryCount + 1}/3): ${log.messageType} ${log.interfaceId}`);
        await this.sendToErp(data);

        await this.interLogRepo.update(
          { transDate: log.transDate, seq: log.seq, ...tenantWhere },
          { status: 'SUCCESS', retryCount: log.retryCount + 1 },
        );
        results.push({ transDate: log.transDate, seq: log.seq, status: 'SUCCESS' });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const newRetry = log.retryCount + 1;
        await this.interLogRepo.update(
          { transDate: log.transDate, seq: log.seq, ...tenantWhere },
          { retryCount: newRetry, errorMsg: errMsg, status: newRetry >= 3 ? 'FAILED' : 'RETRY' },
        );
        results.push({ transDate: log.transDate, seq: log.seq, status: newRetry >= 3 ? 'FAILED' : 'RETRY' });
      }
    }
    return results;
  }

  private async sendToErp(data: ErpExportData): Promise<void> {
    const erpApiUrl = await this.sysConfigService.getValue('ERP_API_URL');
    if (!erpApiUrl) {
      throw new Error('ERP_API_URL 설정이 없어 ERP 전송을 수행할 수 없습니다.');
    }

    if (typeof fetch !== 'function') {
      throw new Error('fetch API를 사용할 수 없어 ERP 전송을 수행할 수 없습니다.');
    }

    const response = await fetch(erpApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(`ERP 전송 실패: HTTP ${response.status}${responseText ? ` - ${responseText}` : ''}`);
    }
  }

  // ==========================================================================
  // 통계
  // ==========================================================================

  /** 오늘 인터페이스 통계 */
  async getTodayStats(company?: string, plant?: string) {
    const today = new Date().toISOString().slice(0, 10);
    const conditions = ['"TRANS_DATE" = TO_DATE(:1, \'YYYY-MM-DD\')'];
    const binds: unknown[] = [today];
    if (company) {
      conditions.push(`"COMPANY" = :${binds.length + 1}`);
      binds.push(company);
    }
    if (plant) {
      conditions.push(`"PLANT_CD" = :${binds.length + 1}`);
      binds.push(plant);
    }
    const logs = await this.dataSource.query(
      `SELECT "STATUS", COUNT(*) AS "cnt" FROM "INTER_LOGS" WHERE ${conditions.join(' AND ')} GROUP BY "STATUS"`,
      binds,
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

  private async getNextSeq(): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT SEQ_INTER_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
  }

  private async logInterface(
    transDate: Date, seq: number, direction: string, messageType: string,
    status: string, interfaceId?: string, payload?: string, errorMsg?: string, company?: string, plant?: string,
  ) {
    await this.interLogRepo.save({
      transDate, seq, direction, messageType, status,
      interfaceId: interfaceId || null,
      payload: payload || null,
      errorMsg: errorMsg || null,
      sendAt: direction === 'OUTBOUND' ? new Date() : null,
      recvAt: direction === 'INBOUND' ? new Date() : null,
      company: company || null,
      plant: plant || null,
    });
  }
}
