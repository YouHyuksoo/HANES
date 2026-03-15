/**
 * @file rework-inspect.entity.ts
 * @description 재작업 후 검사 엔티티 — IATF 16949 재작업 후 재검증 기록
 *
 * 초보자 가이드:
 * 1. ReworkOrder 완료 후 재검사 결과를 기록
 * 2. 검사 결과: PASS(합격), FAIL(불합격), SCRAP(폐기)
 * 3. 재작업 후 요구사항 충족 여부를 재검증하는 IATF 필수 프로세스
 */
import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkOrder } from './rework-order.entity';

@Entity({ name: 'REWORK_INSPECTS' })
@Index(['company', 'plant', 'reworkOrderId'])
export class ReworkInspect {
  @PrimaryColumn({ name: 'REWORK_ORDER_ID' })
  reworkOrderId: number;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @ManyToOne(() => ReworkOrder)
  @JoinColumn({ name: 'REWORK_ORDER_ID' })
  reworkOrder: ReworkOrder;

  @Column({ name: 'INSPECTOR_CODE', length: 50 })
  inspectorCode: string;

  @Column({ name: 'INSPECT_AT', type: 'timestamp', nullable: true })
  inspectAt: Date;

  @Column({ name: 'INSPECT_METHOD', length: 500, nullable: true })
  inspectMethod: string;

  @Column({ name: 'INSPECT_RESULT', length: 30 })
  inspectResult: string;

  @Column({ name: 'PASS_QTY', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'FAIL_QTY', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'DEFECT_DETAIL', length: 1000, nullable: true })
  defectDetail: string;

  @Column({ name: 'REMARKS', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string;

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
