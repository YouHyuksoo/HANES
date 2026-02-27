/**
 * @file entities/consumable-stock.entity.ts
 * @description 소모품 개별 인스턴스 엔티티 (CONSUMABLE_STOCKS 테이블)
 *              ConsumableMaster 1 : N ConsumableStock 관계
 *
 * 초보자 가이드:
 * 1. conUid가 PK — Oracle DB Function(F_GET_CON_UID)으로 채번
 * 2. consumableCode: 소모품 마스터(CONSUMABLE_MASTERS) FK
 * 3. status: PENDING(미입고) → ACTIVE(사용가능) → MOUNTED(장착중) 등
 * 4. 같은 금형 3개를 입고하면 conUid 3개가 생성됨 (개별 추적)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_STOCKS' })
@Index(['consumableCode'])
@Index(['status'])
export class ConsumableStock {
  @PrimaryColumn({ name: 'CON_UID', length: 50 })
  conUid: string;

  @Column({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @Column({ name: 'STATUS', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'CURRENT_COUNT', type: 'int', default: 0 })
  currentCount: number;

  @Column({ name: 'LOCATION', length: 100, nullable: true })
  location: string | null;

  @Column({ name: 'MOUNTED_EQUIP_CODE', length: 50, nullable: true })
  mountedEquipCode: string | null;

  @Column({ name: 'RECV_DATE', type: 'timestamp', nullable: true })
  recvDate: Date | null;

  @Column({ name: 'LABEL_PRINTED_AT', type: 'timestamp', nullable: true })
  labelPrintedAt: Date | null;

  @Column({ name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ name: 'VENDOR_NAME', length: 100, nullable: true })
  vendorName: string | null;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plantCd: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
