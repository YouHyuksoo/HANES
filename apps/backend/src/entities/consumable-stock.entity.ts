/**
 * @file entities/consumable-stock.entity.ts
 * @description 소모품 개별 인스턴스 엔티티 (CONSUMABLE_STOCKS 테이블)
 *              ConsumableMaster 1 : N ConsumableStock 관계
 *
 * 초보자 가이드:
 * 1. conUid가 PK — PKG_SEQ_GENERATOR.GET_NO('CON_UID') 로 채번
 * 2. consumableCode: 소모품 마스터(CONSUMABLE_MASTERS) FK
 * 3. status: PENDING(미입고) → ACTIVE(창고) → PROC_WAIT(공정대기) → MOUNTED(장착중) → REPAIR(수리중) / SCRAPPED(폐기)
 * 4. 같은 금형 3개를 입고하면 conUid 3개가 생성됨 (개별 추적)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ConsumableMaster } from './consumable-master.entity';

@Entity({ name: 'CONSUMABLE_STOCKS' })
@Index(['consumableCode'])
@Index(['status'])
export class ConsumableStock {
  @PrimaryColumn({ name: 'CON_UID', length: 50 })
  conUid: string;

  @Column({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @ManyToOne(() => ConsumableMaster, (master) => master.stocks)
  @JoinColumn({ name: 'CONSUMABLE_CODE', referencedColumnName: 'consumableCode' })
  master: ConsumableMaster;

  @Column({ name: 'STATUS', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'CURRENT_COUNT', type: 'int', default: 0 })
  currentCount: number;

  /**
   * 수명 상태 — NORMAL / WARNING / REPLACE (CONSUMABLE_STATUS 공통코드)
   * 누적 타수(currentCount)와 마스터의 warningCount/expectedLife 로 생산실적 저장 시 재판정한다.
   * 개체별로 마모도가 다르므로 마스터가 아닌 인스턴스에서 관리한다.
   */
  @Column({ type: 'varchar2', name: 'LIFE_STATUS', length: 20, default: 'NORMAL' })
  lifeStatus: string;

  @Column({ type: 'varchar2', name: 'LOCATION', length: 100, nullable: true })
  location: string | null;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar2', name: 'MOUNTED_EQUIP_CODE', length: 50, nullable: true })
  mountedEquipCode: string | null;

  @Column({ name: 'RECV_DATE', type: 'timestamp', nullable: true })
  recvDate: Date | null;

  @Column({ name: 'LABEL_PRINTED_AT', type: 'timestamp', nullable: true })
  labelPrintedAt: Date | null;

  @Column({ type: 'varchar2', name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ type: 'varchar2', name: 'VENDOR_NAME', length: 100, nullable: true })
  vendorName: string | null;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plantCd: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
