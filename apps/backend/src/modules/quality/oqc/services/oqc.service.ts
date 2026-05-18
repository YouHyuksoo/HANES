import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BoxMaster } from '../../../../entities/box-master.entity';
import { OqcRequestBox } from '../../../../entities/oqc-request-box.entity';
import { OqcRequest } from '../../../../entities/oqc-request.entity';
import { PartMaster } from '../../../../entities/part-master.entity';
import {
  CreateOqcRequestDto,
  ExecuteOqcInspectionDto,
  OqcRequestQueryDto,
  UpdateOqcResultDto,
} from '../dto/oqc.dto';

@Injectable()
export class OqcService {
  private readonly logger = new Logger(OqcService.name);

  constructor(
    @InjectRepository(OqcRequest)
    private readonly oqcRequestRepo: Repository<OqcRequest>,
    @InjectRepository(OqcRequestBox)
    private readonly oqcRequestBoxRepo: Repository<OqcRequestBox>,
    @InjectRepository(BoxMaster)
    private readonly boxRepo: Repository<BoxMaster>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: OqcRequestQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, status, customer, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.oqcRequestRepo
      .createQueryBuilder('oqc')
      .leftJoinAndMapOne('oqc.part', PartMaster, 'part', 'oqc.itemCode = part.itemCode');

    if (company) qb.andWhere('oqc.company = :company', { company });
    if (plant) qb.andWhere('oqc.plant = :plant', { plant });
    if (status) qb.andWhere('oqc.status = :status', { status });
    if (customer) qb.andWhere('oqc.customer LIKE :customer', { customer: `%${customer}%` });
    if (fromDate) qb.andWhere('oqc.requestDate >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('oqc.requestDate <= :toDate', { toDate });
    if (search) {
      qb.andWhere(
        '(oqc.requestNo LIKE :search OR part.itemCode LIKE :search OR part.itemName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('oqc.requestDate', 'DESC')
      .addOrderBy('oqc.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string) {
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC ?붿껌??李얠쓣 ???놁뒿?덈떎: ${id}`);
    }

    const part = await this.partRepo.findOne({ where: { itemCode: oqcRequest.itemCode } });
    return { ...oqcRequest, part };
  }

  async createRequest(dto: CreateOqcRequestDto, company?: string, plant?: string, createdBy?: string) {
    const { itemCode, boxIds, customer, requestDate, sampleSize } = dto;

    const boxes = await this.boxRepo.find({
      where: { boxNo: In(boxIds) },
    });

    if (boxes.length !== boxIds.length) {
      throw new BadRequestException('?쇰? 諛뺤뒪瑜?李얠쓣 ???놁뒿?덈떎.');
    }

    const invalidBoxes = boxes.filter((box) => box.status !== 'CLOSED' || box.oqcStatus !== null);
    if (invalidBoxes.length > 0) {
      throw new BadRequestException(
        `寃??遺덇? 諛뺤뒪: ${invalidBoxes.map((box) => box.boxNo).join(', ')} (CLOSED ?곹깭 + OQC 誘몄???諛뺤뒪留?媛??`,
      );
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `OQC-${dateStr}`;

    const lastReq = await this.oqcRequestRepo
      .createQueryBuilder('oqc')
      .where('oqc.requestNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('oqc.requestNo', 'DESC')
      .getOne();

    let seq = 1;
    if (lastReq) {
      const lastSeq = parseInt(lastReq.requestNo.split('-').pop() || '0', 10);
      seq = lastSeq + 1;
    }

    const requestNo = `${prefix}-${String(seq).padStart(3, '0')}`;
    const totalQty = boxes.reduce((sum, box) => sum + box.qty, 0);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oqcRequest = queryRunner.manager.create(OqcRequest, {
        requestNo,
        itemCode,
        customer: customer || null,
        requestDate: requestDate ? new Date(requestDate) : today,
        totalBoxCount: boxes.length,
        totalQty,
        sampleSize: sampleSize || null,
        status: 'PENDING',
        company: company || null,
        plant: plant || null,
        createdBy: createdBy || null,
      });
      const saved = await queryRunner.manager.save(OqcRequest, oqcRequest);

      const requestBoxes = boxes.map((box) =>
        queryRunner.manager.create(OqcRequestBox, {
          requestNo: saved.requestNo,
          boxNo: box.boxNo,
          qty: box.qty,
          isSample: 'N',
        }),
      );
      await queryRunner.manager.save(OqcRequestBox, requestBoxes);

      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: In(boxIds) },
        { oqcStatus: 'PENDING' },
      );

      await queryRunner.commitTransaction();
      return this.findById(saved.requestNo);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async executeInspection(id: string, dto: ExecuteOqcInspectionDto, updatedBy?: string) {
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC ?붿껌??李얠쓣 ???놁뒿?덈떎: ${id}`);
    }

    if (oqcRequest.status !== 'PENDING' && oqcRequest.status !== 'IN_PROGRESS') {
      throw new BadRequestException('?湲??먮뒗 吏꾪뻾 ?곹깭???붿껌留?寃?ы븷 ???덉뒿?덈떎.');
    }

    const boxNos = oqcRequest.boxes.map((box) => box.boxNo);
    if (boxNos.length > 0) {
      const linkedBoxes = await this.boxRepo.find({
        where: { boxNo: In(boxNos) },
      });
      const progressedBoxes = linkedBoxes.filter((box) => box.palletNo || box.status === 'SHIPPED');
      if (progressedBoxes.length > 0) {
        throw new BadRequestException(
          `?꾧났?뺤씠 吏꾪뻾??諛뺤뒪(${progressedBoxes.map((box) => box.boxNo).join(', ')})媛 ?덉뼱 OQC 寃?щ? ?ㅽ뻾?????놁뒿?덈떎. ?붾젅??異쒗븯遺??癒쇱? ?뺣━??二쇱꽭??`,
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.sampleBoxIds && dto.sampleBoxIds.length > 0) {
        await queryRunner.manager.update(
          OqcRequestBox,
          { requestNo: id, boxNo: In(dto.sampleBoxIds) },
          { isSample: 'Y' },
        );
      }

      await queryRunner.manager.update(
        OqcRequest,
        { requestNo: id },
        {
          status: dto.result,
          result: dto.result,
          details: dto.details || null,
          inspectorName: dto.inspectorName || null,
          inspectDate: new Date(),
          updatedBy: updatedBy || null,
        },
      );

      if (boxNos.length > 0) {
        await queryRunner.manager.update(
          BoxMaster,
          { boxNo: In(boxNos) },
          { oqcStatus: dto.result },
        );
      }

      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateResult(id: string, dto: UpdateOqcResultDto, updatedBy?: string) {
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC ?붿껌??李얠쓣 ???놁뒿?덈떎: ${id}`);
    }

    if (dto.result) {
      const boxNos = oqcRequest.boxes.map((box) => box.boxNo);
      if (boxNos.length > 0) {
        const linkedBoxes = await this.boxRepo.find({
          where: { boxNo: In(boxNos) },
        });
        const progressedBoxes = linkedBoxes.filter((box) => box.palletNo || box.status === 'SHIPPED');
        if (progressedBoxes.length > 0) {
          throw new BadRequestException(
            `?꾧났?뺤씠 吏꾪뻾??諛뺤뒪(${progressedBoxes.map((box) => box.boxNo).join(', ')})媛 ?덉뼱 OQC 寃곌낵瑜??섏젙?????놁뒿?덈떎. ?붾젅??異쒗븯遺??癒쇱? ?뺣━??二쇱꽭??`,
          );
        }
      }
    }

    const updateData: Partial<OqcRequest> = { updatedBy: updatedBy || null };
    if (dto.result) updateData.result = dto.result;
    if (dto.result) updateData.status = dto.result;
    if (dto.details !== undefined) updateData.details = dto.details;
    if (dto.inspectorName !== undefined) updateData.inspectorName = dto.inspectorName;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(OqcRequest, { requestNo: id }, updateData);

      if (dto.result) {
        const boxNos = oqcRequest.boxes.map((box) => box.boxNo);
        if (boxNos.length > 0) {
          await queryRunner.manager.update(
            BoxMaster,
            { boxNo: In(boxNos) },
            { oqcStatus: dto.result },
          );
        }
      }

      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getAvailableBoxes(itemCode?: string, company?: string, plant?: string) {
    const qb = this.boxRepo
      .createQueryBuilder('box')
      .leftJoinAndMapOne('box.part', PartMaster, 'part', 'box.itemCode = part.itemCode')
      .where('box.status = :status', { status: 'CLOSED' })
      .andWhere('box.oqcStatus IS NULL');

    if (itemCode) qb.andWhere('box.itemCode = :itemCode', { itemCode });
    if (company) qb.andWhere('box.company = :company', { company });
    if (plant) qb.andWhere('box.plant = :plant', { plant });

    qb.orderBy('box.boxNo', 'ASC');
    return qb.getMany();
  }

  async getStats(company?: string, plant?: string) {
    const qb = this.oqcRequestRepo.createQueryBuilder('oqc');

    if (company) qb.andWhere('oqc.company = :company', { company });
    if (plant) qb.andWhere('oqc.plant = :plant', { plant });

    const all = await qb.getMany();
    return {
      total: all.length,
      pending: all.filter((row) => row.status === 'PENDING').length,
      pass: all.filter((row) => row.status === 'PASS' || row.result === 'PASS').length,
      fail: all.filter((row) => row.status === 'FAIL' || row.result === 'FAIL').length,
    };
  }
}


