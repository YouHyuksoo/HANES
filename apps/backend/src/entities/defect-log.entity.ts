/**
 * @file defect-log.entity.ts
 * @description 불량이력(DefectLog) 엔티티 - 생산실적별 불량 정보를 기록한다.
 *              복합 PK(OCCUR_TIME + SEQ) 사용, prodResultId는 number 타입으로 ProdResult 참조.
 *              id 컬럼은 RepairLog/ReworkOrder FK 호환을 위해 @Column으로 유지.
 *
 * 초보자 가이드:
 * 1. 복합 PK: occurAt(OCCUR_TIME) + seq(SEQ)
 * 2. id는 기존 FK 참조 호환용 @Column (자동 생성, 업데이트 불가)
 * 3. PROD_RESULT_ID(number)로 ProdResult를 참조
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProdResult } from './prod-result.entity';

@Entity({ name: 'DEFECT_LOGS' })
@Index(['prodResultId'])
@Index(['defectCode'])
@Index(['status'])
export class DefectLog {
  @PrimaryColumn({ name: 'OCCUR_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurAt: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'ID', type: 'int', generated: true, insert: false, update: false })
  id: number;

  @Column({ name: 'PROD_RESULT_ID', type: 'int' })
  prodResultId: number;

  @ManyToOne(() => ProdResult, (prodResult) => prodResult.defectLogs)
  @JoinColumn({ name: 'PROD_RESULT_ID' })
  prodResult: ProdResult;

  @Column({ name: 'DEFECT_CODE', length: 50 })
  defectCode: string;

  @Column({ name: 'DEFECT_NAME', length: 100, nullable: true })
  defectName: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'STATUS', length: 50, default: 'WAIT' })
  status: string;

  @Column({ name: 'CAUSE', length: 500, nullable: true })
  cause: string | null;

  @Column({ name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
