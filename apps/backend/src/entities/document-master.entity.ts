/**
 * @file document-master.entity.ts
 * @description 문서관리 마스터 엔티티 — IATF 16949 7.5 문서화된 정보
 *
 * 초보자 가이드:
 * 1. 품질/공정 문서의 등록, 개정, 승인, 폐기 관리
 * 2. 상태 흐름: DRAFT → REVIEW → APPROVED → OBSOLETE
 * 3. docNo 자동채번: DOC-YYYYMMDD-NNN
 * 4. revisionNo: 개정 시 버전 자동 증가
 * 5. retentionPeriod/expiresAt: 보존 기간 및 만료일 관리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'DOCUMENT_MASTERS' })
@Index(['company', 'plant', 'docType'])
@Index(['company', 'plant', 'status'])
export class DocumentMaster {
  @PrimaryColumn({ name: 'DOC_NO', length: 50 })
  docNo: string;

  @Column({ name: 'DOC_TITLE', length: 200 })
  docTitle: string;

  @Column({ name: 'DOC_TYPE', length: 30 })
  docType: string;

  @Column({ name: 'CATEGORY', length: 50, nullable: true })
  category: string;

  @Column({ name: 'REVISION_NO', type: 'int', default: 1 })
  revisionNo: number;

  @Column({ name: 'REVISION_DATE', type: 'timestamp', nullable: true })
  revisionDate: Date;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'FILE_PATH', length: 500, nullable: true })
  filePath: string;

  @Column({ name: 'FILE_SIZE', type: 'int', nullable: true })
  fileSize: number;

  @Column({ name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'RETENTION_PERIOD', type: 'int', nullable: true })
  retentionPeriod: number;

  @Column({ name: 'EXPIRES_AT', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'DESCRIPTION', length: 1000, nullable: true })
  description: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
