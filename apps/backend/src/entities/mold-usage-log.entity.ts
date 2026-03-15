/**
 * @file mold-usage-log.entity.ts
 * @description 금형 사용 이력 엔티티 — 금형 타수 기록
 *              복합 PK(USAGE_DATE + SEQ) 사용.
 *
 * 초보자 가이드:
 * 1. 복합 PK: usageDate(USAGE_DATE) + seq(SEQ)
 * 2. MoldMaster에 연결된 개별 사용 기록
 * 3. shotCount: 해당 사용에서의 타수
 * 4. 사용 등록 시 MoldMaster.currentShots 자동 누적
 * 5. orderNo/equipCode/workerCode: 생산 추적 정보
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { MoldMaster } from './mold-master.entity';

@Entity({ name: 'MOLD_USAGE_LOGS' })
@Index(['moldCode'])
@Index(['usageDate'])
export class MoldUsageLog {
  @PrimaryColumn({ name: 'USAGE_DATE', type: 'timestamp' })
  usageDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'MOLD_CODE', length: 50 })
  moldCode: string;

  @ManyToOne(() => MoldMaster)
  @JoinColumn({ name: 'MOLD_CODE', referencedColumnName: 'moldCode' })
  mold: MoldMaster;

  @Column({ name: 'SHOT_COUNT', type: 'int' })
  shotCount: number;

  @Column({ name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string;

  @Column({ name: 'WORKER_CODE', length: 50, nullable: true })
  workerCode: string;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
