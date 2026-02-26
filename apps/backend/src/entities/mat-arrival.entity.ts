/**
 * @file src/entities/mat-arrival.entity.ts
 * @description 입하 업무 전용 테이블 엔티티 - 입하 이력/추적 관리용
 *
 * 초보자 가이드:
 * 1. **MAT_ARRIVALS**: PO/수동 입하 시 업무 이력을 기록하는 전용 테이블
 * 2. **arrivalNo**: 같은 배치의 입하 아이템은 동일한 입하번호를 가짐
 * 3. **invoiceNo**: 공급상 인보이스 번호 (거래 추적용)
 * 4. **vendorId/vendorName**: 공급상(거래처) 정보
 * 5. **StockTransaction과의 관계**: 입하 시 MatArrival + StockTransaction(MAT_IN) 모두 생성
 * 6. **id**: SEQUENCE 자동증분 PK
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_ARRIVALS' })
@Index(['arrivalNo'])
@Index(['itemCode'])
@Index(['arrivalDate'])
@Index(['invoiceNo'])
@Index(['vendorId'])
export class MatArrival {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ARRIVAL_NO', length: 50 })
  arrivalNo: string;

  @Column({ name: 'INVOICE_NO', length: 100, nullable: true })
  invoiceNo: string | null;

  @Column({ name: 'PO_ID', length: 50, nullable: true })
  poId: string | null;

  @Column({ name: 'PO_ITEM_ID', length: 50, nullable: true })
  poItemId: string | null;

  @Column({ name: 'PO_NO', length: 50, nullable: true })
  poNo: string | null;

  @Column({ name: 'VENDOR_ID', length: 50, nullable: true })
  vendorId: string | null;

  @Column({ name: 'VENDOR_NAME', length: 200, nullable: true })
  vendorName: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ name: 'ARRIVAL_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  arrivalDate: Date;

  @Column({ name: 'ARRIVAL_TYPE', length: 20, default: 'PO' })
  arrivalType: string;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'IQC_STATUS', length: 20, default: "'PENDING'" })
  iqcStatus: string;

  @Column({ name: 'SUP_UID', length: 50, nullable: true })
  supUid: string | null;

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
