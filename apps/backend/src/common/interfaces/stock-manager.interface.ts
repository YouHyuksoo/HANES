/**
 * @file src/common/interfaces/stock-manager.interface.ts
 * @description 재고관리 인터페이스 — InventoryModule과 외부 모듈 간 결합도 제어
 *
 * 초보자 가이드:
 * 1. ProductInventoryService가 이 인터페이스를 구현
 * 2. 외부 모듈(Production 등)은 이 인터페이스에만 의존
 * 3. InventoryModule 내부 구현이 바뀌어도 외부 영향 없음
 *
 * 사용 패턴:
 * ```typescript
 * // production.module.ts
 * imports: [InventoryModule]
 *
 * // prod-result.service.ts
 * constructor(@Inject(STOCK_MANAGER) private stockManager: IStockManager) {}
 * ```
 */
import { QueryRunner } from 'typeorm';

/** DI 토큰 */
export const STOCK_MANAGER = 'STOCK_MANAGER';

/** 제품 입고 DTO (최소 인터페이스) */
export interface StockReceiveInput {
  warehouseCode: string;
  itemCode: string;
  prdUid?: string;
  qty: number;
  transType: string;
  refType?: string;
  refId?: string;
  workerId?: string;
  remark?: string;
  company?: string;
  plant?: string;
}

/** 재고관리 인터페이스 — 외부 모듈이 의존하는 최소 계약 */
export interface IStockManager {
  /** 외부 트랜잭션 내에서 제품 입고 */
  receiveStockInTx(qr: QueryRunner, dto: StockReceiveInput): Promise<any>;

  /** 제품 트랜잭션 번호 생성 */
  generateTransNo?(qr?: QueryRunner): Promise<string>;
}
