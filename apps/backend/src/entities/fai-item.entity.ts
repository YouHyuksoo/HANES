/**
 * @file fai-item.entity.ts
 * @description 초물검사 항목 엔티티 — 검사항목별 규격/측정값/판정 기록
 *
 * 초보자 가이드:
 * 1. FaiRequest에 대한 개별 검사항목 (치수, 외관, 기능 등)
 * 2. 복합 PK: faiId + seq (부모 FK + 순번)
 * 3. SPEC_MIN/SPEC_MAX: 규격 범위, MEASURED_VALUE: 실제 측정값
 * 4. RESULT: OK(합격) / NG(불합격) — 측정값이 규격 범위 내인지 자동/수동 판정
 */
import {
  Entity, PrimaryColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { FaiRequest } from './fai-request.entity';

@Entity({ name: 'FAI_ITEMS' })
export class FaiItem {
  @PrimaryColumn({ name: 'FAI_ID' })
  faiId: number;

  @ManyToOne(() => FaiRequest, { nullable: false })
  @JoinColumn({ name: 'FAI_ID' })
  faiRequest: FaiRequest;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'INSPECT_ITEM', length: 200 })
  inspectItem: string;

  @Column({ name: 'SPEC_MIN', type: 'decimal', precision: 12, scale: 4, nullable: true })
  specMin: number;

  @Column({ name: 'SPEC_MAX', type: 'decimal', precision: 12, scale: 4, nullable: true })
  specMax: number;

  @Column({ name: 'MEASURED_VALUE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  measuredValue: number;

  @Column({ name: 'UNIT', length: 20, nullable: true })
  unit: string;

  @Column({ name: 'RESULT', length: 10, nullable: true })
  result: string;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
