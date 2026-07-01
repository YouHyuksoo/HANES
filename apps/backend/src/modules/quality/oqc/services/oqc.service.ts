import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BoxMaster } from '../../../../entities/box-master.entity';
import { OqcRequestBox } from '../../../../entities/oqc-request-box.entity';
import { OqcRequest } from '../../../../entities/oqc-request.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import {
  CreateOqcRequestDto,
  ExecuteOqcInspectionDto,
  OqcRequestQueryDto,
  UpdateOqcResultDto,
} from '../dto/oqc.dto';
import { TransactionService } from '../../../../shared/transaction.service';
import { parseDateStart } from '../../../../shared/date.util';

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
    @InjectRepository(ItemMaster)
    private readonly partRepo: Repository<ItemMaster>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private withClientId(request: OqcRequest) {
    return { ...request, id: request.requestNo };
  }

  async findAll(query: OqcRequestQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, status, customer, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.oqcRequestRepo
      .createQueryBuilder('oqc')
      .leftJoinAndMapOne('oqc.part', ItemMaster, 'part', 'oqc.itemCode = part.itemCode');

    if (company) qb.andWhere('oqc.company = :company', { company });
    if (plant) qb.andWhere('oqc.plant = :plant', { plant });
    if (status) qb.andWhere('oqc.status = :status', { status });
    if (customer) qb.andWhere('oqc.customer LIKE :customer', { customer: `%${customer}%` });
    if (fromDate) qb.andWhere(`oqc.requestDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')`, { fromDate });
    if (toDate) qb.andWhere(`oqc.requestDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1`, { toDate });
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
    return { data: data.map((request) => this.withClientId(request)), total, page, limit };
  }

  async findById(id: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id, ...tenantWhere },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC 요청을 찾을 수 없습니다: ${id}`);
    }

    const part = await this.partRepo.findOne({ where: { itemCode: oqcRequest.itemCode, ...tenantWhere } });
    return { ...this.withClientId(oqcRequest), part };
  }

  async createRequest(dto: CreateOqcRequestDto, company?: string, plant?: string, createdBy?: string) {
    const { itemCode, boxIds, customer, requestDate, sampleSize } = dto;

    const boxes = await this.boxRepo.find({
      where: { boxNo: In(boxIds), ...this.tenantWhere(company, plant) },
    });

    if (boxes.length !== boxIds.length) {
      throw new BadRequestException('일부 박스를 찾을 수 없습니다.');
    }

    const tenantMismatchedBoxes = boxes.filter(
      (box) =>
        (company && box.company !== company) ||
        (plant && box.plant !== plant),
    );
    if (tenantMismatchedBoxes.length > 0) {
      throw new BadRequestException(
        `OQC 요청 박스의 회사/사업장 정보가 일치하지 않습니다: ${tenantMismatchedBoxes.map((box) => box.boxNo).join(', ')}`,
      );
    }

    const invalidBoxes = boxes.filter((box) => box.status !== 'CLOSED' || box.oqcStatus !== null);
    if (invalidBoxes.length > 0) {
      throw new BadRequestException(
        `검사 불가 박스: ${invalidBoxes.map((box) => box.boxNo).join(', ')} (CLOSED 상태 + OQC 미실시 박스만 가능)`,
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

    let savedRequestNo!: string;
    await this.tx.run(async (queryRunner) => {
      const oqcRequest = queryRunner.manager.create(OqcRequest, {
        requestNo,
        itemCode,
        customer: customer || null,
        requestDate: requestDate ? parseDateStart(requestDate)! : today,
        totalBoxCount: boxes.length,
        totalQty,
        sampleSize: sampleSize || null,
        status: 'PENDING',
        company: company || null,
        plant: plant || null,
        createdBy: createdBy || null,
      });
      const saved = await queryRunner.manager.save(OqcRequest, oqcRequest);
      savedRequestNo = saved.requestNo;

      const requestBoxes = boxes.map((box) =>
        queryRunner.manager.create(OqcRequestBox, {
          requestNo: saved.requestNo,
          boxNo: box.boxNo,
          qty: box.qty,
          isSample: 'N',
          company: company || null,
          plant: plant || null,
          createdBy: createdBy || null,
        }),
      );
      await queryRunner.manager.save(OqcRequestBox, requestBoxes);

      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: In(boxIds), ...this.tenantWhere(company, plant) },
        { oqcStatus: 'PENDING' },
      );
    });
    return this.findById(savedRequestNo, company, plant);
  }

  async executeInspection(id: string, dto: ExecuteOqcInspectionDto, updatedBy?: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id, ...tenantWhere },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC 요청을 찾을 수 없습니다: ${id}`);
    }

    if (oqcRequest.status !== 'PENDING' && oqcRequest.status !== 'IN_PROGRESS') {
      throw new BadRequestException('대기 또는 진행 상태의 요청만 검사할 수 있습니다.');
    }

    const boxNos = oqcRequest.boxes.map((box) => box.boxNo);
    if (boxNos.length > 0) {
      const linkedBoxes = await this.boxRepo.find({
        where: { boxNo: In(boxNos), ...tenantWhere },
      });
      const progressedBoxes = linkedBoxes.filter((box) => box.palletNo || box.status === 'SHIPPED');
      if (progressedBoxes.length > 0) {
        throw new BadRequestException(
          `출하공정이 진행된 박스(${progressedBoxes.map((box) => box.boxNo).join(', ')})가 있어 OQC 검사를 실행할 수 없습니다. 팔레트·출하부터 먼저 정리해 주세요.`,
        );
      }
    }

    await this.tx.run(async (queryRunner) => {
      if (dto.sampleBoxIds && dto.sampleBoxIds.length > 0) {
        await queryRunner.manager.update(
          OqcRequestBox,
          { requestNo: id, boxNo: In(dto.sampleBoxIds), ...tenantWhere },
          { isSample: 'Y' },
        );
      }

      await queryRunner.manager.update(
        OqcRequest,
        { requestNo: id, ...tenantWhere },
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
          { boxNo: In(boxNos), ...tenantWhere },
          { oqcStatus: dto.result },
        );
      }
    });
    return this.findById(id, company, plant);
  }

  async updateResult(id: string, dto: UpdateOqcResultDto, updatedBy?: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id, ...tenantWhere },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC 요청을 찾을 수 없습니다: ${id}`);
    }

    if (dto.result) {
      const boxNos = oqcRequest.boxes.map((box) => box.boxNo);
      if (boxNos.length > 0) {
        const linkedBoxes = await this.boxRepo.find({
          where: { boxNo: In(boxNos), ...tenantWhere },
        });
        const progressedBoxes = linkedBoxes.filter((box) => box.palletNo || box.status === 'SHIPPED');
        if (progressedBoxes.length > 0) {
          throw new BadRequestException(
            `출하공정이 진행된 박스(${progressedBoxes.map((box) => box.boxNo).join(', ')})가 있어 OQC 결과를 수정할 수 없습니다. 팔레트·출하부터 먼저 정리해 주세요.`,
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

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(OqcRequest, { requestNo: id, ...tenantWhere }, updateData);

      if (dto.result) {
        const boxNos = oqcRequest.boxes.map((box) => box.boxNo);
        if (boxNos.length > 0) {
          await queryRunner.manager.update(
            BoxMaster,
            { boxNo: In(boxNos), ...tenantWhere },
            { oqcStatus: dto.result },
          );
        }
      }
    });
    return this.findById(id, company, plant);
  }

  async getAvailableBoxes(itemCode?: string, company?: string, plant?: string) {
    const qb = this.boxRepo
      .createQueryBuilder('box')
      .leftJoinAndMapOne('box.part', ItemMaster, 'part', 'box.itemCode = part.itemCode')
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


