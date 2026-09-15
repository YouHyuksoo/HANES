/**
 * @file entities/ncr-report.entity.ts
 * @description 부적합 보고서(NCR) — 부적합 1건을 문서번호로 묶어 처리·시정조치까지 추적
 *
 * 초보자 가이드:
 * 1. 부적합은 IQC_LOGS(수입검사)·INSPECT_RESULTS(공정/최종검사) 등 서로 다른 테이블에 쌓인다.
 *    NCR 은 독립 문서로 두고 어디서 발행하든 출처를 sourceType + sourceId 로 가리킨다.
 * 2. targetType(대상: 원자재/반제품/완제품/재공품)과 foundStage(발견공정)는 별개 축이다.
 *    원자재 불량을 조립공정에서 발견하는 경우가 있어 한 축으로 묶으면 통계가 틀어진다.
 * 3. 원인·재발방지는 이 문서가 직접 갖는다(양식이 본문에 요구 — 인쇄 시 조인 불필요).
 *    정식 시정조치가 필요한 건만 capaNo 로 CAPA_REQUESTS 에 연결한다.
 */
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'NCR_REPORTS' })
@Index(['company', 'plant', 'issuedAt'])
@Index(['company', 'plant', 'status'])
@Index(['sourceType', 'sourceId'])
export class NcrReport {
  @PrimaryColumn({ name: 'NCR_NO', length: 30 })
  ncrNo: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 50 })
  plant: string;

  // ── 발행 ──
  @Column({ name: 'ISSUED_AT', type: 'timestamp', default: () => 'SYSTIMESTAMP' })
  issuedAt: Date;

  /** 회신 요구일 — 원인분석·대책 회신 기한 */
  @Column({ type: 'date', name: 'DUE_DATE', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'varchar2', name: 'ISSUE_DEPT', length: 50, nullable: true })
  issueDept: string | null;

  @Column({ type: 'varchar2', name: 'WRITER_CODE', length: 50, nullable: true })
  writerCode: string | null;

  @Column({ name: 'WRITTEN_AT', type: 'timestamp', nullable: true })
  writtenAt: Date | null;

  // ── 분류 ──
  /** RAW_MATERIAL / SEMI_PRODUCT / FINISHED / WIP */
  @Column({ name: 'TARGET_TYPE', length: 20 })
  targetType: string;

  /** IQC / PROCESS / FINAL / OQC / CUSTOMER */
  @Column({ name: 'FOUND_STAGE', length: 20 })
  foundStage: string;

  // ── 출처 ──
  /** IQC_LOG / INSPECT_RESULT / DEFECT_LOG / COMPLAINT */
  @Column({ type: 'varchar2', name: 'SOURCE_TYPE', length: 30, nullable: true })
  sourceType: string | null;

  @Column({ type: 'varchar2', name: 'SOURCE_ID', length: 100, nullable: true })
  sourceId: string | null;

  // ── 대상 ──
  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'LOT_NO', length: 50, nullable: true })
  lotNo: string | null;

  @Column({ type: 'varchar2', name: 'SERIAL_NO', length: 50, nullable: true })
  serialNo: string | null;

  @Column({ type: 'varchar2', name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ type: 'varchar2', name: 'PO_NO', length: 50, nullable: true })
  poNo: string | null;

  @Column({ type: 'varchar2', name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ type: 'decimal', name: 'INSPECT_QTY', precision: 12, scale: 3, nullable: true })
  inspectQty: number | null;

  @Column({ type: 'decimal', name: 'DEFECT_QTY', precision: 12, scale: 3, nullable: true })
  defectQty: number | null;

  // ── 부적합 내용 ──
  @Column({ type: 'varchar2', name: 'DEFECT_CODE', length: 50, nullable: true })
  defectCode: string | null;

  @Column({ type: 'varchar2', name: 'CATEGORY_CODE', length: 50, nullable: true })
  categoryCode: string | null;

  /** CRITICAL / MAJOR / MINOR */
  @Column({ type: 'varchar2', name: 'DEFECT_GRADE', length: 20, nullable: true })
  defectGrade: string | null;

  @Column({ type: 'varchar2', name: 'DESCRIPTION', length: 2000, nullable: true })
  description: string | null;

  @Column({ type: 'varchar2', name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  // ── 처리방안 ──
  /** CONCESSION / REPAIR / REWORK / SCRAP / RETURN */
  @Column({ type: 'varchar2', name: 'DISPOSITION', length: 20, nullable: true })
  disposition: string | null;

  @Column({ type: 'varchar2', name: 'DISPOSITION_DETAIL', length: 2000, nullable: true })
  dispositionDetail: string | null;

  @Column({ type: 'date', name: 'DUE_ACTION_DATE', nullable: true })
  dueActionDate: Date | null;

  @Column({ type: 'varchar2', name: 'RESPONSIBLE_CODE', length: 50, nullable: true })
  responsibleCode: string | null;

  @Column({ name: 'RESPONDED_AT', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  // ── 원인 / 재발방지 ──
  /** 4M1E — MAN / MACHINE / METHOD / MEASUREMENT / ENVIRONMENT */
  @Column({ type: 'varchar2', name: 'CAUSE_CATEGORY', length: 20, nullable: true })
  causeCategory: string | null;

  @Column({ type: 'varchar2', name: 'ROOT_CAUSE', length: 2000, nullable: true })
  rootCause: string | null;

  @Column({ type: 'varchar2', name: 'PREVENTIVE_ACTION', length: 2000, nullable: true })
  preventiveAction: string | null;

  // ── 승인 / 종결 ──
  @Column({ type: 'varchar2', name: 'APPROVER_CODE', length: 50, nullable: true })
  approverCode: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  /** OPEN / IN_PROGRESS / CLOSED */
  @Column({ name: 'STATUS', length: 20, default: 'OPEN' })
  status: string;

  @Column({ name: 'CLOSED_AT', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'varchar2', name: 'CLOSED_BY', length: 50, nullable: true })
  closedBy: string | null;

  /** 정식 시정조치가 필요한 건에만 CAPA_REQUESTS 연결 */
  @Column({ type: 'varchar2', name: 'CAPA_NO', length: 30, nullable: true })
  capaNo: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 1000, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
