import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MoldMaster } from '../../../entities/mold-master.entity';
import { MoldUsageLog } from '../../../entities/mold-usage-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import {
  CreateMoldDto,
  UpdateMoldDto,
  CreateMoldUsageDto,
  MoldQueryDto,
} from '../dto/mold.dto';

@Injectable()
export class MoldService {
  private readonly logger = new Logger(MoldService.name);

  constructor(
    @InjectRepository(MoldMaster)
    private readonly moldRepo: Repository<MoldMaster>,
    @InjectRepository(MoldUsageLog)
    private readonly usageRepo: Repository<MoldUsageLog>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepo: Repository<EquipMaster>,
    private readonly dataSource: DataSource,
  ) {}

  private async getNextUsageSeq(usageDate: Date, qr?: import('typeorm').QueryRunner): Promise<number> {
    const repo = qr ? qr.manager.getRepository(MoldUsageLog) : this.usageRepo;
    const result = await repo
      .createQueryBuilder('u')
      .select('NVL(MAX(u.seq), 0)', 'maxSeq')
      .where('u.usageDate = :usageDate', { usageDate })
      .getRawOne();
    return (result?.maxSeq ?? 0) + 1;
  }

  async findAll(query: MoldQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, status, moldType, search } = query;

    const qb = this.moldRepo.createQueryBuilder('m');

    if (company) qb.andWhere('m.company = :company', { company });
    if (plant) qb.andWhere('m.plant = :plant', { plant });
    if (status) qb.andWhere('m.status = :status', { status });
    if (moldType) qb.andWhere('m.moldType = :moldType', { moldType });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere('(m.moldCode LIKE :sCode OR m.moldName LIKE :sRaw)', {
        sCode: `%${upper}%`,
        sRaw: `%${search}%`,
      });
    }

    qb.orderBy('m.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  async findById(moldCode: string, company?: string, plant?: string) {
    const item = await this.moldRepo.findOne({
      where: {
        moldCode,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });

    if (!item) {
      throw new NotFoundException('Mold not found.');
    }
    return item;
  }

  async create(dto: CreateMoldDto, company: string, plant: string, userId: string) {
    const existing = await this.moldRepo.findOne({
      where: { moldCode: dto.moldCode, company, plant },
    });
    if (existing) {
      throw new BadRequestException(`Mold already exists: ${dto.moldCode}`);
    }

    const entity = this.moldRepo.create({
      ...dto,
      currentShots: 0,
      status: 'ACTIVE',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.moldRepo.save(entity);
    this.logger.log(`Mold created: ${dto.moldCode}`);
    return saved;
  }

  async update(moldCode: string, dto: UpdateMoldDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(moldCode, company, plant);
    if (item.status === 'SCRAPPED') {
      throw new BadRequestException('Cannot update scrapped mold.');
    }
    if ((dto as any).status !== undefined) {
      throw new BadRequestException('Mold status cannot be changed via generic update API.');
    }

    Object.assign(item, dto, { updatedBy: userId });
    return this.moldRepo.save(item);
  }

  async delete(moldCode: string, company?: string, plant?: string) {
    const item = await this.findById(moldCode, company, plant);
    const usageCount = await this.usageRepo.count({
      where: {
        moldCode,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });
    if (usageCount > 0) {
      throw new BadRequestException('Cannot delete mold with usage history.');
    }

    await this.moldRepo.remove(item);
    return { moldCode };
  }

  async addUsage(
    moldCode: string,
    dto: CreateMoldUsageDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const mold = await queryRunner.manager.findOne(MoldMaster, {
        where: { moldCode, company, plant },
      });
      if (!mold) {
        throw new NotFoundException('Mold not found.');
      }
      if (mold.status !== 'ACTIVE') {
        throw new BadRequestException('Usage can be recorded only for ACTIVE mold.');
      }

      const usageDate = dto.usageDate ? new Date(dto.usageDate) : new Date();
      const seq = await this.getNextUsageSeq(usageDate, queryRunner);

      const usage = queryRunner.manager.create(MoldUsageLog, {
        ...dto,
        usageDate,
        seq,
        moldCode,
        company,
        plant,
        createdBy: userId,
      });
      const saved = await queryRunner.manager.save(MoldUsageLog, usage);

      mold.currentShots += dto.shotCount;
      mold.updatedBy = userId;
      await queryRunner.manager.save(MoldMaster, mold);

      if (mold.guaranteedShots && mold.currentShots >= mold.guaranteedShots && dto.equipCode) {
        try {
          await queryRunner.manager.update(
            EquipMaster,
            { equipCode: dto.equipCode, company, plant },
            { status: 'INTERLOCK' },
          );
          this.logger.warn(
            `Mold guaranteed shots exceeded. INTERLOCK set: ${dto.equipCode} / ${mold.moldCode} (${mold.currentShots}/${mold.guaranteedShots})`,
          );
        } catch (err: unknown) {
          this.logger.error(`Failed to set INTERLOCK for equipment: ${dto.equipCode}`, err as Error);
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Mold usage logged: ${mold.moldCode}, shots=${dto.shotCount}, total=${mold.currentShots}`);
      return saved;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getUsageLogs(moldCode: string, company?: string, plant?: string) {
    return this.usageRepo.find({
      where: {
        moldCode,
        ...(company && { company }),
        ...(plant && { plant }),
      },
      order: { usageDate: 'DESC' },
    });
  }

  async getMaintenanceDue(company?: string, plant?: string) {
    const qb = this.moldRepo
      .createQueryBuilder('m')
      .where('m.status = :status', { status: 'ACTIVE' })
      .andWhere(
        '(m.maintenanceCycle IS NOT NULL AND m.currentShots >= (m.maintenanceCycle * FLOOR(m.currentShots / m.maintenanceCycle))' +
          ' AND MOD(m.currentShots, m.maintenanceCycle) >= m.maintenanceCycle * 0.9)' +
          ' OR (m.nextMaintenanceDate IS NOT NULL AND m.nextMaintenanceDate <= :futureDate)',
        {
          futureDate: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            return d;
          })(),
        },
      );

    if (company) qb.andWhere('m.company = :company', { company });
    if (plant) qb.andWhere('m.plant = :plant', { plant });

    qb.orderBy('m.currentShots', 'DESC');
    return qb.getMany();
  }

  async retire(moldCode: string, userId: string, company?: string, plant?: string) {
    const item = await this.findById(moldCode, company, plant);

    if (['RETIRED', 'SCRAPPED'].includes(item.status)) {
      throw new BadRequestException('Mold is already retired or scrapped.');
    }
    if (!['ACTIVE', 'MAINTENANCE'].includes(item.status)) {
      throw new BadRequestException(`Mold status ${item.status} cannot be retired.`);
    }

    item.status = 'RETIRED';
    item.updatedBy = userId;
    const saved = await this.moldRepo.save(item);
    this.logger.log(`Mold retired: ${item.moldCode}`);
    return saved;
  }
}
