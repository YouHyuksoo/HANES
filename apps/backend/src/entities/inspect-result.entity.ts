/**
 * @file inspect-result.entity.ts
 * @description 검사결과(InspectResult) 엔티티 - 생산실적별 검사 결과를 기록한다.
 *              PK는 RESULT_NO (채번: SEQ_RULES 'INSPECT_RESULT').
 *
 * 초보자 가이드:
 * 1. RESULT_NO가 PK (문자열, SeqGeneratorService로 채번)
 * 2. PROD_RESULT_NO(string)로 ProdResult를 참조
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

@Entity({ name: 'INSPECT_RESULTS' })
@Index(['prodResultNo'])
@Index(['passYn'])
@Index(['serialNo'])
@Index(['inspectScope'])
export class InspectResult {
  @PrimaryColumn({ name: 'RESULT_NO', length: 30 })
  resultNo: string;

  @Column({ type: 'varchar2', name: 'PROD_RESULT_ID', length: 36, nullable: true })
  prodResultNo: string | null;

  @ManyToOne(() => ProdResult, (prodResult) => prodResult.inspectResults)
  @JoinColumn({ name: 'PROD_RESULT_ID', referencedColumnName: 'resultNo' })
  prodResult: ProdResult;

  @Column({ type: 'varchar2', name: 'SERIAL_NO', length: 50, nullable: true })
  serialNo: string | null;

  @Column({ type: 'varchar2', name: 'INSPECT_TYPE', length: 50, nullable: true })
  inspectType: string | null;

  @Column({ type: 'varchar2', name: 'INSPECT_SCOPE', length: 20, nullable: true, comment: '검사범위 (FULL: 전수검사, SAMPLE: 샘플링검사)' })
  inspectScope: string | null;

  @Column({ name: 'PASS_YN', length: 1, default: 'Y' })
  passYn: string;

  @Column({ type: 'varchar2', name: 'ERROR_CODE', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ type: 'varchar2', name: 'ERROR_DETAIL', length: 500, nullable: true })
  errorDetail: string | null;

  @Column({ name: 'INSPECT_DATA', type: 'clob', nullable: true })
  inspectData: string | null;

  @Column({ type: 'varchar2', name: 'FG_BARCODE', length: 30, nullable: true })
  fgBarcode: string | null;

  @Column({ name: 'INSPECT_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectAt: Date;

  @Column({ type: 'varchar2', name: 'INSPECTOR_ID', length: 36, nullable: true })
  inspectorId: string | null;

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
