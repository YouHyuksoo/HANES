import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, In, Repository } from 'typeorm';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { OqcRequest } from '../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../entities/oqc-request-box.entity';
import {
  CreateBoxDto,
  UpdateBoxDto,
  BoxQueryDto,
  AddSerialToBoxDto,
  AssignBoxToPalletDto,
  BoxStatus,
} from '../dto/box.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

@Injectable()
export class BoxService {
  private readonly logger = new Logger(BoxService.name);

  constructor(
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    @InjectRepository(PalletMaster)
    private readonly palletRepository: Repository<PalletMaster>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
    @InjectRepository(MatLot)
    private readonly lotRepository: Repository<MatLot>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    @InjectRepository(OqcRequest)
    private readonly oqcRequestRepository: Repository<OqcRequest>,
    @InjectRepository(OqcRequestBox)
    private readonly oqcRequestBoxRepository: Repository<OqcRequestBox>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private async nextOqcRequestNo() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `OQC-${dateStr}`;

    const lastReq = await this.oqcRequestRepository
      .createQueryBuilder('oqc')
      .where('oqc.requestNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('oqc.requestNo', 'DESC')
      .getOne();

    const seq = lastReq
      ? parseInt(lastReq.requestNo.split('-').pop() || '0', 10) + 1
      : 1;

    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  async findAll(query: BoxQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, boxNo, itemCode, palletId: palletNo, status, unassigned } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(boxNo && { boxNo: ILike(`%${boxNo}%`) }),
      ...(itemCode && { itemCode }),
      ...(palletNo && { palletNo }),
      ...(status && { status }),
      ...(unassigned && { palletNo: IsNull() }),
    };

    const [data, total] = await Promise.all([
      this.boxRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.boxRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(boxNo: string, company?: string, plant?: string) {
    const box = await this.boxRepository.findOne({
      where: { boxNo, ...this.tenantWhere(company, plant) },
    });
    if (!box) {
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${boxNo}`);
    }
    return box;
  }

  async findByBoxNo(boxNo: string, company?: string, plant?: string) {
    const box = await this.findById(boxNo, company, plant);
    const part = await this.partRepository.findOne({
      where: { itemCode: box.itemCode, ...this.tenantWhere(company, plant) },
    });

    return {
      ...box,
      part: part
        ? {
            itemCode: part.itemCode,
            itemName: part.itemName,
            itemType: part.itemType,
            unit: part.unit,
          }
        : null,
    };
  }

  async create(dto: CreateBoxDto, company?: string, plant?: string) {
    // 박스번호 미지정 시 자동 채번 (BX+YYMMDD+4자리, SEQ_BOX_NO_DAILY)
    const boxNo = dto.boxNo ?? await this.numbering.nextBoxNo();

    const existing = await this.boxRepository.findOne({
      where: { boxNo, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 박스번호입니다: ${boxNo}`);
    }

    const part = await this.partRepository.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!part) {
      throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);
    }

    const box = this.boxRepository.create({
      boxNo,
      itemCode: dto.itemCode,
      qty: dto.qty,
      serialList: dto.serialList ? JSON.stringify(dto.serialList) : null,
      status: 'OPEN',
      oqcStatus: null,
      company: company || null,
      plant: plant || null,
    });

    return this.boxRepository.save(box);
  }

