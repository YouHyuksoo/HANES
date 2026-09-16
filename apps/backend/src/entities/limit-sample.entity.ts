/**
 * @file limit-sample.entity.ts
 * @description 양불마스터 엔티티 — 양품/불량 한도견본 (검사 전 대조용)
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + SAMPLE_CODE (검사보조구 마스터와 같은 복합 PK 패턴)
 * 2. SAMPLE_TYPE은 공통코드 LIMIT_SAMPLE_TYPE(OK 양품견본 / NG 불량견본)
 * 3. STATUS: ACTIVE(사용중) / EXPIRED(만료) / RETIRED(폐기) — 공통코드 LIMIT_SAMPLE_STATUS
 * 4. VALID_TO 기준으로 만료·임박(기본 30일) 목록을 GET /expiring 으로 조회한다.
 * 5. 사진은 이 테이블에 없다. LIMIT_SAMPLE_IMAGES가 단일출처이고 대표 1장은 IS_PRIMARY='Y'.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'LIMIT_SAMPLES' })
export class LimitSample {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'SAMPLE_CODE', length: 50 })
  sampleCode: string;

  @Column({ name: 'SAMPLE_TYPE', length: 30 })
  sampleType: string;

  @Column({ name: 'SAMPLE_NAME', length: 200 })
  sampleName: string;

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  /** 불량견본(NG)의 대표 불량코드 */
  @Column({ type: 'varchar2', name: 'DEFECT_CODE', length: 50, nullable: true })
  defectCode: string | null;

  /** 적용 검사유형 (COM_CODES INSPECT_TYPE). NULL = 전 검사유형 공통 */
  @Column({ type: 'varchar2', name: 'INSPECT_TYPE', length: 30, nullable: true })
  inspectType: string | null;

  @Column({ type: 'varchar2', name: 'LOCATION', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'VALID_FROM', type: 'date', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'VALID_TO', type: 'date', nullable: true })
  validTo: Date | null;

  @Column({ type: 'varchar2', name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'STATUS', length: 20, default: 'ACTIVE' })
  status: string;

  /** 검사 시작 전 대조 필수 여부 (Y=필수, N=참고용) */
  @Column({ name: 'REQUIRED_YN', length: 1, default: 'Y' })
  requiredYn: string;

  /** 대조 모달 표시 순서 */
  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
