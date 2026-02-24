/**
 * @file src/entities/oqc-request.entity.ts
 * @description OQC(출하검사) 의뢰 엔티티 - 출하 전 제품 품질 검증 요청
 *
 * 초보자 가이드:
 * 1. **목적**: 출하 전 박스 단위 품질검사 의뢰 관리
 * 2. **상태 흐름**: PENDING(대기) → IN_PROGRESS(검사중) → PASS/FAIL(판정)
 * 3. **관계**: OqcRequest 1:N OqcRequestBox (의뢰에 여러 박스 연결)
 * 4. **details**: 검사 상세 데이터를 JSON(CLOB)으로 저장
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OqcRequestBox } from './oqc-request-box.entity';

@Entity({ name: 'OQC_REQUESTS' })
@Index(['status'])
@Index(['partId'])
@Index(['requestDate'])
export class OqcRequest {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'REQUEST_NO', length: 50, unique: true })
  requestNo: string;

  @Column({ name: 'PART_ID', length: 36 })
  partId: string;

  @Column({ name: 'CUSTOMER', length: 100, nullable: true })
  customer: string | null;

  @Column({ name: 'REQUEST_DATE', type: 'date' })
  requestDate: Date;

  @Column({ name: 'TOTAL_BOX_COUNT', type: 'int', default: 0 })
  totalBoxCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'int', default: 0 })
  totalQty: number;

  @Column({ name: 'SAMPLE_SIZE', type: 'int', nullable: true })
  sampleSize: number | null;

  @Column({ name: 'STATUS', length: 50, default: 'PENDING' })
  status: string;

  @Column({ name: 'RESULT', length: 50, nullable: true })
  result: string | null;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'INSPECT_DATE', type: 'timestamp', nullable: true })
  inspectDate: Date | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => OqcRequestBox, (box) => box.oqcRequest)
  boxes: OqcRequestBox[];
}
