import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'COMM_CONFIGS' })
@Index(['commType'])
export class CommConfig {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'CONFIG_NAME', length: 100, unique: true })
  configName: string;

  @Column({ name: 'COMM_TYPE', length: 50 })
  commType: string;

  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'HOST', length: 255, nullable: true })
  host: string | null;

  @Column({ name: 'PORT', type: 'int', nullable: true })
  port: number | null;

  @Column({ name: 'PORT_NAME', length: 50, nullable: true })
  portName: string | null;

  @Column({ name: 'BAUD_RATE', type: 'int', nullable: true })
  baudRate: number | null;

  @Column({ name: 'DATA_BITS', type: 'int', nullable: true })
  dataBits: number | null;

  @Column({ name: 'STOP_BITS', length: 10, nullable: true })
  stopBits: string | null;

  @Column({ name: 'PARITY', length: 10, nullable: true })
  parity: string | null;

  @Column({ name: 'FLOW_CONTROL', length: 20, nullable: true })
  flowControl: string | null;

  @Column({ name: 'LINE_ENDING', length: 10, nullable: true, default: 'NONE' })
  lineEnding: string | null;

  @Column({ name: 'EXTRA_CONFIG', type: 'clob', nullable: true })
  extraConfig: string | null;

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
