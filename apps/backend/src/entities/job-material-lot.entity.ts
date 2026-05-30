/**
 * @file src/entities/job-material-lot.entity.ts
 * @description 작업지시별 자재 롯트 스캔 등록 엔티티
 *
 * 초보자 가이드:
 * - 작업지시(JOB_ORDER_NO) + 자재코드(ITEM_CODE) + 순번(SEQ) 복합 PK
 * - 바코드 스캔 시 MAT_LOTS 테이블의 matUid와 연결
 * - SCANNED_BY/SCANNED_AT: 스캔 작업자 및 시각 기록
 */
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'JOB_MATERIAL_LOTS' })
export class JobMaterialLot {
  @PrimaryColumn({ name: 'JOB_ORDER_NO', length: 50 })
  jobOrderNo: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'number' })
  seq: number;

  @Column({ name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ name: 'INIT_QTY', type: 'number', default: 0 })
  initQty: number;

  @Column({ type: 'varchar2', name: 'SCANNED_BY', length: 100, nullable: true })
  scannedBy: string | null;

  @Column({ name: 'SCANNED_AT', type: 'timestamp', nullable: true })
  scannedAt: Date | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;
}