  async update(id: string, dto: UpdateBoxDto, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status === 'SHIPPED') {
      throw new BadRequestException('출하된 박스는 수정할 수 없습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `박스 상태(${dto.status})는 직접 변경할 수 없습니다. 포장/재오픈/적재/출하 전용 API를 사용해 주세요.`,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.qty !== undefined) updateData.qty = dto.qty;
    if (dto.serialList !== undefined) updateData.serialList = JSON.stringify(dto.serialList);
    if (dto.palletId !== undefined) updateData.palletNo = dto.palletId;

    await this.boxRepository.update({ boxNo: id, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(id, company, plant);
  }

  async delete(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);

    if (box.status === 'SHIPPED') {
      throw new BadRequestException('출하된 박스는 삭제할 수 없습니다.');
    }
    if (box.status !== 'OPEN') {
      throw new BadRequestException(
        '포장된 박스는 직접 삭제할 수 없습니다. 박스 재오픈으로 먼저 정리해 주세요.',
      );
    }
    if (box.palletNo) {
      throw new BadRequestException('팔레트에 할당된 박스는 삭제할 수 없습니다.');
    }
    const serials = box.serialList ? JSON.parse(box.serialList) : [];
    if (serials.length > 0 || box.qty > 0) {
      throw new BadRequestException(
        '시리얼이 담긴 박스는 직접 삭제할 수 없습니다. 시리얼 제거 후 다시 삭제해 주세요.',
      );
    }
    if (box.oqcStatus) {
      throw new BadRequestException(
        'OQC 이력이 있는 박스는 직접 삭제할 수 없습니다. 박스/OQC를 먼저 정리해 주세요.',
      );
    }

    await this.boxRepository.delete({ boxNo: id, ...this.tenantWhere(company, plant) });
    return { id, deleted: true };
  }

  async addSerial(id: string, dto: AddSerialToBoxDto, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 시리얼을 추가할 수 없습니다.`);
    }

    const existingSerials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
    const duplicates = dto.serials.filter((serial) => existingSerials.includes(serial));
    if (duplicates.length > 0) {
      throw new ConflictException(`이미 존재하는 시리얼입니다: ${duplicates.join(', ')}`);
    }

    const lots = dto.serials.length > 0
      ? await this.lotRepository.find({ where: { matUid: In(dto.serials), ...this.tenantWhere(company, plant) } })
      : [];
    const lotMap = new Map(lots.map((lot) => [lot.matUid, lot] as const));
    for (const serial of dto.serials) {
      const lot = lotMap.get(serial);
      if (lot && lot.itemCode !== box.itemCode) {
        throw new BadRequestException(`시리얼 ${serial}은 박스 품목과 일치하지 않습니다.`);
      }
    }

    const part = await this.partRepository.findOne({
      where: { itemCode: box.itemCode, ...this.tenantWhere(company, plant) },
    });
    const fgLabels = dto.serials.length > 0
      ? await this.fgLabelRepository.find({ where: { fgBarcode: In(dto.serials), ...this.tenantWhere(company, plant) } })
      : [];
    const fgLabelMap = new Map(fgLabels.map((label) => [label.fgBarcode, label] as const));
    const invalidLabels = dto.serials.filter((serial) => {
      const label = fgLabelMap.get(serial);
      if (!label) return true;
      if (label.itemCode !== box.itemCode) return true;
      if (label.inspectPassYn !== 'Y') return true;
      return !['ISSUED', 'VISUAL_PASS'].includes(label.status);
    });
    if (invalidLabels.length > 0) {
      throw new BadRequestException(`검사 합격 FG만 포장할 수 있습니다: ${invalidLabels.join(', ')}`);
    }

    const packUnit = part?.packUnit ? parseInt(part.packUnit, 10) : 0;
    if (packUnit > 0 && existingSerials.length + dto.serials.length > packUnit) {
      throw new BadRequestException(`포장단위(${packUnit})를 초과했습니다.`);
    }

    const newSerialList = [...existingSerials, ...dto.serials];
    await this.boxRepository.update(
      { boxNo: id, ...this.tenantWhere(company, plant) },
      {
        serialList: JSON.stringify(newSerialList),
        qty: newSerialList.length,
      },
    );

    return this.findById(id, company, plant);
  }

  async removeSerial(id: string, serials: string[], company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 시리얼을 제거할 수 없습니다.`);
    }

    const existingSerials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
    const notFound = serials.filter((serial) => !existingSerials.includes(serial));
    if (notFound.length > 0) {
      throw new NotFoundException(`존재하지 않는 시리얼입니다: ${notFound.join(', ')}`);
    }

    const newSerialList = existingSerials.filter((serial) => !serials.includes(serial));
    await this.boxRepository.update(
      { boxNo: id, ...this.tenantWhere(company, plant) },
      {
        serialList: JSON.stringify(newSerialList),
        qty: newSerialList.length,
      },
    );

    return this.findById(id, company, plant);
  }

  async closeBox(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);

