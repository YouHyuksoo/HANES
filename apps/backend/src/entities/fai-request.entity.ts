/**
 * @file fai-request.entity.ts
 * @description 초물검사(FAI) 요청 엔티티 — IATF 16949 8.3.4.4 신규/변경 품목 첫 생산품 검증
 *
 * 초보자 가이드:
 * 1. 신규 품목, ECN 변경, 공정 변경, 장기정지 후 재가동 시 초물검사를 요청
 * 2. 상태 흐름: REQUESTED → SAMPLING → INSPECTING → PASS / FAIL / CONDITIONAL
 * 3. FAI_ITEMS 테이블에 검사항목별 측정값/판정 기록
 * 4. PK: faiNo (자연키), id는 FK 호환용 자동증가 컬럼으로 유지
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'FAI_REQUESTS' })
@Index(['company', 'plant', 'status'])
export class FaiRequest {
  @Column({ name: 'ID', type: 'int', generated: true, insert: false, update: false })
  id: number;

  @PrimaryColumn({ name: 'FAI_NO', length: 30 })
  faiNo: string;

  @Column({ name: 'TRIGGER_TYPE', length: 30 })
  triggerType: string;

  @Column({ name: 'TRIGGER_REF', length: 100, nullable: true })
  triggerRef: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string;

  @Column({ name: 'SAMPLE_QTY', type: 'int', default: 1 })
  sampleQty: number;

  @Column({ name: 'INSPECTOR_CODE', length: 50, nullable: true })
  inspectorCode: string;

  @Column({ name: 'STATUS', length: 30, default: 'REQUESTED' })
  status: string;

  @Column({ name: 'INSPECT_DATE', type: 'date', nullable: true })
  inspectDate: Date;

  @Column({ name: 'RESULT', length: 20, nullable: true })
  result: string;

  @Column({ name: 'REMARKS', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'APPROVAL_CODE', length: 50, nullable: true })
  approvalCode: string;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
