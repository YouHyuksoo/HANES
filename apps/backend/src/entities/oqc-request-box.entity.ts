/**
 * @file src/entities/oqc-request-box.entity.ts
 * @description OQC 의뢰-박스 연결 엔티티 - 검사 의뢰에 포함된 박스 목록
 *
 * 초보자 가이드:
 * 1. **목적**: OQC 의뢰에 어떤 박스가 포함되었는지 관리
 * 2. **IS_SAMPLE**: 'Y'면 샘플로 선정된 박스
 * 3. **관계**: OqcRequest(부모) 1:N OqcRequestBox
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OqcRequest } from './oqc-request.entity';

@Entity({ name: 'OQC_REQUEST_BOXES' })
@Index(['oqcRequestId'])
@Index(['boxId'])
export class OqcRequestBox {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'OQC_REQUEST_ID', length: 36 })
  oqcRequestId: string;

  @Column({ name: 'BOX_ID', length: 36 })
  boxId: string;

  @Column({ name: 'BOX_NO', length: 50, nullable: true })
  boxNo: string | null;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'IS_SAMPLE', length: 1, default: 'N' })
  isSample: string;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => OqcRequest, (req) => req.boxes)
  @JoinColumn({ name: 'OQC_REQUEST_ID' })
  oqcRequest: OqcRequest;
}
