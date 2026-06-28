/**
 * @file job-order.entity.ts
 * @description 작업지시(JobOrder) 엔티티 - 생산 작업지시 정보를 관리한다.
 *              orderNo를 자연키 PK로 사용하며, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ORDER_NO가 PK (UUID 대신 자연키)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. PARENT_ID로 부모 작업지시를 self-reference
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProdResult } from './prod-result.entity';
import { ItemMaster } from './item-master.entity';
import { RoutingGroup } from './routing-group.entity';
import { ProdPlan } from './prod-plan.entity';

@Entity({ name: 'JOB_ORDERS' })
@Index(['status'])
@Index(['planDate'])
@Index(['lineCode'])
export class JobOrder {
  @PrimaryColumn({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ type: 'varchar2', name: 'PARENT_ID', length: 50, nullable: true })
  parentOrderNo: string | null;

  @ManyToOne(() => JobOrder, (jo) => jo.children, { nullable: true })
  @JoinColumn({ name: 'PARENT_ID' })
  parent: JobOrder | null;

  @OneToMany(() => JobOrder, (jo) => jo.parent)
  children: JobOrder[];

  @Column({ type: 'varchar2', name: 'PLAN_NO', length: 50, nullable: true })
  planNo: string | null;

  @ManyToOne(() => ProdPlan, { nullable: true })
  @JoinColumn({ name: 'PLAN_NO' })
  prodPlan: ProdPlan | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => ItemMaster, { nullable: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'ITEM_CODE', referencedColumnName: 'itemCode' },
  ])
  part: ItemMaster | null;

  @Column({ type: 'varchar2', name: 'LINE_CODE', length: 255, nullable: true })
  lineCode: string | null;

  /** 라우팅 코드 - 품목 기반 자동 조회 */
  @Column({ type: 'varchar2', name: 'ROUTING_CODE', length: 50, nullable: true })
  routingCode: string | null;

  @ManyToOne(() => RoutingGroup, { nullable: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'ROUTING_CODE', referencedColumnName: 'routingCode' },
  ])
  routing: RoutingGroup | null;

  /** 동시생성 그룹의 최상위 ORDER_NO. 최상위 자신은 null */
  @Column({ type: 'varchar2', name: 'ROOT_ORDER_NO', length: 50, nullable: true })
  rootOrderNo: string | null;

  /** 대표 공정 코드 - 라우팅 첫 번째 SEQ에서 자동 상속 */
  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  /** 작업지시 종류: ITEM(BOM 품목 단위) / OPERATION(라우팅 공정 단위) */
  @Column({ type: 'varchar2', name: 'ORDER_KIND', length: 20, default: 'ITEM' })
  orderKind: 'ITEM' | 'OPERATION';

  /** OPERATION 작업지시의 라우팅 공정 순번 */
  @Column({ name: 'ROUTING_SEQ', type: 'number', nullable: true })
  routingSeq: number | null;

  /** 작업 설비 코드 - 생성 시 null, 이후 수동 배정 */
  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @Column({ name: 'PLAN_QTY', type: 'int' })
  planQty: number;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'PLAN_DATE', type: 'date', nullable: true })
  planDate: Date | null;

  @Column({ name: 'START_TIME', type: 'timestamp', nullable: true })
  startAt: Date | null;

  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endAt: Date | null;

  @Column({ name: 'PRIORITY', type: 'int', default: 5 })
  priority: number;

  @Column({ name: 'STATUS', length: 20, default: 'WAITING' })
  status: string;

  @Column({ type: 'varchar2', name: 'CUST_PO_NO', length: 50, nullable: true })
  custPoNo: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ERP_SYNC_YN', length: 1, default: 'N' })
  erpSyncYn: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => ProdResult, (prodResult) => prodResult.jobOrder)
  prodResults: ProdResult[];
}
