/**
 * @file customer-complaint.entity.ts
 * @description 고객클레임 엔티티 — IATF 16949 10.2.6 고객 불만 관리
 *
 * 초보자 가이드:
 * 1. 고객으로부터 접수된 품질/납기/파손 클레임을 관리
 * 2. 상태 흐름: RECEIVED → INVESTIGATING → RESPONDING → RESOLVED → CLOSED
 * 3. CAPA(시정/예방조치)와 연계 가능 (CAPA_ID)
 * 4. 8D 프로세스: 접수 → 조사 → 원인분석 → 봉쇄조치 → 시정조치 → 예방조치 → 종료
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMER_COMPLAINTS' })
@Index(['company', 'plant', 'status'])
export class CustomerComplaint {
  @PrimaryColumn({ name: 'COMPLAINT_NO', length: 50 })
  complaintNo: string;

  @Column({ name: 'CUSTOMER_CODE', length: 50 })
  customerCode: string;

  @Column({ name: 'CUSTOMER_NAME', length: 200, nullable: true })
  customerName: string;

  @Column({ name: 'COMPLAINT_DATE', type: 'date' })
  complaintDate: Date;

  @Column({ name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string;

  @Column({ name: 'LOT_NO', length: 100, nullable: true })
  lotNo: string;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'COMPLAINT_TYPE', length: 30 })
  complaintType: string;

  @Column({ name: 'DESCRIPTION', length: 2000, nullable: true })
  description: string;

  @Column({ name: 'URGENCY', length: 20, default: 'MEDIUM' })
  urgency: string;

  @Column({ name: 'STATUS', length: 20, default: 'RECEIVED' })
  status: string;

  @Column({ name: 'INVESTIGATION', length: 2000, nullable: true })
  investigation: string;

  @Column({ name: 'ROOT_CAUSE', length: 2000, nullable: true })
  rootCause: string;

  @Column({ name: 'CONTAINMENT_ACTION', length: 1000, nullable: true })
  containmentAction: string;

  @Column({ name: 'CORRECTIVE_ACTION', length: 1000, nullable: true })
  correctiveAction: string;

  @Column({ name: 'PREVENTIVE_ACTION', length: 1000, nullable: true })
  preventiveAction: string;

  @Column({ name: 'RESPONSE_DATE', type: 'date', nullable: true })
  responseDate: Date;

  @Column({ name: 'RESPONSIBLE_CODE', length: 50, nullable: true })
  responsibleCode: string;

  @Column({ name: 'CAPA_ID', length: 30, nullable: true })
  capaId: string | null;

  @Column({ name: 'COST_AMOUNT', type: 'decimal', precision: 12, scale: 2, nullable: true })
  costAmount: number;

  @Column({ name: 'RESOLVED_AT', type: 'timestamp', nullable: true })
  resolvedAt: Date;

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
