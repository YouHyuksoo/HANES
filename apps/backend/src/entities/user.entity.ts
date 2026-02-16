import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'users' })
@Index(['ROLE'])
@Index(['STATUS'])
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'EMAIL', length: 255, unique: true })
  email: string;

  @Column({ name: 'PASSWORD', length: 255, default: 'admin123' })
  password: string;

  @Column({ name: 'NAME', length: 255, nullable: true })
  name: string | null;

  @Column({ name: 'EMP_NO', length: 50, nullable: true })
  empNo: string | null;

  @Column({ name: 'DEPT', length: 255, nullable: true })
  dept: string | null;

  @Column({ name: 'ROLE', length: 50, default: 'OPERATOR' })
  role: string;

  @Column({ name: 'STATUS', length: 50, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'LAST_LOGIN', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

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
