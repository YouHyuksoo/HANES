/**
 * @file src/modules/material/services/hold.service.ts
 * @description 재고홀드 비즈니스 로직 - LOT 상태를 HOLD로 변경/해제 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { HoldActionDto, ReleaseHoldDto, HoldQueryDto } from '../dto/hold.dto';

@Injectable()
export class HoldService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: HoldQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (status) {
      where.status = status;
    }

    // 검색어로 LOT 번호 또는 품목 코드 검색
    if (search) {
      // 먼저 품목 검색
      const parts = await this.partMasterRepository.find({
        where: [
          { partCode: Like(`%${search}%`) },
          { partName: Like(`%${search}%`) },
        ],
      });
      const partIds = parts.map((p) => p.id);

      where.lotNo = Like(`%${search}%`);
      if (partIds.length > 0) {
        // partId 조건 추가 (OR 조건을 위해 별도 처리 필요)
      }
    }

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

    // 재고 정보 조회
    const lotIds = data.map((lot) => lot.id);
    const stocks = lotIds.length > 0
      ? await this.matStockRepository.find({ where: { lotId: In(lotIds) } })
      : [];
    const stockMap = new Map(stocks.map((s) => [s.lotId, s]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.partId);
      const stock = stockMap.get(lot.id);
      return {
        ...lot,
        partCode: part?.partCode,
        partName: part?.partName,
        unit: part?.unit,
        warehouseCode: stock?.warehouseCode,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async hold(dto: HoldActionDto) {
    const { lotId, reason } = dto;

    const lot = await this.matLotRepository.findOne({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotId}`);
    }

    if (lot.status === 'HOLD') {
      throw new BadRequestException('이미 HOLD 상태인 LOT입니다.');
    }

    if (lot.status === 'DEPLETED') {
      throw new BadRequestException('소진된 LOT은 HOLD할 수 없습니다.');
    }

    // HOLD 상태로 변경
    await this.matLotRepository.update(lotId, {
      status: 'HOLD',
    });

    const updatedLot = await this.matLotRepository.findOne({ where: { id: lotId } });
    const part = await this.partMasterRepository.findOne({ where: { id: updatedLot!.partId } });

    return {
      id: lotId,
      status: 'HOLD',
      lotNo: updatedLot?.lotNo,
      partCode: part?.partCode,
      partName: part?.partName,
      reason,
    };
  }

  async release(dto: ReleaseHoldDto) {
    const { lotId, reason } = dto;

    const lot = await this.matLotRepository.findOne({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotId}`);
    }

    if (lot.status !== 'HOLD') {
      throw new BadRequestException('HOLD 상태가 아닌 LOT입니다.');
    }

    // NORMAL 상태로 변경
    await this.matLotRepository.update(lotId, {
      status: 'NORMAL',
    });

    const updatedLot = await this.matLotRepository.findOne({ where: { id: lotId } });
    const part = await this.partMasterRepository.findOne({ where: { id: updatedLot!.partId } });

    return {
      id: lotId,
      status: 'NORMAL',
      lotNo: updatedLot?.lotNo,
      partCode: part?.partCode,
      partName: part?.partName,
      reason,
    };
  }
}
