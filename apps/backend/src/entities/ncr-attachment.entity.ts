/**
 * @file src/entities/ncr-attachment.entity.ts
 * @description 부적합 보고서(NCR) 첨부파일 — 현상 사진, 측정 성적서, 고객 클레임 문서
 *
 * 초보자 가이드:
 * 1. PK 는 (COMPANY, PLANT_CD, NCR_NO, SEQ) 복합키다.
 * 2. SEQ 에는 DEFAULT 를 두지 않았다 — TypeORM 이 복합 PK 컬럼의 DB DEFAULT 를
 *    INSERT 에 채우지 않아 ORA-01400 이 나는 전례가 있었다(LABEL_PRINT_LOGS).
 *    서비스가 트랜잭션 안에서 count+1 로 명시 계산한다.
 * 3. 파일 실체는 uploads/ncr-attachments 에 있고 여기에는 경로만 있다.
 */
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'NCR_ATTACHMENTS' })
@Index(['company', 'plant', 'ncrNo'])
export class NcrAttachment {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plant: string;

  @PrimaryColumn({ name: 'NCR_NO', type: 'varchar2', length: 50 })
  ncrNo: string;

  /** 보고서 내 순번 — 서비스가 count+1 로 채운다 */
  @PrimaryColumn({ name: 'SEQ', type: 'number' })
  seq: number;

  /** 업로드 당시 원본 파일명 */
  @Column({ name: 'FILE_NAME', type: 'varchar2', length: 255 })
  fileName: string;

  /** uploads 기준 저장 경로 */
  @Column({ name: 'FILE_PATH', type: 'varchar2', length: 500 })
  filePath: string;

  @Column({ name: 'FILE_SIZE', type: 'number', nullable: true })
  fileSize: number | null;

  @Column({ name: 'MIME_TYPE', type: 'varchar2', length: 100, nullable: true })
  mimeType: string | null;

  /** IMAGE=인쇄 양식에 사진으로 싣는다 / DOC=링크로만 노출 */
  @Column({ name: 'KIND', type: 'varchar2', length: 20, default: 'DOC' })
  kind: string;

  @Column({ name: 'REMARK', type: 'varchar2', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
