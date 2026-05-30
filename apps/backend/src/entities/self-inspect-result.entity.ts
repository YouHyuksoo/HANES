/**
 * @file entities/self-inspect-result.entity.ts
 * @description 자주검사 결과 엔티티
 *
 * 초보자 가이드:
 * - 검사 시점(timing): FIRST(초물), MID(중물), LAST(종물)
 * - 직접검사: status PASS | FAIL 즉시 결정
 * - 의뢰검사: status PENDING → 별도 화면에서 PASS | FAIL 업데이트
 * - status가 PENDING인 의뢰검사가 있으면 키오스크 실적입력 차단
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'SELF_INSPECT_RESULTS' })
@Index(['orderNo'])
@Index(['status'])
@Index(['company', 'plant'])
export class SelfInspectResult {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar2', name: 'INSPECT_ITEM_ID', length: 36, nullable: true })
  inspectItemId: string | null;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  /** FIRST | MID | LAST */
  @Column({ name: 'TIMING', length: 20 })
  timing: string;

  /** DIRECT | DELEGATE */
  @Column({ name: 'INSPECT_METHOD', length: 20, default: 'DIRECT' })
  inspectMethod: string;

  /** PASS | FAIL | PENDING (의뢰검사 대기) */
  @Column({ name: 'STATUS', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'PROD_QTY_AT_INSPECT', type: 'number', nullable: true })
  prodQtyAtInspect: number | null;

  @Column({ type: 'varchar2', name: 'INSPECTOR_ID', length: 50, nullable: true })
  inspectorId: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  /** 시료 번호 (1부터 시작; FIRST 초물 N개 시료, MID/LAST는 1) */
  @Column({ name: 'SAMPLE_NO', type: 'number', default: 1 })
  sampleNo: number;

  /** 측정값 (MEASURE 타입 항목만; VISUAL은 null) */
  @Column({ name: 'MEASURE_VALUE', type: 'number', nullable: true })
  measureValue: number | null;

  @Column({ name: 'INSPECTED_AT', type: 'timestamp', nullable: true })
  inspectedAt: Date | null;

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
}
