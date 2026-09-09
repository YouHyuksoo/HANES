/**
 * @file terminal-crimp-spec.entity.ts
 * @description 단자별 압착 규격 마스터 엔티티 — 단자 품목 × 전선 사이즈별 압착 상하한
 *
 * 초보자 가이드:
 * 1. PK SPEC_ID는 Oracle SEQUENCE(SEQ_TERMINAL_CRIMP_SPEC)로 채번한다(서비스에서 NEXTVAL 조회).
 * 2. (COMPANY, PLANT_CD, TERMINAL_ITEM_CODE, WIRE_SIZE) UNIQUE — 같은 단자·전선 조합은 1건.
 * 3. 수치 컬럼은 전부 NUMBER(10,3) nullable — 없는 항목은 null 그대로 둔다(추측 채움 금지).
 * 4. resolve API(단자품목+전선사이즈)가 자주검사·계측 판정의 조회 지점이 된다.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'TERMINAL_CRIMP_SPECS' })
@Index('UK_TERMINAL_CRIMP_SPECS', ['company', 'plant', 'terminalItemCode', 'wireSize'], { unique: true })
export class TerminalCrimpSpec {
  @PrimaryColumn({ name: 'SPEC_ID', type: 'number' })
  specId: number;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ name: 'TERMINAL_ITEM_CODE', length: 50 })
  terminalItemCode: string;

  @Column({ type: 'varchar2', name: 'TERMINAL_TYPE', length: 30, nullable: true })
  terminalType: string | null;

  @Column({ name: 'WIRE_SIZE', length: 50 })
  wireSize: string;

  @Column({ type: 'varchar2', name: 'WIRE_ITEM_CODE', length: 50, nullable: true })
  wireItemCode: string | null;

  @Column({ name: 'CRIMP_HEIGHT_LSL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  crimpHeightLsl: number | null;

  @Column({ name: 'CRIMP_HEIGHT_USL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  crimpHeightUsl: number | null;

  @Column({ name: 'CRIMP_WIDTH_LSL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  crimpWidthLsl: number | null;

  @Column({ name: 'CRIMP_WIDTH_USL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  crimpWidthUsl: number | null;

  @Column({ name: 'INS_CRIMP_HEIGHT_LSL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  insCrimpHeightLsl: number | null;

  @Column({ name: 'INS_CRIMP_HEIGHT_USL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  insCrimpHeightUsl: number | null;

  @Column({ name: 'PULL_FORCE_MIN', type: 'decimal', precision: 10, scale: 3, nullable: true })
  pullForceMin: number | null;

  @Column({ name: 'STRIP_LENGTH_MIN', type: 'decimal', precision: 10, scale: 3, nullable: true })
  stripLengthMin: number | null;

  @Column({ name: 'STRIP_LENGTH_MAX', type: 'decimal', precision: 10, scale: 3, nullable: true })
  stripLengthMax: number | null;

  @Column({ type: 'varchar2', name: 'APPLICATOR_CODE', length: 50, nullable: true })
  applicatorCode: string | null;

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