    if (box.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 박스를 닫을 수 없습니다.`);
    }
    if (box.qty <= 0) {
      throw new BadRequestException('빈 박스는 닫을 수 없습니다.');
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { status: 'CLOSED', closeAt: new Date(), oqcStatus: 'PENDING' },
      );

      if (box.serialList) {
        try {
          const fgBarcodes: string[] = JSON.parse(box.serialList);
          if (fgBarcodes.length > 0) {
            const batchSize = 500;
            for (let i = 0; i < fgBarcodes.length; i += batchSize) {
              const batch = fgBarcodes.slice(i, i + batchSize);
              await queryRunner.manager.update(
                FgLabel,
                { fgBarcode: In(batch), ...this.tenantWhere(company, plant) },
                { status: 'PACKED' },
              );
            }
          }
        } catch {
          this.logger.warn(`박스 ${id} serialList 파싱 실패 - FG_LABEL 상태 업데이트 생략`);
        }
      }

      const requestNo = await this.nextOqcRequestNo();
      await queryRunner.manager.save(
        OqcRequest,
        queryRunner.manager.create(OqcRequest, {
          requestNo,
          itemCode: box.itemCode,
          customer: null,
          requestDate: new Date(),
          totalBoxCount: 1,
          totalQty: box.qty,
          sampleSize: null,
          status: 'PENDING',
          company: box.company,
          plant: box.plant,
          remark: `AUTO_CREATED_FROM_BOX:${box.boxNo}`,
        }),
      );
      await queryRunner.manager.save(
        OqcRequestBox,
        queryRunner.manager.create(OqcRequestBox, {
          requestNo,
          boxNo: box.boxNo,
          qty: box.qty,
          isSample: 'N',
          company: box.company,
          plant: box.plant,
        }),
      );
    });

    return this.findById(id, company, plant);
  }

  async reopenBox(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);

    if (box.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 박스를 다시 열 수 없습니다.`);
    }
    if (box.palletNo) {
      throw new BadRequestException('팔레트에 할당된 박스는 다시 열 수 없습니다.');
    }
    if (box.oqcStatus && box.oqcStatus !== 'PENDING') {
      throw new BadRequestException(
        `박스 ${box.boxNo} 는 OQC(${box.oqcStatus})가 이미 처리되어 다시 열 수 없습니다. ` +
          `OQC 단계부터 먼저 정리해 주세요.`,
      );
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { status: 'OPEN', closeAt: null, oqcStatus: null },
      );

      if (box.serialList) {
        try {
          const fgBarcodes: string[] = JSON.parse(box.serialList);
          if (fgBarcodes.length > 0) {
            const batchSize = 500;
            for (let i = 0; i < fgBarcodes.length; i += batchSize) {
              const batch = fgBarcodes.slice(i, i + batchSize);
              await queryRunner.manager.update(
                FgLabel,
                { fgBarcode: In(batch), status: 'PACKED', ...this.tenantWhere(company, plant) },
                { status: 'VISUAL_PASS' },
              );
            }
          }
        } catch {
          this.logger.warn(`박스 ${id} serialList 파싱 실패 - FG_LABEL 상태 복원 생략`);
        }
      }

      const requestBoxes = await queryRunner.manager.find(OqcRequestBox, {
        where: { boxNo: box.boxNo, ...this.tenantWhere(company, plant) },
      });
      const requestNos = requestBoxes.map((requestBox) => requestBox.requestNo);
      if (requestNos.length > 0) {
        const requests = await queryRunner.manager.find(OqcRequest, {
          where: { requestNo: In(requestNos), status: 'PENDING', ...this.tenantWhere(company, plant) },
        });
        const autoRequestNos = requests
          .filter((request) => request.remark === `AUTO_CREATED_FROM_BOX:${box.boxNo}`)
          .map((request) => request.requestNo);

        if (autoRequestNos.length > 0) {
          await queryRunner.manager.delete(OqcRequestBox, { requestNo: In(autoRequestNos), ...this.tenantWhere(company, plant) });
          await queryRunner.manager.delete(OqcRequest, { requestNo: In(autoRequestNos), ...this.tenantWhere(company, plant) });
        }
      }
    });

    return this.findById(id, company, plant);
  }

  async assignToPallet(id: string, dto: AssignBoxToPalletDto, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (box.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${box.status})에서는 팔레트에 할당할 수 없습니다.`);
    }
    if (box.palletNo && box.palletNo !== dto.palletId) {
      throw new BadRequestException('이미 다른 팔레트에 할당된 박스입니다.');
    }

    const pallet = await this.palletRepository.findOne({
      where: { palletNo: dto.palletId, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${dto.palletId}`);
    }
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`팔레트 상태(${pallet.status})가 OPEN이 아닙니다.`);
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { palletNo: dto.palletId },
      );

      const summaryQb = queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo: dto.palletId });
      if (company) summaryQb.andWhere('box.company = :company', { company });
      if (plant) summaryQb.andWhere('box.plant = :plant', { plant });
      const palletSummary = await summaryQb
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(PalletMaster, { palletNo: dto.palletId, ...this.tenantWhere(company, plant) }, {
        boxCount: parseInt(palletSummary.count) || 0,
        totalQty: parseInt(palletSummary.totalQty) || 0,
      });
    });

    return this.findById(id, company, plant);
  }

  async removeFromPallet(id: string, company?: string, plant?: string) {
    const box = await this.findById(id, company, plant);
    if (!box.palletNo) {
      throw new BadRequestException('팔레트에 할당되지 않은 박스입니다.');
    }

    const pallet = await this.palletRepository.findOne({
      where: { palletNo: box.palletNo, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) {
      throw new NotFoundException('팔레트를 찾을 수 없습니다.');
    }
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`팔레트 상태(${pallet.status})가 OPEN이 아닙니다.`);
    }

    const palletNo = box.palletNo;
    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: id, ...this.tenantWhere(company, plant) },
        { palletNo: null },
      );

      const summaryQb = queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo });
      if (company) summaryQb.andWhere('box.company = :company', { company });
      if (plant) summaryQb.andWhere('box.plant = :plant', { plant });
      const palletSummary = await summaryQb
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(PalletMaster, { palletNo, ...this.tenantWhere(company, plant) }, {
        boxCount: parseInt(palletSummary?.count) || 0,
        totalQty: parseInt(palletSummary?.totalQty) || 0,
      });
    });

    return this.findById(id, company, plant);
  }

  async findByPalletId(palletNo: string, company?: string, plant?: string) {
    return this.boxRepository.find({
      where: { palletNo, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'ASC' },
    });
  }

  async findByPartId(itemCode: string, status?: BoxStatus) {
    const where: Record<string, unknown> = {
      itemCode,
      ...(status && { status }),
    };

    return this.boxRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findUnassignedBoxes(company?: string, plant?: string) {
    return this.boxRepository.find({
      where: {
        palletNo: IsNull(),
        status: 'CLOSED',
        ...this.tenantWhere(company, plant),
      },
      order: { createdAt: 'ASC' },
    });
  }
}
