/**
 * @file src/entities/wip-mat-transaction.entity.ts
 * @description 공정재고 거래원장 엔티티 - 설비 단위 공정재고 가산/차감 이력
 *              TRANS_NO 자연키 PK 사용 (WIP_TX 채번).
 *
 * 초보자 가이드:
 * - TRANS_NO가 자연키 PK (공정 거래 번호: WTXYYMMDD-NNNNN)
 * - transType: WIP_IN(공정적재), WIP_IN_CANCEL(적재취소),
 *              PROD_CONSUME(생산소비), PROD_CONSUME_CANCEL(소비취소) 등
 * - 삭제 금지, 취소 시 원본 참조(cancelRefId) + 음수 수량
 * - 원자재 수불(STOCK_TRANSACTIONS)과 완전 분리된 공정 전용 원장
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WIP_MAT_TRANSACTIONS' })
@Index(['equipCode', 'itemCode'])
@Index(['refType', 'refId'])
export class WipMatTransaction {
  @PrimaryColumn({ name: 'TRANS_NO', length: 50 })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'MAT_UID', length: 100 })
  matUid: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ type: 'varchar2', name: 'FROM_WAREHOUSE_ID', length: 50, nullable: true })
  fromWarehouseId: string | null;

  @Column({ type: 'varchar2', name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ type: 'varchar2', name: 'REF_TYPE', length: 50, nullable: true })
  refType: string | null;

  @Column({ type: 'varchar2', name: 'REF_ID', length: 100, nullable: true })
  refId: string | null;

  @Column({ type: 'varchar2', name: 'CANCEL_REF_ID', length: 50, nullable: true })
  cancelRefId: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'WORKER_CODE', length: 50, nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
