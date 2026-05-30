/**
 * @file entities/self-inspect-item.entity.ts
 * @description 자주검사 항목 마스터 엔티티
 *
 * 초보자 가이드:
 * - 공정(PROCESS_CODE) 기준으로 검사항목을 정의
 * - 검사 방법: DIRECT(직접검사), DELEGATE(의뢰검사)
 * - 검사 시점: FIRST(초물), MID(중물), LAST(종물) — 복수 선택 가능 (콤마 구분)
 * - 파괴검사 여부: isDestructive
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'SELF_INSPECT_ITEMS' })
@Index(['processCode'])
@Index(['company', 'plant'])
export class SelfInspectItem {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ type: 'varchar2', name: 'STANDARD', length: 500, nullable: true })
  standard: string | null;

  /** DIRECT | DELEGATE */
  @Column({ name: 'INSPECT_METHOD', length: 20, default: 'DIRECT' })
  inspectMethod: string;

  /** FIRST,MID,LAST 중 콤마 구분 복수 선택 */
  @Column({ name: 'TIMING', length: 50, default: 'MID' })
  timing: string;

  /** 파괴검사 여부 */
  @Column({ name: 'IS_DESTRUCTIVE', default: false })
  isDestructive: boolean;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  /** MEASURE(측정형) | VISUAL(판정형) */
  @Column({ name: 'ITEM_TYPE', length: 20, default: 'VISUAL' })
  itemType: string;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'LSL_VALUE', type: 'number', nullable: true })
  lslValue: number | null;

  @Column({ name: 'USL_VALUE', type: 'number', nullable: true })
  uslValue: number | null;

  /** 초물 시료 수 (FIRST 시점에만 적용, MID/LAST는 항상 1) */
  @Column({ name: 'SAMPLE_COUNT', type: 'number', default: 1 })
  sampleCount: number;

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
