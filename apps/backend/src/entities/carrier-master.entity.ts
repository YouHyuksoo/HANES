/**
 * @file carrier-master.entity.ts
 * @description 대차/트레이/매거진 마스터 — 생산 라벨(SG/FG)과 키팅 원자재 LOT을 담아 공정 간 이동하는 운반구
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + CARRIER_NO. CARRIER_NO가 바코드 값이며 수동 입력.
 * 2. 현재 상태(EMPTY/LOADING/IN_TRANSIT)는 여기 저장하지 않는다. SG_LABELS/FG_LABELS/MAT_LOTS.CARRIER_NO로 도출한다.
 * 3. CAPACITY는 NULL이면 무제한.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'CARRIER_MASTERS' })
export class CarrierMaster {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'CARRIER_NO', length: 30 })
  carrierNo: string;

  /** 공통코드 CARRIER_TYPE: CART / TRAY / MAGAZINE */
  @Column({ name: 'CARRIER_TYPE', length: 20 })
  carrierType: string;

  @Column({ type: 'varchar2', name: 'CARRIER_NAME', length: 100, nullable: true })
  carrierName: string | null;

  /** 최대 적재 수. NULL=무제한 */
  @Column({ name: 'CAPACITY', type: 'number', nullable: true })
  capacity: number | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
