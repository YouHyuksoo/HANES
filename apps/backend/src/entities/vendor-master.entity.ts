import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'VENDOR_MASTERS' })
@Index(['vendorType'])
export class VendorMaster {
  @PrimaryColumn({ name: 'VENDOR_CODE', length: 50 })
  vendorCode: string;

  @Column({ name: 'VENDOR_NAME', length: 255 })
  vendorName: string;

  @Column({ type: 'varchar2', name: 'BIZ_NO', length: 50, nullable: true })
  bizNo: string | null;

  @Column({ type: 'varchar2', name: 'CEO_NAME', length: 100, nullable: true })
  ceoName: string | null;

  @Column({ type: 'varchar2', name: 'ADDRESS', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar2', name: 'TEL', length: 50, nullable: true })
  tel: string | null;

  @Column({ type: 'varchar2', name: 'FAX', length: 50, nullable: true })
  fax: string | null;

  @Column({ type: 'varchar2', name: 'EMAIL', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar2', name: 'CONTACT_PERSON', length: 100, nullable: true })
  contactPerson: string | null;

  @Column({ type: 'varchar2', name: 'VENDOR_TYPE', length: 50, nullable: true })
  vendorType: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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

}
