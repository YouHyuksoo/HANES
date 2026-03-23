/**
 * @file entities/process-capa.entity.ts
 * @description 공정x제품별 CAPA 마스터 엔티티 - 공정+품목 조합의 생산능력 정보를 관리한다.
 *              COMPANY + PLANT_CD + PROCESS_CODE + ITEM_CODE 복합키를 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. 복합 PK: (COMPANY, PLANT_CD, PROCESS_CODE, ITEM_CODE) — 공장별 공정x품목 CAPA 구분
 * 2. STD_TACT_TIME: 표준 택트타임(초), STD_UPH: 시간당 생산량 (3600/택트타임 자동 계산)
 * 3. DAILY_CAPA: 일 생산능력 (UPH x 가동시간 x 인원/설비 수 x 밸런싱효율로 자동 계산)
 * 4. BALANCE_EFF: 밸런싱 효율(%), 기본 85%
 * 5. ManyToOne 관계: ProcessMaster(공정), PartMaster(품목)
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
import { ProcessMaster } from './process-master.entity';
import { PartMaster } from './part-master.entity';

@Entity({ name: 'PROCESS_CAPAS' })
@Index(['useYn'])
export class ProcessCapa {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'STD_TACT_TIME', type: 'decimal', precision: 10, scale: 2 })
  stdTactTime: number;

  @Column({ name: 'STD_UPH', type: 'decimal', precision: 10, scale: 2, default: 0 })
  stdUph: number;

  @Column({ name: 'WORKER_CNT', type: 'number', precision: 3, default: 0 })
  workerCnt: number;

  @Column({ name: 'BOARD_CNT', type: 'number', precision: 3, default: 0 })
  boardCnt: number;

  @Column({ name: 'EQUIP_CNT', type: 'number', precision: 3, default: 0 })
  equipCnt: number;

  @Column({ name: 'SETUP_TIME', type: 'number', precision: 5, default: 0 })
  setupTime: number;

  @Column({ name: 'BALANCE_EFF', type: 'decimal', precision: 5, scale: 2, default: 85 })
  balanceEff: number;

  @Column({ name: 'DAILY_CAPA', type: 'number', precision: 10, default: 0 })
  dailyCapa: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  /* ── ManyToOne 관계 ── */

  @ManyToOne(() => ProcessMaster, { nullable: true })
  @JoinColumn({ name: 'PROCESS_CODE' })
  process: ProcessMaster | null;

  @ManyToOne(() => PartMaster, { nullable: true })
  @JoinColumn({ name: 'ITEM_CODE' })
  part: PartMaster | null;
}
