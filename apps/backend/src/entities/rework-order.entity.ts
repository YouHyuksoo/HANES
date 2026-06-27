/**
 * @file rework-order.entity.ts
 * @description 재작업 지시 엔티티 — IATF 16949 8.7.1 부적합 출력물 재작업 관리
 *
 * 초보자 가이드:
 * 1. DefectLog에서 재작업 판정된 불량품에 대한 재작업 지시를 관리
 * 2. 2단계 승인: 품질담당 → 생산담당 순서로 승인
 * 3. 상태 흐름: REGISTERED → QC_PENDING → ... → PASS/FAIL/SCRAP
 */
import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ItemMaster } from './item-master.entity';
import { ProdLineMaster } from './prod-line-master.entity';
import { EquipMaster } from './equip-master.entity';

@Entity({ name: 'REWORK_ORDERS' })
@Index(['company', 'plant', 'status'])
export class ReworkOrder {
  @PrimaryColumn({ name: 'REWORK_NO', length: 50 })
  reworkNo: string;

  @Column({ type: 'varchar2', name: 'DEFECT_LOG_ID', length: 50, nullable: true })
  defectLogId: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => ItemMaster)
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'ITEM_CODE', referencedColumnName: 'itemCode' },
  ])
  item: ItemMaster;

  @Column({ type: 'varchar2', name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string;

  @Column({ type: 'varchar2', name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string;

  @Column({ name: 'REWORK_QTY', type: 'int', default: 0 })
  reworkQty: number;

  @Column({ type: 'varchar2', name: 'DEFECT_TYPE', length: 50, nullable: true })
  defectType: string;

  @Column({ type: 'varchar2', name: 'REWORK_METHOD', length: 500, nullable: true })
  reworkMethod: string;

  @Column({ name: 'STATUS', length: 20, default: 'REGISTERED' })
  @Index()
  status: string;

  @Column({ type: 'varchar2', name: 'QC_APPROVER_CODE', length: 50, nullable: true })
  qcApproverCode: string;

  @Column({ name: 'QC_APPROVED_AT', type: 'timestamp', nullable: true })
  qcApprovedAt: Date;

  @Column({ type: 'varchar2', name: 'QC_REJECT_REASON', length: 500, nullable: true })
  qcRejectReason: string;

  @Column({ type: 'varchar2', name: 'PROD_APPROVER_CODE', length: 50, nullable: true })
  prodApproverCode: string;

  @Column({ name: 'PROD_APPROVED_AT', type: 'timestamp', nullable: true })
  prodApprovedAt: Date;

  @Column({ type: 'varchar2', name: 'PROD_REJECT_REASON', length: 500, nullable: true })
  prodRejectReason: string;

  @Column({ type: 'varchar2', name: 'WORKER_CODE', length: 50, nullable: true })
  workerId: string;

  @Column({ type: 'varchar2', name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string;

  @ManyToOne(() => ProdLineMaster, { nullable: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'LINE_CODE', referencedColumnName: 'lineCode' },
  ])
  line: ProdLineMaster;

  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string;

  @ManyToOne(() => EquipMaster, { nullable: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'EQUIP_CODE', referencedColumnName: 'equipCode' },
  ])
  equip: EquipMaster;

  @Column({ name: 'START_AT', type: 'timestamp', nullable: true })
  startAt: Date;

  @Column({ name: 'END_AT', type: 'timestamp', nullable: true })
  endAt: Date;

  @Column({ name: 'RESULT_QTY', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'PASS_QTY', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'FAIL_QTY', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'ISOLATION_FLAG', type: 'number', default: 1 })
  isolationFlag: number;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string;

  @Column({ type: 'varchar2', name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 20 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
