/**
 * @file src/entities/product-transaction.entity.ts
 * @description 제품 수불 트랜잭션 엔티티 - 반제품/완제품 입고/출고 이력
 *
 * 초보자 가이드:
 * - 원자재(RAW) 수불은 STOCK_TRANSACTIONS, 제품(WIP/FG) 수불은 PRODUCT_TRANSACTIONS
 * - transType: WIP_IN, FG_IN, WIP_OUT, FG_OUT 등
 * - 삭제 금지, 취소 시 원본 참조(cancelRefId) + 음수 수량
 * - itemType: 'WIP'(반제품) 또는 'FG'(완제품)
 * - orderNo: 작업지시 참조, processCode: 공정코드
 * - id: SEQUENCE 자동증분 PK
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PRODUCT_TRANSACTIONS' })
@Index(['transType'])
@Index(['transDate'])
@Index(['fromWarehouseId'])
@Index(['toWarehouseId'])
@Index(['itemCode'])
@Index(['prdUid'])
@Index(['refType', 'refId'])
@Index(['cancelRefId'])
export class ProductTransaction {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'TRANS_NO', length: 50, unique: true })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  @Column({ name: 'TRANS_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transDate: Date;

  @Column({ name: 'FROM_WAREHOUSE_ID', length: 50, nullable: true })
  fromWarehouseId: string | null;

  @Column({ name: 'TO_WAREHOUSE_ID', length: 50, nullable: true })
  toWarehouseId: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_TYPE', length: 10, nullable: true })
  itemType: string | null;

  @Column({ name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ name: 'REF_TYPE', length: 50, nullable: true })
  refType: string | null;

  @Column({ name: 'REF_ID', length: 50, nullable: true })
  refId: string | null;

  @Column({ name: 'CANCEL_REF_ID', length: 50, nullable: true })
  cancelRefId: string | null;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'ISSUE_TYPE', length: 20, nullable: true })
  issueType: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
