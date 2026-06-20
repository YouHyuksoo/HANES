/**
 * @file iqc-log.entity.ts
 * @description IQC 검사이력(IqcLog) 엔티티 - 수입검사 결과를 기록한다.
 *              복합 PK(INSPECT_DATE + SEQ) 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. 복합 PK: inspectDate(INSPECT_DATE) + seq(SEQ)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. 검사유형(INITIAL/RETEST), 결과(PASS/FAIL) 관리
 * 4. inspectClass: 검사분류 legacy 컬럼. IQC 검사구분(검사/무검사)으로 사용하지 않는다.
 * 5. destructSampleQty: 파괴검사 시료 수량
 * 6. certFilePath: 검사성적서 파일 경로
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IQC_LOGS' })
@Index(['itemCode'])
@Index(['arrivalNo'])
@Index(['matUid'])
@Index(['inspectType'])
@Index(['result'])
export class IqcLog {
  @PrimaryColumn({ name: 'INSPECT_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 100, nullable: true })
  arrivalNo: string | null;

  @Column({ type: 'varchar2', name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;

  @Column({ name: 'ITEM_CODE', length: 255 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ name: 'INSPECT_TYPE', length: 50, default: 'INITIAL' })
  inspectType: string;

  @Column({ name: 'RESULT', length: 50, default: 'PASS' })
  result: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  /** 검사항목별 AQL 판정결과(JSON) */
  @Column({ name: 'ITEM_RESULTS', type: 'clob', nullable: true })
  itemResults: string | null;

  @Column({ type: 'varchar2', name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  /** 검사분류 legacy 컬럼. IQC 검사구분(검사/무검사)과 별개 */
  @Column({ type: 'varchar2', name: 'INSPECT_CLASS', length: 10, nullable: true, default: null })
  inspectClass: string | null;

  /** 파괴검사 시료 수량 */
  @Column({ name: 'DESTRUCT_SAMPLE_QTY', type: 'int', nullable: true, default: null })
  destructSampleQty: number | null;

  /** 검사성적서 파일 경로 */
  @Column({ type: 'varchar2', name: 'CERT_FILE_PATH', length: 500, nullable: true, default: null })
  certFilePath: string | null;

  /** 검사 시료 바코드(시리얼) — 입력/스캔. 여러 개는 콤마 구분 */
  @Column({ type: 'varchar2', name: 'SAMPLE_BARCODE', length: 500, nullable: true, default: null })
  sampleBarcode: string | null;

  @Column({ name: 'LOT_QTY', type: 'number', nullable: true, default: null })
  lotQty: number | null;

  @Column({ type: 'varchar2', name: 'AQL_INSPECTION_LEVEL', length: 20, nullable: true, default: null })
  aqlInspectionLevel: string | null;

  @Column({ type: 'varchar2', name: 'AQL_INSPECTION_MODE', length: 20, nullable: true, default: null })
  aqlInspectionMode: string | null;

  @Column({ name: 'AQL_SAMPLE_QTY', type: 'number', nullable: true, default: null })
  aqlSampleQty: number | null;

  @Column({ type: 'varchar2', name: 'AQL_MAJOR_CODE', length: 50, nullable: true, default: null })
  aqlMajorCode: string | null;

  @Column({ name: 'AQL_MAJOR_AC', type: 'number', nullable: true, default: null })
  aqlMajorAc: number | null;

  @Column({ name: 'AQL_MAJOR_RE', type: 'number', nullable: true, default: null })
  aqlMajorRe: number | null;

  @Column({ type: 'varchar2', name: 'AQL_MINOR_CODE', length: 50, nullable: true, default: null })
  aqlMinorCode: string | null;

  @Column({ name: 'AQL_MINOR_AC', type: 'number', nullable: true, default: null })
  aqlMinorAc: number | null;

  @Column({ name: 'AQL_MINOR_RE', type: 'number', nullable: true, default: null })
  aqlMinorRe: number | null;

  @Column({ name: 'DEFECT_CRITICAL', type: 'number', default: 0 })
  defectCritical: number;

  @Column({ name: 'DEFECT_MAJOR', type: 'number', default: 0 })
  defectMajor: number;

  @Column({ name: 'DEFECT_MINOR', type: 'number', default: 0 })
  defectMinor: number;

  @Column({ type: 'varchar2', name: 'AQL_JUDGE_REASON', length: 500, nullable: true, default: null })
  aqlJudgeReason: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

  /** 수명 재검사 회차 (inspectType=RETEST 전용) */
  @Column({ name: 'RETEST_ROUND', type: 'number', nullable: true, default: null })
  retestRound: number | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
