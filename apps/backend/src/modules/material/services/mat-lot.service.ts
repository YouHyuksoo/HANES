/**
 * @file src/modules/material/services/mat-lot.service.ts
 * @description 자재LOT 비즈니스 로직 서비스 (TypeORM)
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateMatLotDto, UpdateMatLotDto, MatLotQueryDto } from '../dto/mat-lot.dto';

@Injectable()
export class MatLotService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: MatLotQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, partId, lotNo, vendor, iqcStatus, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(partId && { partId }),
      ...(lotNo && { lotNo: Like(`%${lotNo}%`) }),
      ...(vendor && { vendor: Like(`%${vendor}%`) }),
      ...(iqcStatus && { iqcStatus }),
      ...(status && { status }),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    const [data, total] = await Promise.all([
      this.matLotRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.matLotRepository.count({ where }),
    ]);

    // part 정보 조회 및 중첩 객체 평면화
    const partIds = data.map((lot) => lot.partId).filter(Boolean);
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.partId);
      return {
        ...lot,
        partCode: part?.partCode,
        partName: part?.partName,
        unit: part?.unit,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async findById(id: string) {
    const lot = await this.matLotRepository.findOne({
      where: { id },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${id}`);

    const part = lot.partId ? await this.partMasterRepository.findOne({ where: { id: lot.partId } }) : null;

    return {
      ...lot,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
    };
  }

  async findByLotNo(lotNo: string) {
    const lot = await this.matLotRepository.findOne({
      where: { lotNo },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotNo}`);

    const part = lot.partId ? await this.partMasterRepository.findOne({ where: { id: lot.partId } }) : null;

    return {
      ...lot,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
    };
  }

  async create(dto: CreateMatLotDto) {
    const existing = await this.matLotRepository.findOne({
      where: { lotNo: dto.lotNo },
    });

    if (existing) throw new ConflictException(`이미 존재하는 LOT 번호입니다: ${dto.lotNo}`);

    const lot = this.matLotRepository.create({
      lotNo: dto.lotNo,
      partId: dto.partId,
      initQty: dto.initQty,
      currentQty: dto.currentQty ?? dto.initQty,
      recvDate: dto.recvDate ? new Date(dto.recvDate) : new Date(),
      expireDate: dto.expireDate ? new Date(dto.expireDate) : null,
      origin: dto.origin,
      vendor: dto.vendor,
      invoiceNo: dto.invoiceNo,
      poNo: dto.poNo,
      iqcStatus: dto.iqcStatus ?? 'PENDING',
      status: dto.status ?? 'NORMAL',
    });

    const saved = await this.matLotRepository.save(lot);
    const part = await this.partMasterRepository.findOne({ where: { id: saved.partId } });

    return {
      ...saved,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
    };
  }

  async update(id: string, dto: UpdateMatLotDto) {
    await this.findById(id);

    const updateData: any = {};
    if (dto.iqcStatus) updateData.iqcStatus = dto.iqcStatus;
    if (dto.status) updateData.status = dto.status;
    if (dto.expireDate) updateData.expireDate = new Date(dto.expireDate);
    if (dto.vendor) updateData.vendor = dto.vendor;
    if (dto.origin) updateData.origin = dto.origin;

    await this.matLotRepository.update(id, updateData);

    const lot = await this.matLotRepository.findOne({ where: { id } });
    const part = lot?.partId ? await this.partMasterRepository.findOne({ where: { id: lot.partId } }) : null;

    return {
      ...lot,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
    };
  }

  async delete(id: string) {
    const lot = await this.findById(id);
    if (lot.currentQty > 0) {
      throw new BadRequestException('재고가 남아있는 LOT은 삭제할 수 없습니다.');
    }
    await this.matLotRepository.delete(id);
    return { id };
  }

  async consumeQty(id: string, qty: number) {
    const lot = await this.findById(id);
    if (lot.currentQty < qty) {
      throw new BadRequestException(`재고 부족: 현재 ${lot.currentQty}, 요청 ${qty}`);
    }

    const newQty = lot.currentQty - qty;
    await this.matLotRepository.update(id, {
      currentQty: newQty,
      status: newQty === 0 ? 'DEPLETED' : lot.status,
    });

    return this.matLotRepository.findOne({ where: { id } });
  }

  async returnQty(id: string, qty: number) {
    const lot = await this.findById(id);
    const newQty = lot.currentQty + qty;

    await this.matLotRepository.update(id, {
      currentQty: newQty,
      status: newQty > 0 && lot.status === 'DEPLETED' ? 'NORMAL' : lot.status,
    });

    return this.matLotRepository.findOne({ where: { id } });
  }
}
