/**
 * @file src/modules/material/material.module.ts
 * @description 자재관리 모듈 - LOT, 재고, 출고, PO, IQC, 분할, 유수명, 홀드, 폐기, 보정, 기타입고, 실사, 입고취소, 자동입고
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
 * 13. **Arrival**: 입하관리 (PO 기반/수동 입하 + 취소)
 * 14. **Receiving**: 입고관리 (IQC 합격건 일괄/분할 입고)
 */

import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module';
import { InventoryControlModule } from './inventory-control/inventory-control.module';
import { IssueModule } from './issue/issue.module';
import { LabelsModule } from './labels/labels.module';
import { LotModule } from './lot/lot.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { ReceivingModule } from './receiving/receiving.module';

@Module({
  imports: [
    SystemModule,
    InventoryControlModule,
    IssueModule,
    LabelsModule,
    LotModule,
    PurchasingModule,
    ReceivingModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    InventoryControlModule,
    IssueModule,
    LotModule,
    PurchasingModule,
  ],
})
export class MaterialModule {}
