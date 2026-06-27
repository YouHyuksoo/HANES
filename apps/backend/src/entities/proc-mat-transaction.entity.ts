/**
 * @file src/entities/proc-mat-transaction.entity.ts
 * @description 공정재고 거래원장 엔티티 - 공정(PROCESS_CODE) 단위 공정재고 가산/차감 이력
 *              TRANS_NO 자연키 PK 사용 (WIP_TX 채번 재사용).
 *
 * 초보자 가이드:
 * - TRANS_NO가 자연키 PK (공정 거래 번호).
 * - transType: PROC_IN(공정입고=출고이동), PROC_IN_CANCEL(입고취소),
 *              PROC_MOUNT(설비 장착 이동), PROC_MOUNT_CANCEL(장착취소) 등.
 * - 삭제 금지, 취소 시 원본 참조(cancelRefId) + 음수 수량.
 * - 설비재고 원장(WIP_MAT_TRANSACTIONS)·원자재 수불(STOCK_TRANSACTIONS)과 분리된 공정 위치 원장.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PROC_MAT_TRANSACTIONS' })
@Index(['processCode', 'itemCode'])
@Index(['refType', 'refId'])
export class ProcMatTransaction {
  @PrimaryColumn({ name: 'TRANS_NO', length: 50 })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  @Column({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'MAT_UID', length: 100 })
  matUid: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ type: 'varchar2', name: 'FROM_WAREHOUSE_ID', length: 50, nullable: true })
  fromWarehouseId: string | null;

  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

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
