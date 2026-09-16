/**
 * @file inspect-sample-check-item.entity.ts
 * @description 양불마스터 대조 샘플별 결과 — 기대결과(견본유형)와 검사기 실제결과를 비교한다.
 *
 * 초보자 가이드:
 * 1. EXPECTED_RESULT: 양품견본(OK)=PASS, 불량견본(NG)=FAIL
 * 2. ACTUAL_RESULT: 작업자가 입력한 검사기 실제 결과
 * 3. RESULT: 서버가 산출한 OK/NG (기대와 일치하면 OK)
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'INSPECT_SAMPLE_CHECK_ITEMS' })
export class InspectSampleCheckItem {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'CHECK_NO', length: 30 })
  checkNo: string;

  @PrimaryColumn({ name: 'SEQ_NO', type: 'number' })
  seqNo: number;

  @Column({ name: 'SAMPLE_CODE', length: 50 })
  sampleCode: string;

  @Column({ name: 'SAMPLE_TYPE', length: 30 })
  sampleType: string;

  @Column({ name: 'EXPECTED_RESULT', length: 10 })
  expectedResult: string;

  @Column({ name: 'ACTUAL_RESULT', length: 10 })
  actualResult: string;

  @Column({ name: 'RESULT', length: 10 })
  result: string;

  @Column({ name: 'SCANNED_AT', type: 'timestamp', nullable: true })
  scannedAt: Date | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
