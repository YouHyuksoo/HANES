/**
 * @file routing-process.entity.ts
 * @description 라우팅 그룹별 공정순서 엔티티
 *              복합 PK: ROUTING_CODE + SEQ
 *
 * 초보자 가이드:
 * 1. ROUTING_GROUPS의 하위 데이터로, 각 라우팅 그룹의 공정순서를 정의
 * 2. PROCESS_CODE: 공정마스터(PROCESS_MASTERS) 참조
 * 3. 하위에 PROCESS_QUALITY_CONDITIONS(양품조건) 보유
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ROUTING_PROCESSES' })
@Index(['routingCode'])
export class RoutingProcess {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ROUTING_CODE', length: 50 })
  routingCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @Column({ name: 'PROCESS_NAME', length: 200 })
  processName: string;

  @Column({ type: 'varchar2', name: 'PROCESS_TYPE', length: 50, nullable: true })
  processType: string | null;

  @Column({ type: 'varchar2', name: 'EQUIP_TYPE', length: 50, nullable: true })
  equipType: string | null;

  @Column({ type: 'varchar2', name: 'EXECUTION_TYPE', length: 20, default: 'IN_HOUSE' })
  executionType: 'IN_HOUSE' | 'SUBCON';

  /** 작업지시 생성 여부. N이면 검사/참조 공정으로 보고 OPERATION 작업지시를 만들지 않는다. */
  @Column({ type: 'varchar2', name: 'JOB_ORDER_YN', length: 1, default: 'Y' })
  jobOrderYn: string;

  @Column({ type: 'varchar2', name: 'SUBCON_VENDOR_CODE', length: 50, nullable: true })
  subconVendorCode: string | null;

  @Column({ name: 'STD_TIME', type: 'decimal', precision: 10, scale: 4, nullable: true })
  stdTime: number | null;

  @Column({ name: 'SETUP_TIME', type: 'decimal', precision: 10, scale: 4, nullable: true })
  setupTime: number | null;

  @Column({ type: 'varchar2', name: 'SAMPLE_INSPECT_YN', length: 1, default: 'N', nullable: true })
  sampleInspectYn: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'QC_SELF_YN', length: 1, default: 'N', nullable: true })
  qcSelfYn: string | null;

  @Column({ type: 'varchar2', name: 'INSPECT_METHOD', length: 20, default: 'DIRECT', nullable: true })
  inspectMethod: string | null;

  @Column({ type: 'varchar2', name: 'DESTRUCTIVE_YN', length: 1, default: 'N', nullable: true })
  destructiveYn: string | null;

  /** 라벨 발행 종류: NONE / BUNDLE(묶음 추적 라벨) / SG(회로 반제품) / FG(완제품). 한 공정 한 종류. */
  @Column({ type: 'varchar2', name: 'ISSUE_LABEL_TYPE', length: 20, default: 'NONE', nullable: true })
  issueLabelType: string | null;

  @Column({ name: 'SAMPLE_QTY', type: 'number', default: 1, nullable: true })
  sampleQty: number | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
