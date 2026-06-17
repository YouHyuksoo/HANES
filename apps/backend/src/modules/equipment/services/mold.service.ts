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
import { TransactionService } from '../../../shared/transaction.service';
import { getErrorMessage } from '../../../common/utils/error-message.util';
import { parseDateStart } from '../../../shared/date.util';

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
    private readonly tx: TransactionService,
  ) {}

  private async getNextUsageSeq(qr?: import('typeorm').QueryRunner): Promise<number> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      `SELECT SEQ_MOLD_USAGE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
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
      moldCode: dto.moldCode,
      moldName: dto.moldName,
      moldType: dto.moldType ?? null,
      itemCode: dto.itemCode ?? null,
      cavity: dto.cavity ?? 1,
      guaranteedShots: dto.guaranteedShots ?? null,
      maintenanceCycle: dto.maintenanceCycle ?? null,
      location: dto.location ?? null,
      maker: dto.maker ?? null,
      purchaseDate: parseDateStart(dto.purchaseDate),
      remark: dto.remark ?? null,
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
    if ('status' in dto) {
      throw new BadRequestException('Mold status cannot be changed via generic update API.');
    }

    const updateData: Partial<Pick<MoldMaster,
      | 'moldName'
      | 'moldType'
      | 'itemCode'
      | 'cavity'
      | 'guaranteedShots'
      | 'maintenanceCycle'
      | 'location'
      | 'maker'
      | 'purchaseDate'
      | 'remark'
    >> = {
      ...(dto.moldName !== undefined ? { moldName: dto.moldName } : {}),
      ...(dto.moldType !== undefined ? { moldType: dto.moldType } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.cavity !== undefined ? { cavity: dto.cavity } : {}),
      ...(dto.guaranteedShots !== undefined ? { guaranteedShots: dto.guaranteedShots } : {}),
      ...(dto.maintenanceCycle !== undefined ? { maintenanceCycle: dto.maintenanceCycle } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.maker !== undefined ? { maker: dto.maker } : {}),
      ...(dto.purchaseDate !== undefined ? { purchaseDate: parseDateStart(dto.purchaseDate) } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
    Object.assign(item, updateData, { updatedBy: userId });
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
    return this.tx.run(async (queryRunner) => {
      const mold = await queryRunner.manager.findOne(MoldMaster, {
        where: { moldCode, company, plant },
      });
      if (!mold) {
        throw new NotFoundException('Mold not found.');
      }
      if (mold.status !== 'ACTIVE') {
        throw new BadRequestException('Usage can be recorded only for ACTIVE mold.');
      }

      const usageDate = dto.usageDate ? parseDateStart(dto.usageDate)! : new Date();
      const seq = await this.getNextUsageSeq(queryRunner);

      const usage = queryRunner.manager.create(MoldUsageLog, {
        usageDate,
        seq,
        moldCode,
        shotCount: dto.shotCount,
        orderNo: dto.orderNo ?? null,
        equipCode: dto.equipCode ?? null,
        workerCode: dto.workerCode ?? null,
        remark: dto.remark ?? null,
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
          this.logger.error(`Failed to set INTERLOCK for equipment: ${dto.equipCode}`, getErrorMessage(err));
        }
      }

      this.logger.log(`Mold usage logged: ${mold.moldCode}, shots=${dto.shotCount}, total=${mold.currentShots}`);
      return saved;
    });
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
