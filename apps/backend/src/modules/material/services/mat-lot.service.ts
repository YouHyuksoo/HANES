/**
 * @file src/modules/material/services/mat-lot.service.ts
 * @description 자재LOT 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * - MatLot의 PK는 matUid (자재 고유 식별자)
 * - itemCode로 품목마스터(ItemMaster)와 연결
 * - iqcStatus: IQC 검사 상태 (PENDING/PASS/FAIL)
 * - status: LOT 상태 (NORMAL/HOLD/SCRAPPED/DEPLETED)
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Not, FindOptionsWhere } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { CreateMatLotDto, UpdateMatLotDto, MatLotQueryDto } from '../dto/mat-lot.dto';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class MatLotService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  async findAll(query: MatLotQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, matUid, vendor, iqcStatus, status } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<MatLot> = {
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
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 공급사(vendor) 코드 → 업체명 매핑 (PARTNER_MASTERS IN 절 일괄 조회, company/plant 스코프)
    const vendorCodes = Array.from(
      new Set(data.map((lot) => lot.vendor).filter((v): v is string => Boolean(v))),
    );
    const partners = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({
        where: { partnerCode: In(vendorCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      return {
        ...lot,
        itemCode: lot.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        vendorName: lot.vendor ? (partnerMap.get(lot.vendor) ?? lot.vendor) : null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async findById(matUid: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const lot = await this.matLotRepository.findOne({
      where: { matUid, ...tenantWhere },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);

    const part = lot.itemCode ? await this.itemMasterRepository.findOne({ where: { itemCode: lot.itemCode, ...tenantWhere } }) : null;

    return {
      ...lot,
      itemCode: lot.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
    };
  }

  async findByMatUid(matUid: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const lot = await this.matLotRepository.findOne({
      where: { matUid, ...tenantWhere },
    });

    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);

    const [part, stock] = await Promise.all([
      lot.itemCode ? this.itemMasterRepository.findOne({ where: { itemCode: lot.itemCode, ...tenantWhere } }) : null,
      this.matStockRepository.findOne({ where: { matUid, ...tenantWhere }, order: { warehouseCode: 'ASC' } }),
    ]);

    return {
      ...lot,
      itemCode: lot.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
      warehouseCode: stock?.warehouseCode ?? null,
      qty: stock?.qty ?? lot.currentQty,
    };
  }

  async create(dto: CreateMatLotDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const existing = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid, ...tenantWhere },
    });

    if (existing) throw new ConflictException(`이미 존재하는 자재 UID입니다: ${dto.matUid}`);

    const lot = this.matLotRepository.create({
      matUid: dto.matUid,
      itemCode: dto.itemCode,
      initQty: dto.initQty,
      recvDate: dto.recvDate ? parseDateStart(dto.recvDate) : new Date(),
      expireDate: parseDateStart(dto.expireDate),
      origin: dto.origin,
      vendor: dto.vendor,
      invoiceNo: dto.invoiceNo,
      poNo: dto.poNo,
      iqcStatus: dto.iqcStatus ?? 'PENDING',
      status: dto.status ?? 'NORMAL',
      company,
      plant,
    });

    const saved = await this.matLotRepository.save(lot);
    const part = await this.itemMasterRepository.findOne({ where: { itemCode: saved.itemCode, ...tenantWhere } });

    return {
      ...saved,
      itemCode: saved.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
    };
  }

  async update(matUid: string, dto: UpdateMatLotDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    await this.findById(matUid, company, plant);
    if (dto.status) {
      throw new BadRequestException(
        `LOT 상태(${dto.status})는 직접 변경할 수 없습니다. HOLD/해제/폐기/소진 전용 처리 API를 사용해 주세요.`,
      );
    }

    const updateData: Partial<Pick<MatLot, 'iqcStatus' | 'expireDate' | 'vendor' | 'origin'>> = {};
    if (dto.iqcStatus) updateData.iqcStatus = dto.iqcStatus;
    if (dto.expireDate) updateData.expireDate = parseDateStart(dto.expireDate);
    if (dto.vendor) updateData.vendor = dto.vendor;
    if (dto.origin) updateData.origin = dto.origin;

    await this.matLotRepository.update({ matUid, ...tenantWhere }, updateData);

    const lot = await this.matLotRepository.findOne({ where: { matUid, ...tenantWhere } });
    const part = lot?.itemCode ? await this.itemMasterRepository.findOne({ where: { itemCode: lot.itemCode, ...tenantWhere } }) : null;

    return {
      ...lot,
      itemCode: lot?.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
    };
  }

  async delete(matUid: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const lot = await this.findById(matUid, company, plant);

    const stocks = await this.matStockRepository.find({ where: { matUid, ...tenantWhere } });
    const hasStock = stocks.some((stock) => (stock.qty ?? 0) > 0 || (stock.availableQty ?? 0) > 0);
    if (hasStock) {
      throw new BadRequestException(
        '재고가 남아 있는 LOT는 직접 삭제할 수 없습니다. 재고 정리 후 다시 삭제해 주세요.',
      );
    }

    const issues = await this.matIssueRepository.find({
      where: { matUid, status: Not('CANCELED'), ...tenantWhere },
    });
    if (issues.length > 0) {
      throw new BadRequestException(
        `이미 자재출고가 진행된 LOT입니다. 자재출고부터 먼저 정리해 주세요. LOT: ${lot.matUid}`,
      );
    }

    await this.matLotRepository.delete({ matUid, ...tenantWhere });
    return { matUid };
  }
}
