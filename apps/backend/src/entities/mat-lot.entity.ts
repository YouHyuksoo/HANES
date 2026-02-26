/**
 * @file src/entities/mat-lot.entity.ts
 * @description 원자재 LOT 엔티티 - LOT 단위 추적/관리
 *
 * 초보자 가이드:
 * - matUid가 PK (자재시리얼) - 자재 고유식별자로 직접 식별
 * - itemCode로 품목마스터(ITEM_MASTERS)와 연결
 * - iqcStatus: IQC 검사 상태 (PENDING/PASS/FAIL)
 * - status: LOT 상태 (NORMAL/HOLD/SCRAPPED)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_LOTS' })
@Index(['itemCode'])
@Index(['status'])
@Index(['iqcStatus'])
export class MatLot {
  @PrimaryColumn({ name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'INIT_QTY', type: 'int' })
  initQty: number;

  @Column({ name: 'CURRENT_QTY', type: 'int' })
  currentQty: number;

  @Column({ name: 'RECV_DATE', type: 'date', nullable: true })
  recvDate: Date | null;

  @Column({ name: 'MANUFACTURE_DATE', type: 'date', nullable: true })
  manufactureDate: Date | null;

  @Column({ name: 'EXPIRE_DATE', type: 'date', nullable: true })
  expireDate: Date | null;

  @Column({ name: 'ORIGIN', length: 50, nullable: true })
  origin: string | null;

  @Column({ name: 'VENDOR', length: 50, nullable: true })
  vendor: string | null;

  @Column({ name: 'INVOICE_NO', length: 50, nullable: true })
  invoiceNo: string | null;

  @Column({ name: 'PO_NO', length: 50, nullable: true })
  poNo: string | null;

  @Column({ name: 'IQC_STATUS', length: 20, default: 'PENDING' })
  iqcStatus: string;

  @Column({ name: 'STATUS', length: 20, default: 'NORMAL' })
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
