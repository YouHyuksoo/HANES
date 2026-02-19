import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'USER_AUTHS' })
@Unique(['userId', 'menuCode'])
@Index(['userId'])
export class UserAuth {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'USER_ID', length: 255 })
  userId: string;

  @Column({ name: 'MENU_CODE', length: 100 })
  menuCode: string;

  @Column({ name: 'CAN_READ', default: true })
  canRead: boolean;

  @Column({ name: 'CAN_WRITE', default: false })
  canWrite: boolean;

  @Column({ name: 'CAN_DELETE', default: false })
  canDelete: boolean;

  @Column({ name: 'CAN_EXPORT', default: false })
  canExport: boolean;

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
