/**
 * @file src/modules/material/material.module.ts
 * @description 자재관리 모듈 - LOT, 재고, 출고, PO, IQC, 분할, 유수명, 홀드, 폐기, 보정, 기타입고, 실사, 입고취소
 *
 * 초보자 가이드:
 * 1. **MatLot/MatStock/MatIssue**: 기존 레거시 자재 관리
 * 2. **PurchaseOrder**: 구매발주 CRUD
 * 3. **PoStatus**: PO 현황 조회 (읽기 전용)
 * 4. **IqcHistory**: IQC 검사이력 조회
 * 5. **LotSplit**: LOT 분할
 * 6. **ShelfLife**: 유수명자재 (유효기한 관리)
 * 7. **Hold**: 재고 홀드/해제
 * 8. **Scrap**: 자재 폐기
 * 9. **Adjustment**: 재고 보정
 * 10. **MiscReceipt**: 기타입고
 * 11. **PhysicalInv**: 재고 실사
 * 12. **ReceiptCancel**: 입고 취소 (역분개)
 */

import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';

// 기존 컨트롤러/서비스
import { MatLotController } from './controllers/mat-lot.controller';
import { MatLotService } from './services/mat-lot.service';
import { MatStockController } from './controllers/mat-stock.controller';
import { MatStockService } from './services/mat-stock.service';
import { MatIssueController } from './controllers/mat-issue.controller';
import { MatIssueService } from './services/mat-issue.service';

// 신규 컨트롤러/서비스
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { PurchaseOrderService } from './services/purchase-order.service';
import { PoStatusController } from './controllers/po-status.controller';
import { PoStatusService } from './services/po-status.service';
import { IqcHistoryController } from './controllers/iqc-history.controller';
import { IqcHistoryService } from './services/iqc-history.service';
import { LotSplitController } from './controllers/lot-split.controller';
import { LotSplitService } from './services/lot-split.service';
import { ShelfLifeController } from './controllers/shelf-life.controller';
import { ShelfLifeService } from './services/shelf-life.service';
import { HoldController } from './controllers/hold.controller';
import { HoldService } from './services/hold.service';
import { ScrapController } from './controllers/scrap.controller';
import { ScrapService } from './services/scrap.service';
import { AdjustmentController } from './controllers/adjustment.controller';
import { AdjustmentService } from './services/adjustment.service';
import { MiscReceiptController } from './controllers/misc-receipt.controller';
import { MiscReceiptService } from './services/misc-receipt.service';
import { PhysicalInvController } from './controllers/physical-inv.controller';
import { PhysicalInvService } from './services/physical-inv.service';
import { ReceiptCancelController } from './controllers/receipt-cancel.controller';
import { ReceiptCancelService } from './services/receipt-cancel.service';

@Module({
  imports: [InventoryModule],
  controllers: [
    MatLotController,
    MatStockController,
    MatIssueController,
    PurchaseOrderController,
    PoStatusController,
    IqcHistoryController,
    LotSplitController,
    ShelfLifeController,
    HoldController,
    ScrapController,
    AdjustmentController,
    MiscReceiptController,
    PhysicalInvController,
    ReceiptCancelController,
  ],
  providers: [
    MatLotService,
    MatStockService,
    MatIssueService,
    PurchaseOrderService,
    PoStatusService,
    IqcHistoryService,
    LotSplitService,
    ShelfLifeService,
    HoldService,
    ScrapService,
    AdjustmentService,
    MiscReceiptService,
    PhysicalInvService,
    ReceiptCancelService,
  ],
  exports: [
    MatLotService,
    MatStockService,
    MatIssueService,
    PurchaseOrderService,
  ],
})
export class MaterialModule {}
