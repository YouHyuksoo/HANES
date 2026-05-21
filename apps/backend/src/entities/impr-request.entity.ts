/**
 * @file entities/impr-request.entity.ts
 * @description 개선요청 엔티티 - 사용자가 UI 요소를 선택하여 등록한 개선요청 기록
 *
 * 초보자 가이드:
 * 1. IMPR_ID: UUID 문자열 PK (Oracle 시퀀스 대신 애플리케이션에서 uuid 생성)
 * 2. SCREENSHOT: CLOB 타입으로 base64 이미지 문자열 저장
 * 3. STATUS: PENDING → IN_PROGRESS → DONE 상태 흐름
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IMPR_REQUESTS' })
@Index(['status'])
@Index(['company', 'plantCd'])
export class ImprRequest {
  @PrimaryColumn({ name: 'IMPR_ID', type: 'varchar2', length: 36 })
  imprId: string;

  @Column({ name: 'PAGE_URL', type: 'varchar2', length: 500 })
  pageUrl: string;

  @Column({ type: 'varchar2', name: 'ELEMENT_TEXT', length: 1000, nullable: true })
  elementText: string | null;

  @Column({ type: 'varchar2', name: 'ELEMENT_TAG', length: 100, nullable: true })
  elementTag: string | null;

  @Column({ name: 'DESCRIPTION', type: 'varchar2', length: 2000 })
  description: string;

  @Column({ name: 'SCREENSHOT', type: 'clob', nullable: true })
  screenshot: string | null;

  /** PENDING | IN_PROGRESS | DONE */
  @Column({ name: 'STATUS', type: 'varchar2', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'REQUESTER_ID', type: 'varchar2', length: 100 })
  requesterId: string;

  @Column({ type: 'varchar2', name: 'REQUESTER_NM', length: 200, nullable: true })
  requesterNm: string | null;

  @Column({ name: 'COMPANY', type: 'varchar2', length: 10 })
  company: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 10 })
  plantCd: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
