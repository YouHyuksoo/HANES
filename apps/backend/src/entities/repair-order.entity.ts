/**
 * @file entities/repair-order.entity.ts
 * @description 수리오더 엔티티 - 수리등록/이력/수리실 재고 관리
 *
 * 초보자 가이드:
 * 1. 복합 PK: repairDate(수리일자) + seq(일련번호)
 * 2. 상태(status): RECEIVED(입고) → IN_REPAIR(수리중) → COMPLETED(완료)
 * 3. 수리실 재고 = status가 RECEIVED 또는 IN_REPAIR인 건
 * 4. FG_BARCODE가 있으면 스캔, 없으면 품목코드+수량 수동등록
 * 5. 모든 구분값은 ComCode 관리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'REPAIR_ORDERS' })
@Index(['status'])
@Index(['itemCode'])
@Index(['fgBarcode'])
@Index(['workerId'])
export class RepairOrder {
  @PrimaryColumn({ name: 'REPAIR_DATE', type: 'date' })
  repairDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'STATUS', length: 20, default: 'RECEIVED' })
  status: string;

  @Column({ type: 'varchar2', name: 'FG_BARCODE', length: 100, nullable: true })
  fgBarcode: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ type: 'varchar2', name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ type: 'varchar2', name: 'SOURCE_PROCESS', length: 50, nullable: true })
  sourceProcess: string | null;

  @Column({ type: 'varchar2', name: 'RETURN_PROCESS', length: 50, nullable: true })
  returnProcess: string | null;

  @Column({ type: 'varchar2', name: 'REPAIR_RESULT', length: 50, nullable: true })
  repairResult: string | null;

  @Column({ type: 'varchar2', name: 'GENUINE_TYPE', length: 50, nullable: true })
  genuineType: string | null;

  @Column({ type: 'varchar2', name: 'DEFECT_TYPE', length: 50, nullable: true })
  defectType: string | null;

  @Column({ type: 'varchar2', name: 'DEFECT_CAUSE', length: 50, nullable: true })
  defectCause: string | null;

  @Column({ type: 'varchar2', name: 'DEFECT_POSITION', length: 50, nullable: true })
  defectPosition: string | null;

  @Column({ type: 'varchar2', name: 'DISPOSITION', length: 50, nullable: true })
  disposition: string | null;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'RECEIVED_AT', type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'COMPLETED_AT', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
