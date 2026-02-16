import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'WORKER_MASTERS' })
@Unique(['WORKER_CODE'])
@Index(['DEPT'])
export class WorkerMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WORKER_CODE', length: 255, unique: true })
  workerCode: string;

  @Column({ name: 'WORKER_NAME', length: 255 })
  workerName: string;

  @Column({ name: 'ENG_NAME', length: 255, nullable: true })
  engName: string | null;

  @Column({ name: 'DEPT', length: 255, nullable: true })
  dept: string | null;

  @Column({ name: 'POSITION', length: 255, nullable: true })
  position: string | null;

  @Column({ name: 'PHONE', length: 255, nullable: true })
  phone: string | null;

  @Column({ name: 'EMAIL', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'HIRE_DATE', length: 255, nullable: true })
  hireDate: string | null;

  @Column({ name: 'QUIT_DATE', length: 255, nullable: true })
  quitDate: string | null;

  @Column({ name: 'QR_CODE', length: 255, nullable: true })
  qrCode: string | null;

  @Column({ name: 'PHOTO_URL', length: 255, nullable: true })
  photoUrl: string | null;

  @Column({ name: 'PROCESS_IDS', type: 'clob', nullable: true })
  processIds: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
