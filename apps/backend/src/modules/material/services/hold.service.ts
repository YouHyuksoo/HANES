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
          { itemCode: Like(`%${search}%`) },
          { itemName: Like(`%${search}%`) },
        ],
      });
      const itemCodes = parts.map((p) => p.itemCode);

      where.lotNo = Like(`%${search}%`);
      if (itemCodes.length > 0) {
        // itemCode 조건 추가 (OR 조건을 위해 별도 처리 필요)
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
    const itemCodes = data.map((lot) => lot.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 재고 정보 조회
    const lotNos = data.map((lot) => lot.lotNo);
    const stocks = lotNos.length > 0
      ? await this.matStockRepository.find({ where: { lotNo: In(lotNos) } })
      : [];
    const stockMap = new Map(stocks.map((s) => [s.lotNo, s]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const stock = stockMap.get(lot.lotNo);
      return {
        ...lot,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
        warehouseCode: stock?.warehouseCode,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async hold(dto: HoldActionDto) {
    const { lotNo, reason } = dto;

    const lot = await this.matLotRepository.findOne({
      where: { lotNo: lotNo },
    });

    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotNo}`);
    }

    if (lot.status === 'HOLD') {
      throw new BadRequestException('이미 HOLD 상태인 LOT입니다.');
    }

    if (lot.status === 'DEPLETED') {
      throw new BadRequestException('소진된 LOT은 HOLD할 수 없습니다.');
    }

    // HOLD 상태로 변경
    await this.matLotRepository.update(lotNo, {
      status: 'HOLD',
    });

    const updatedLot = await this.matLotRepository.findOne({ where: { lotNo: lotNo } });
    const part = await this.partMasterRepository.findOne({ where: { itemCode: updatedLot!.itemCode } });

    return {
      id: lotNo,
      status: 'HOLD',
      lotNo: updatedLot?.lotNo,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      reason,
    };
  }

  async release(dto: ReleaseHoldDto) {
    const { lotNo, reason } = dto;

    const lot = await this.matLotRepository.findOne({
      where: { lotNo: lotNo },
    });

    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotNo}`);
    }

    if (lot.status !== 'HOLD') {
      throw new BadRequestException('HOLD 상태가 아닌 LOT입니다.');
    }

    // NORMAL 상태로 변경
    await this.matLotRepository.update(lotNo, {
      status: 'NORMAL',
    });

    const updatedLot = await this.matLotRepository.findOne({ where: { lotNo: lotNo } });
    const part = await this.partMasterRepository.findOne({ where: { itemCode: updatedLot!.itemCode } });

    return {
      id: lotNo,
      status: 'NORMAL',
      lotNo: updatedLot?.lotNo,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      reason,
    };
  }
}
