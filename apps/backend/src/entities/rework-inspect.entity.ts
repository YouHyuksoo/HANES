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
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkOrder } from './rework-order.entity';

@Entity('rework_inspects')
@Index(['company', 'plant', 'reworkOrderId'])
export class ReworkInspect {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rework_order_id' })
  reworkOrderId: number;

  @ManyToOne(() => ReworkOrder)
  @JoinColumn({ name: 'rework_order_id' })
  reworkOrder: ReworkOrder;

  @Column({ name: 'inspector_code', length: 50 })
  inspectorCode: string;

  @Column({ name: 'inspect_at', type: 'timestamptz', nullable: true })
  inspectAt: Date;

  @Column({ name: 'inspect_method', length: 500, nullable: true })
  inspectMethod: string;

  @Column({ name: 'inspect_result', length: 30 })
  inspectResult: string;

  @Column({ name: 'pass_qty', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'fail_qty', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'defect_detail', length: 1000, nullable: true })
  defectDetail: string;

  @Column({ name: 'remarks', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'company', type: 'int' })
  company: number;

  @Column({ name: 'plant', length: 20 })
  plant: string;

  @Column({ name: 'created_by', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
