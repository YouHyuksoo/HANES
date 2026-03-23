/**
 * @file capa-request.entity.ts
 * @description CAPA(시정/예방조치) 요청 엔티티 — IATF 16949 10.2 부적합 시정/예방 조치
 *
 * 초보자 가이드:
 * 1. 부적합(불량, 클레임, 감사, 재작업) 발생 시 근본 원인 분석 및 시정/예방 조치 관리
 * 2. CORRECTIVE(시정): 발생한 문제의 재발 방지 / PREVENTIVE(예방): 잠재 문제의 사전 차단
 * 3. 상태 흐름: OPEN → ANALYZING → ACTION_PLANNED → IN_PROGRESS → VERIFYING → CLOSED
 * 4. PK: capaNo (자연키)
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'CAPA_REQUESTS' })
@Index(['company', 'plant', 'status'])
export class CAPARequest {
  @PrimaryColumn({ name: 'CAPA_NO', length: 30 })
  capaNo: string;

  @Column({ name: 'CAPA_TYPE', length: 20 })
  capaType: string;

  @Column({ name: 'SOURCE_TYPE', length: 30, nullable: true })
  sourceType: string;

  @Column({ name: 'SOURCE_ID', nullable: true })
  sourceId: number;

  @Column({ name: 'TITLE', length: 200 })
  title: string;

  @Column({ name: 'DESCRIPTION', length: 2000, nullable: true })
  description: string;

  @Column({ name: 'ROOT_CAUSE', length: 2000, nullable: true })
  rootCause: string;

  @Column({ name: 'ACTION_PLAN', length: 2000, nullable: true })
  actionPlan: string;

  @Column({ name: 'TARGET_DATE', type: 'date', nullable: true })
  targetDate: Date;

  @Column({ name: 'RESPONSIBLE_CODE', length: 50, nullable: true })
  responsibleCode: string;

  @Column({ name: 'STATUS', length: 20, default: 'OPEN' })
  status: string;

  @Column({ name: 'PRIORITY', length: 20, nullable: true })
  priority: string;

  @Column({ name: 'VERIFICATION_RESULT', length: 1000, nullable: true })
  verificationResult: string;

  @Column({ name: 'VERIFIED_BY', length: 50, nullable: true })
  verifiedBy: string;

  @Column({ name: 'VERIFIED_AT', type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'CLOSED_AT', type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string;

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
