/**
 * @file ppap-submission.entity.ts
 * @description PPAP(Production Part Approval Process) 제출 엔티티 — IATF 16949 PPAP 승인
 *
 * 초보자 가이드:
 * 1. PPAP는 고객에게 양산 부품 승인을 받기 위한 프로세스 (Level 1~5)
 * 2. 18개 PPAP 요소(설계기록, DFMEA, 관리계획서 등)를 boolean 플래그로 관리
 * 3. 상태 흐름: DRAFT → SUBMITTED → APPROVED / REJECTED / INTERIM
 * 4. ppapNo 자동채번: PPAP-YYYYMMDD-NNN
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PartMaster } from './part-master.entity';

@Entity({ name: 'PPAP_SUBMISSIONS' })
@Index(['company', 'plant', 'itemCode'])
@Index(['company', 'plant', 'status'])
export class PpapSubmission {
  @PrimaryColumn({ name: 'PPAP_NO', length: 50 })
  ppapNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string;

  @Column({ name: 'CUSTOMER_CODE', length: 50, nullable: true })
  customerCode: string;

  @Column({ name: 'CUSTOMER_NAME', length: 200, nullable: true })
  customerName: string;

  @Column({ name: 'PPAP_LEVEL', type: 'int', default: 3 })
  ppapLevel: number;

  @Column({ name: 'REASON', length: 30 })
  reason: string;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'SUBMITTED_AT', type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string;

  @Column({ name: 'REJECTED_REASON', length: 1000, nullable: true })
  rejectedReason: string;

  // =============================================
  // 18 PPAP Elements (boolean flags, number 0/1)
  // =============================================

  @Column({ name: 'DESIGN_RECORDS', type: 'number', default: 0 })
  designRecords: number;

  @Column({ name: 'ECN_DOCUMENTS', type: 'number', default: 0 })
  ecnDocuments: number;

  @Column({ name: 'CUSTOMER_APPROVAL', type: 'number', default: 0 })
  customerApproval: number;

  @Column({ name: 'DFMEA', type: 'number', default: 0 })
  dfmea: number;

  @Column({ name: 'PROCESS_FLOW_DIAGRAM', type: 'number', default: 0 })
  processFlowDiagram: number;

  @Column({ name: 'PFMEA', type: 'number', default: 0 })
  pfmea: number;

  @Column({ name: 'CONTROL_PLAN', type: 'number', default: 0 })
  controlPlan: number;

  @Column({ name: 'MSA_STUDIES', type: 'number', default: 0 })
  msaStudies: number;

  @Column({ name: 'DIMENSIONAL_RESULTS', type: 'number', default: 0 })
  dimensionalResults: number;

  @Column({ name: 'MATERIAL_TEST_RESULTS', type: 'number', default: 0 })
  materialTestResults: number;

  @Column({ name: 'INITIAL_PROCESS_STUDIES', type: 'number', default: 0 })
  initialProcessStudies: number;

  @Column({ name: 'QUALIFIED_LAB_DOC', type: 'number', default: 0 })
  qualifiedLabDoc: number;

  @Column({ name: 'APPEARANCE_APPROVAL', type: 'number', default: 0 })
  appearanceApproval: number;

  @Column({ name: 'SAMPLE_PRODUCT', type: 'number', default: 0 })
  sampleProduct: number;

  @Column({ name: 'MASTER_SAMPLE', type: 'number', default: 0 })
  masterSample: number;

  @Column({ name: 'CHECKING_AIDS', type: 'number', default: 0 })
  checkingAids: number;

  @Column({ name: 'CUSTOMER_SPECIFIC_REQ', type: 'number', default: 0 })
  customerSpecificReq: number;

  @Column({ name: 'PART_SUBMISSION_WARRANT', type: 'number', default: 0 })
  partSubmissionWarrant: number;

  // =============================================
  // 기타 필드
  // =============================================

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string;

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

  // =============================================
  // Relations
  // =============================================

  @ManyToOne(() => PartMaster)
  @JoinColumn({ name: 'ITEM_CODE', referencedColumnName: 'itemCode' })
  part: PartMaster;
}
