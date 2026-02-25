/**
 * @file entities/company-master.entity.ts
 * @description 회사 마스터 엔티티 - 회사 정보를 관리한다.
 *              복합 PK: (companyCode, plant). 패턴 C.
 *
 * 초보자 가이드:
 * 1. 복합 PK: companyCode + plant
 * 2. bizNo: 사업자등록번호
 * 3. 한 회사가 여러 공장(plant)을 가질 수 있음
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'COMPANY_MASTERS' })
export class CompanyMaster {
  @PrimaryColumn({ name: 'COMPANY_CODE', length: 50 })
  companyCode: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50, default: '-' })
  plant: string;

  @Column({ name: 'COMPANY_NAME', length: 100 })
  companyName: string;

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

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
