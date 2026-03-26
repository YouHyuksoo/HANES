/**
 * @file seq-rule.entity.ts
 * @description 채번 규칙 마스터(SeqRule) 엔티티 — PKG_SEQ_GENERATOR가 참조하는 규칙 테이블
 *
 * 초보자 가이드:
 * 1. DOC_TYPE: 문서유형 PK (MAT_UID, FG_BARCODE, JOB_ORDER 등)
 * 2. PREFIX + DATE_FORMAT + SEQ_NAME → 자동 번호 생성 규칙
 * 3. 시스템 설정 화면에서 채번 규칙을 관리할 수 있음
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'SEQ_RULES' })
export class SeqRule {
  @PrimaryColumn({ name: 'DOC_TYPE', length: 30 })
  docType: string;

  @Column({ name: 'PREFIX', length: 10 })
  prefix: string;

  @Column({ name: 'SEQ_NAME', length: 30 })
  seqName: string;

  @Column({ name: 'PAD_LENGTH', type: 'int', default: 5 })
  padLength: number;

  @Column({ type: 'varchar2', name: 'DATE_FORMAT', length: 10, nullable: true })
  dateFormat: string | null;

  @Column({ name: 'SEPARATOR', length: 2, default: '' })
  separator: string;

  @Column({ type: 'varchar2', name: 'DESCRIPTION', length: 100, nullable: true })
  description: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
