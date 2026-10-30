import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
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
import { NumberingService } from '../../../../shared/numbering.service';
import { parseDateStart } from '../../../../shared/date.util';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { lockRowsForUpdate } from '../../../../common/utils/row-lock.util';

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
    private readonly numbering: NumberingService,
    private readonly sysConfig: SysConfigService,
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

  /** 등록할 박스가 모두 있고, 마감(CLOSED)·OQC 미실시이며, 요청 품목의 박스인지 확인한다 */
  private assertBoxesRequestable(boxes: BoxMaster[], boxIds: string[], itemCode: string, company?: string, plant?: string) {
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

    // 요청 품목이 아닌 박스를 섞어 등록하던 것
    const otherItemBoxes = boxes.filter((box) => box.itemCode !== itemCode);
    if (otherItemBoxes.length > 0) {
      throw new BadRequestException(
        `요청 품목(${itemCode})이 아닌 박스가 있습니다: ${otherItemBoxes.map((box) => box.boxNo).join(', ')}`,
      );
    }
  }

  /** 박스 행을 박스번호순으로 잠근다(트랜잭션 안에서만 의미가 있다) */
  private async lockBoxes(queryRunner: QueryRunner, boxNos: string[], company?: string, plant?: string) {
    for (const boxNo of [...boxNos].sort()) {
      await lockRowsForUpdate(queryRunner, 'BOX_MASTERS', { BOX_NO: boxNo, COMPANY: company, PLANT_CD: plant });
    }
  }

  /** 박스 행을 잠그고 팔레트·출하가 진행된 박스가 있으면 막는다(확인과 갱신 사이에 다른 요청이 끼어들지 못하게 트랜잭션 안에서 부른다) */
  private async assertNoProgressedBoxes(queryRunner: QueryRunner, boxNos: string[], company: string | undefined, plant: string | undefined, what: string) {
    if (boxNos.length === 0) return;
    await this.lockBoxes(queryRunner, boxNos, company, plant);
    const linkedBoxes = await queryRunner.manager.find(BoxMaster, {
      where: { boxNo: In(boxNos), ...this.tenantWhere(company, plant) },
    });
    const progressedBoxes = linkedBoxes.filter((box) => box.palletNo || box.status === 'SHIPPED');
    if (progressedBoxes.length > 0) {
      throw new BadRequestException(
        `출하공정이 진행된 박스(${progressedBoxes.map((box) => box.boxNo).join(', ')})가 있어 ${what}할 수 없습니다. 팔레트·출하부터 먼저 정리해 주세요.`,
      );
    }
  }

  private async assertOqcEnabled(company?: string, plant?: string) {
    if (!(await this.sysConfig.isEnabled('OQC_ENABLED', company, plant))) {
      throw new BadRequestException('OQC가 시스템 환경설정에서 비활성화되어 있습니다.');
    }
  }

  async findAll(query: OqcRequestQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, status, customer, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.oqcRequestRepo
      .createQueryBuilder('oqc')
      .leftJoinAndMapOne('oqc.part', ItemMaster, 'part', 'oqc.itemCode = part.itemCode AND oqc.company = part.company AND oqc.plant = part.plant');

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
    await this.assertOqcEnabled(company, plant);
    const { itemCode, boxIds, customer, requestDate, sampleSize } = dto;

    const boxes = await this.boxRepo.find({
      where: { boxNo: In(boxIds), ...this.tenantWhere(company, plant) },
    });

    this.assertBoxesRequestable(boxes, boxIds, itemCode, company, plant);

    const today = new Date();
    const totalQty = boxes.reduce((sum, box) => sum + box.qty, 0);

    let savedRequestNo!: string;
    await this.tx.run(async (queryRunner) => {
      // 같은 박스로 동시에 등록해도 한 요청에만 들어가도록 박스를 잠근 뒤 다시 확인한다
      await this.lockBoxes(queryRunner, boxIds, company, plant);
      const lockedBoxes = await queryRunner.manager.find(BoxMaster, {
        where: { boxNo: In(boxIds), ...this.tenantWhere(company, plant) },
      });
      this.assertBoxesRequestable(lockedBoxes, boxIds, itemCode, company, plant);

      // 요청번호 채번: OQC-YYYYMMDD-NNN
      // NUM_RULE_MASTERS(OQC_REQUEST) 행을 같은 트랜잭션에서 SELECT FOR UPDATE로 잠가
      // 동시 채번을 직렬화한다(롤백 시 시퀀스도 복원되어 결번 없음).
      const requestNo = await this.numbering.nextInTx(queryRunner, 'OQC_REQUEST');
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
    await this.assertOqcEnabled(company, plant);
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
    // 샘플 박스는 요청에 속한 박스여야 한다(아닌 박스를 조용히 무시하던 것)
    const unknownSampleBoxes = (dto.sampleBoxIds ?? []).filter((boxNo) => !boxNos.includes(boxNo));
    if (unknownSampleBoxes.length > 0) {
      throw new BadRequestException(`요청에 속하지 않은 샘플 박스가 있습니다: ${unknownSampleBoxes.join(', ')}`);
    }

    await this.tx.run(async (queryRunner) => {
      // 요청 행과 박스 행을 잠근 뒤 상태를 다시 확인한다(동시에 두 번 실행하거나 그 사이 팔레트·출하가 진행되는 것을 막는다)
      await lockRowsForUpdate(queryRunner, 'OQC_REQUESTS', { REQUEST_NO: id, COMPANY: company, PLANT_CD: plant });
      const lockedRequest = await queryRunner.manager.findOne(OqcRequest, { where: { requestNo: id, ...tenantWhere } });
      if (!lockedRequest || (lockedRequest.status !== 'PENDING' && lockedRequest.status !== 'IN_PROGRESS')) {
        throw new BadRequestException('대기 또는 진행 상태의 요청만 검사할 수 있습니다.');
      }
      await this.assertNoProgressedBoxes(queryRunner, boxNos, company, plant, 'OQC 검사를 실행');

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
    await this.assertOqcEnabled(company, plant);
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
      if (dto.result) {
        await this.assertNoProgressedBoxes(
          queryRunner,
          oqcRequest.boxes.map((box) => box.boxNo),
          company,
          plant,
          'OQC 결과를 수정',
        );
      }
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
      .leftJoinAndMapOne('box.part', ItemMaster, 'part', 'box.itemCode = part.itemCode AND box.company = part.company AND box.plant = part.plant')
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

