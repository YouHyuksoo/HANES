import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'VENDOR_MASTERS' })
@Index(['VENDOR_TYPE'])
export class VendorMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'VENDOR_CODE', length: 50, unique: true })
  vendorCode: string;

  @Column({ name: 'VENDOR_NAME', length: 255 })
  vendorName: string;

  @Column({ name: 'BIZ_NO', length: 50, nullable: true })
  bizNo: string | null;

  @Column({ name: 'CEO_NAME', length: 100, nullable: true })
  ceoName: string | null;

  @Column({ name: 'ADDRESS', length: 500, nullable: true })
  address: string | null;

  @Column({ name: 'TEL', length: 50, nullable: true })
  tel: string | null;

  @Column({ name: 'FAX', length: 50, nullable: true })
  fax: string | null;

  @Column({ name: 'EMAIL', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'CONTACT_PERSON', length: 100, nullable: true })
  contactPerson: string | null;

  @Column({ name: 'VENDOR_TYPE', length: 50, nullable: true })
  vendorType: string | null;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
