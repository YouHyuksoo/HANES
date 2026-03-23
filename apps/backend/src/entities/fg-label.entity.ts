/**
 * @file fg-label.entity.ts
 * @description 완제품 바코드 라벨 마스터(FgLabel) 엔티티
 *              통전검사 합격 시 FG_BARCODE가 채번되어 등록된다.
 *              이후 외관검사, 포장, 출하 공정에서 이 바코드로 제품을 추적한다.
 *
 * 초보자 가이드:
 * 1. FG_BARCODE: PKG_SEQ_GENERATOR.GET_NO('FG_BARCODE')로 자동 채번
 * 2. STATUS 흐름: ISSUED → VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED
 * 3. REPLACED_BY: 라벨 재발행 시 새 바코드를 기록 (자기참조)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'FG_LABELS' })
@Index(['itemCode'])
@Index(['orderNo'])
@Index(['status'])
export class FgLabel {
  @PrimaryColumn({ name: 'FG_BARCODE', length: 30 })
  fgBarcode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string | null;

  @Column({ name: 'ISSUED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @Column({ name: 'STATUS', length: 20, default: 'ISSUED' })
  status: string;

  @Column({ name: 'REPRINT_COUNT', type: 'int', default: 0 })
  reprintCount: number;

  @Column({ name: 'VOID_REASON', length: 200, nullable: true })
  voidReason: string | null;

  @Column({ name: 'REPLACED_BY', length: 30, nullable: true })
  replacedBy: string | null;

  @Column({ name: 'CUSTOMER_BARCODE', length: 100, nullable: true })
  customerBarcode: string | null;

  @Column({ name: 'INSPECT_RESULT_ID', length: 30, nullable: true })
  inspectResultId: string | null;

  @Column({ name: 'INSPECT_PASS_YN', length: 1, nullable: true })
  inspectPassYn: string | null;

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
}
