/**
 * @file inspect-result.entity.ts
 * @description 검사결과(InspectResult) 엔티티 - 생산실적별 검사 결과를 기록한다.
 *              PK는 RESULT_NO (채번: SEQ_RULES 'INSPECT_RESULT'), ID는 FK 호환용으로 유지.
 *
 * 초보자 가이드:
 * 1. RESULT_NO가 PK (문자열, SeqGeneratorService로 채번)
 * 2. ID는 FG_LABELS.inspectResultId FK 호환을 위해 @Column으로 유지 (auto-generated, 직접 설정 금지)
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

@Entity({ name: 'INSPECT_RESULTS' })
@Index(['prodResultId'])
@Index(['passYn'])
@Index(['serialNo'])
@Index(['inspectScope'])
export class InspectResult {
  @PrimaryColumn({ name: 'RESULT_NO', length: 30 })
  resultNo: string;

  @Column({ name: 'ID', type: 'int', generated: true, insert: false, update: false })
  id: number;

  @Column({ name: 'PROD_RESULT_ID', type: 'int', nullable: true })
  prodResultId: number | null;

  @ManyToOne(() => ProdResult, (prodResult) => prodResult.inspectResults)
  @JoinColumn({ name: 'PROD_RESULT_ID' })
  prodResult: ProdResult;

  @Column({ name: 'SERIAL_NO', length: 255, nullable: true })
  serialNo: string | null;

  @Column({ name: 'INSPECT_TYPE', length: 50, nullable: true })
  inspectType: string | null;

  @Column({ name: 'INSPECT_SCOPE', length: 20, nullable: true, comment: '검사범위 (FULL: 전수검사, SAMPLE: 샘플링검사)' })
  inspectScope: string | null;

  @Column({ name: 'PASS_YN', length: 1, default: 'Y' })
  passYn: string;

  @Column({ name: 'ERROR_CODE', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ name: 'ERROR_DETAIL', length: 500, nullable: true })
  errorDetail: string | null;

  @Column({ name: 'INSPECT_DATA', type: 'clob', nullable: true })
  inspectData: string | null;

  @Column({ name: 'FG_BARCODE', length: 30, nullable: true })
  fgBarcode: string | null;

  @Column({ name: 'INSPECT_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectAt: Date;

  @Column({ name: 'INSPECTOR_ID', length: 255, nullable: true })
  inspectorId: string | null;

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
