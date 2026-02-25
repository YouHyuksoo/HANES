/**
 * @file entities/partner-master.entity.ts
 * @description 거래처 마스터 엔티티 - 거래처(고객/협력사) 정보를 관리한다.
 *              partnerCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. partnerCode가 PK (UUID 대신 자연키)
 * 2. partnerType: CUSTOMER(고객), SUPPLIER(공급사) 등
 * 3. bizNo: 사업자등록번호
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PARTNER_MASTERS' })
@Index(['partnerType'])
export class PartnerMaster {
  @PrimaryColumn({ name: 'PARTNER_CODE', length: 50 })
  partnerCode: string;

  @Column({ name: 'PARTNER_NAME', length: 100 })
  partnerName: string;

  @Column({ name: 'PARTNER_TYPE', length: 50 })
  partnerType: string;

  @Column({ name: 'BIZ_NO', length: 50, nullable: true })
  bizNo: string | null;

  @Column({ name: 'CEO_NAME', length: 50, nullable: true })
  ceoName: string | null;

  @Column({ name: 'ADDRESS', length: 255, nullable: true })
  address: string | null;

  @Column({ name: 'TEL', length: 50, nullable: true })
  tel: string | null;

  @Column({ name: 'FAX', length: 50, nullable: true })
  fax: string | null;

  @Column({ name: 'EMAIL', length: 100, nullable: true })
  email: string | null;

  @Column({ name: 'CONTACT_PERSON', length: 50, nullable: true })
  contactPerson: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
