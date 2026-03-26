/**
 * @file oqc-request-box.entity.ts
 * @description OQC 의뢰-박스 연결 엔티티 - 검사 의뢰에 포함된 박스 목록
 *              requestNo + boxNo 복합 PK를 사용한다.
 *
 * 초보자 가이드:
 * 1. requestNo + boxNo가 복합 PK (자연키)
 * 2. OQC_REQUEST_ID로 OqcRequest(검사의뢰)를 참조
 * 3. IS_SAMPLE: 'Y'면 샘플로 선정된 박스
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OqcRequest } from './oqc-request.entity';

@Entity({ name: 'OQC_REQUEST_BOXES' })
export class OqcRequestBox {
  @PrimaryColumn({ name: 'OQC_REQUEST_ID', length: 50 })
  requestNo: string;

  @PrimaryColumn({ name: 'BOX_NO', length: 50 })
  boxNo: string;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'IS_SAMPLE', length: 1, default: 'N' })
  isSample: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => OqcRequest, (req) => req.boxes)
  @JoinColumn({ name: 'OQC_REQUEST_ID' })
  oqcRequest: OqcRequest;
}
