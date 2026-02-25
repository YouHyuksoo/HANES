/**
 * @file entities/vendor-barcode-mapping.entity.ts
 * @description 자재 제조사 바코드 매핑 엔티티
 *              SEQUENCE(패턴 B)를 사용한다. partId -> itemCode 변경.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. vendorBarcode: 제조사 바코드 값 (유니크)
 * 3. itemCode: MES 품목코드 (ITEM_MASTERS.ITEM_CODE 참조)
 * 4. matchType: EXACT(정확히), PREFIX(접두사), REGEX(정규식)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'VENDOR_BARCODE_MAPPINGS' })
@Index(['vendorBarcode'], { unique: true })
@Index(['itemCode'])
@Index(['vendorCode'])
export class VendorBarcodeMapping {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  /** 제조사 바코드 값 (스캔 원본) */
  @Column({ name: 'VENDOR_BARCODE', length: 200 })
  vendorBarcode: string;

  /** MES 품목코드 (ITEM_MASTERS.ITEM_CODE 참조) */
  @Column({ name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  /** MES 품명 (조회 편의용) */
  @Column({ name: 'ITEM_NAME', length: 100, nullable: true })
  itemName: string | null;

  /** 제조사 코드 (VENDOR_MASTERS 참조) */
  @Column({ name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  /** 제조사명 (조회 편의용) */
  @Column({ name: 'VENDOR_NAME', length: 100, nullable: true })
  vendorName: string | null;

  /** 매핑 규칙 설명 (예: 접두사 매칭, 정규식 등) */
  @Column({ name: 'MAPPING_RULE', length: 200, nullable: true })
  mappingRule: string | null;

  /** 바코드 유형 (EXACT: 정확히, PREFIX: 접두사, REGEX: 정규식) */
  @Column({ name: 'MATCH_TYPE', length: 20, default: 'EXACT' })
  matchType: string;

  /** 비고 */
  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  /** 사용여부 */
  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
