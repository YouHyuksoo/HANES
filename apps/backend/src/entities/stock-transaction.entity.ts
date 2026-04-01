/**
 * @file src/entities/stock-transaction.entity.ts
 * @description 원자재 수불 트랜잭션 엔티티 - 원자재 입고/출고/이동 이력 (수불원장)
 *              TRANS_NO 자연키 PK 사용.
 *
 * 초보자 가이드:
 * - TRANS_NO가 자연키 PK (트랜잭션 번호)
 * - transType: MAT_IN(입고), MAT_OUT(출고), MAT_ADJ(조정) 등
 * - 삭제 금지, 취소 시 원본 참조(cancelRefId) + 음수 수량
 * - itemCode로 품목마스터(ITEM_MASTERS)와 연결
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'STOCK_TRANSACTIONS' })
@Index(['transType'])
@Index(['transDate'])
@Index(['fromWarehouseId'])
@Index(['toWarehouseId'])
@Index(['itemCode'])
@Index(['matUid'])
@Index(['refType', 'refId'])
@Index(['cancelRefId'])
export class StockTransaction {
  @PrimaryColumn({ name: 'TRANS_NO', length: 50 })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  @Column({ name: 'TRANS_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transDate: Date;

  @Column({ type: 'varchar2', name: 'FROM_WAREHOUSE_ID', length: 50, nullable: true })
  fromWarehouseId: string | null;

  @Column({ type: 'varchar2', name: 'TO_WAREHOUSE_ID', length: 50, nullable: true })
  toWarehouseId: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ type: 'varchar2', name: 'REF_TYPE', length: 50, nullable: true })
  refType: string | null;

  @Column({ type: 'varchar2', name: 'REF_ID', length: 50, nullable: true })
  refId: string | null;

  @Column({ type: 'varchar2', name: 'CANCEL_REF_ID', length: 50, nullable: true })
  cancelRefId: string | null;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

  /** G9: 승인자 ID (기타출고 승인 워크플로우) */
  @Column({ type: 'varchar2', name: 'APPROVER_ID', length: 20, nullable: true })
  approverId: string | null;

  /** G9: 승인 일시 */
  @Column({ type: 'timestamp', name: 'APPROVED_AT', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
