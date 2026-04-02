/**
 * @file defect-log.entity.ts
 * @description 불량이력(DefectLog) 엔티티 - 생산실적별 불량 정보를 기록한다.
 *              복합 PK(OCCUR_TIME + SEQ) 사용, prodResultNo는 string 타입으로 ProdResult 참조.
 *
 * 초보자 가이드:
 * 1. 복합 PK: occurAt(OCCUR_TIME) + seq(SEQ)
 * 2. PROD_RESULT_ID(string)로 ProdResult를 참조
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
@Index(['prodResultNo'])
@Index(['defectCode'])
@Index(['status'])
export class DefectLog {
  @PrimaryColumn({ name: 'OCCUR_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurAt: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ type: 'varchar2', name: 'PROD_RESULT_ID', length: 50, nullable: true })
  prodResultNo: string | null;

  @ManyToOne(() => ProdResult, (prodResult) => prodResult.defectLogs)
  @JoinColumn({ name: 'PROD_RESULT_ID', referencedColumnName: 'resultNo' })
  prodResult: ProdResult;

  @Column({ name: 'DEFECT_CODE', length: 50 })
  defectCode: string;

  @Column({ type: 'varchar2', name: 'DEFECT_NAME', length: 100, nullable: true })
  defectName: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'STATUS', length: 50, default: 'WAIT' })
  status: string;

  @Column({ type: 'varchar2', name: 'CAUSE', length: 500, nullable: true })
  cause: string | null;

  @Column({ type: 'varchar2', name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
