/**
 * @file entities/customs-entry.entity.ts
 * @description 수입신고 엔티티 - 보세 수입신고 정보를 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. entryNo: 수입신고번호 (유니크)
 * 3. status: PENDING, CLEARED, CANCELLED 등
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMS_ENTRIES' })
@Index(['status'])
@Index(['declarationDate'])
export class CustomsEntry {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ENTRY_NO', length: 50, unique: true })
  entryNo: string;

  @Column({ name: 'BL_NO', length: 50, nullable: true })
  blNo: string | null;

  @Column({ name: 'INVOICE_NO', length: 50, nullable: true })
  invoiceNo: string | null;

  @Column({ name: 'DECLARATION_DATE', type: 'date', nullable: true })
  declarationDate: Date | null;

  @Column({ name: 'CLEARANCE_DATE', type: 'date', nullable: true })
  clearanceDate: Date | null;

  @Column({ name: 'ORIGIN', length: 100, nullable: true })
  origin: string | null;

  @Column({ name: 'HS_CODE', length: 50, nullable: true })
  hsCode: string | null;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ name: 'CURRENCY', length: 10, default: 'USD' })
  currency: string;

  @Column({ name: 'STATUS', length: 50, default: 'PENDING' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
