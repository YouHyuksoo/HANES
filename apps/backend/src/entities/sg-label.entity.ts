/**
 * @file sg-label.entity.ts
 * @description 반제품 묶음 추적라벨(SgLabel) — 최초 공정 1회 발행, 서브공정에서 가닥 단위 소비.
 *              잔량(REMAIN_QTY)을 시리얼에 보유한다. 재고 수량은 PRODUCT_STOCKS(품목코드)에서 별도 집계.
 * STATUS: IN_STOCK → MOUNTED → CONSUMED / DEFECT
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SG_LABELS' })
@Index(['itemCode'])
@Index(['orderNo'])
@Index(['status'])
@Index(['mountedEquipCode'])
export class SgLabel {
  @PrimaryColumn({ name: 'SG_BARCODE', length: 30 })
  sgBarcode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  /** 발행 생산실적 번호 — 배치(실적) 단위 추적 + 멱등 키 */
  @Column({ type: 'varchar2', name: 'RESULT_NO', length: 50, nullable: true })
  resultNo: string | null;

  @Column({ type: 'varchar2', name: 'ISSUE_PROCESS_CODE', length: 50, nullable: true })
  issueProcessCode: string | null;

  @Column({ type: 'varchar2', name: 'CURRENT_PROCESS_CODE', length: 50, nullable: true })
  currentProcessCode: string | null;

  @Column({ type: 'varchar2', name: 'MOUNTED_EQUIP_CODE', length: 50, nullable: true })
  mountedEquipCode: string | null;

  @Column({ type: 'varchar2', name: 'WAREHOUSE_CODE', length: 50, nullable: true })
  warehouseCode: string | null;

  @Column({ name: 'INIT_QTY', type: 'int', default: 0 })
  initQty: number;

  @Column({ name: 'REMAIN_QTY', type: 'int', default: 0 })
  remainQty: number;

  @Column({ name: 'STATUS', length: 20, default: 'IN_STOCK' })
  status: string;

  /** 라벨 종류 — BUNDLE(묶음 추적 라벨, 가닥 묶음) / SG(반제품 회로). 발행 공정 ISSUE_LABEL_TYPE 기준. */
  @Column({ name: 'LABEL_TYPE', length: 20, default: 'SG' })
  labelType: string;

  @Column({ type: 'varchar2', name: 'WORKER_CODE', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'ISSUED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
