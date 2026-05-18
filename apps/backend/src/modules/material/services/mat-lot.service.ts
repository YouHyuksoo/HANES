/**
 * @file src/modules/material/services/mat-lot.service.ts
 * @description 자재LOT 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * - MatLot의 PK는 matUid (자재 고유 식별자)
 * - itemCode로 품목마스터(PartMaster)와 연결
 * - iqcStatus: IQC 검사 상태 (PENDING/PASS/FAIL)
 * - status: LOT 상태 (NORMAL/HOLD/SCRAPPED/DEPLETED)
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Not } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { CreateMatLotDto, UpdateMatLotDto, MatLotQueryDto } from '../dto/mat-lot.dto';

@Injectable()
export class MatLotService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
  ) {}

  async findAll(query: MatLotQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, matUid, vendor, iqcStatus, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(itemCode && { itemCode }),
      ...(matUid && { matUid: Like(`%${matUid}%`) }),
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
    const itemCodes = data.map((lot) => lot.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      return {
        ...lot,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async findById(matUid: string) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);

    const part = lot.itemCode ? await this.partMasterRepository.findOne({ where: { itemCode: lot.itemCode } }) : null;

    return {
      ...lot,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
    };
  }

  async findByMatUid(matUid: string) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);

    const part = lot.itemCode ? await this.partMasterRepository.findOne({ where: { itemCode: lot.itemCode } }) : null;

    return {
      ...lot,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
    };
  }

  async create(dto: CreateMatLotDto) {
    const existing = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid },
    });

    if (existing) throw new ConflictException(`이미 존재하는 자재 UID입니다: ${dto.matUid}`);

    const lot = this.matLotRepository.create({
      matUid: dto.matUid,
      itemCode: dto.itemCode,
      initQty: dto.initQty,
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
    const part = await this.partMasterRepository.findOne({ where: { itemCode: saved.itemCode } });

    return {
      ...saved,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
    };
  }

  async update(matUid: string, dto: UpdateMatLotDto) {
    await this.findById(matUid);
    if (dto.status) {
      throw new BadRequestException(
        `LOT 상태(${dto.status})는 직접 변경할 수 없습니다. HOLD/해제/폐기/소진 전용 처리 API를 사용해 주세요.`,
      );
    }

    const updateData: any = {};
    if (dto.iqcStatus) updateData.iqcStatus = dto.iqcStatus;
    if (dto.expireDate) updateData.expireDate = new Date(dto.expireDate);
    if (dto.vendor) updateData.vendor = dto.vendor;
    if (dto.origin) updateData.origin = dto.origin;

    await this.matLotRepository.update(matUid, updateData);

    const lot = await this.matLotRepository.findOne({ where: { matUid } });
    const part = lot?.itemCode ? await this.partMasterRepository.findOne({ where: { itemCode: lot.itemCode } }) : null;

    return {
      ...lot,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
    };
  }

  async delete(matUid: string) {
    const lot = await this.findById(matUid);

    const stocks = await this.matStockRepository.find({ where: { matUid } });
    const hasStock = stocks.some((stock) => (stock.qty ?? 0) > 0 || (stock.availableQty ?? 0) > 0);
    if (hasStock) {
      throw new BadRequestException(
        '재고가 남아 있는 LOT는 직접 삭제할 수 없습니다. 재고 정리 후 다시 삭제해 주세요.',
      );
    }

    const issues = await this.matIssueRepository.find({
      where: { matUid, status: Not('CANCELED') },
    });
    if (issues.length > 0) {
      throw new BadRequestException(
        `이미 자재출고가 진행된 LOT입니다. 자재출고부터 먼저 정리해 주세요. LOT: ${lot.matUid}`,
      );
    }

    await this.matLotRepository.delete(matUid);
    return { matUid };
  }
}
