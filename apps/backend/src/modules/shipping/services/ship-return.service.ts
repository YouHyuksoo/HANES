/**
 * @file src/modules/shipping/services/ship-return.service.ts
 * @description 출하반품 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 반품 생성/조회/수정/삭제 + 품목 관리
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> COMPLETED
 * 3. **처리유형**: RESTOCK(재입고), SCRAP(폐기), REPAIR(수리)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ShipmentReturn } from '../../../entities/shipment-return.entity';
import { ShipmentReturnItem } from '../../../entities/shipment-return-item.entity';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { CreateShipReturnDto, UpdateShipReturnDto, ShipReturnQueryDto } from '../dto/ship-return.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class ShipReturnService {
  constructor(
    @InjectRepository(ShipmentReturn)
    private readonly shipReturnRepository: Repository<ShipmentReturn>,
    @InjectRepository(ShipmentReturnItem)
    private readonly shipReturnItemRepository: Repository<ShipmentReturnItem>,
    @InjectRepository(ShipmentOrder)
    private readonly shipOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private buildShipmentReturnUpdate(
    dto: Omit<UpdateShipReturnDto, 'items' | 'status' | 'returnNo'>,
  ): Partial<Pick<ShipmentReturn, 'shipmentId' | 'returnDate' | 'returnReason' | 'remark'>> {
    return {
      ...(dto.shipmentId !== undefined ? { shipmentId: dto.shipmentId } : {}),
      ...(dto.returnDate !== undefined ? { returnDate: parseDateStart(dto.returnDate) } : {}),
      ...(dto.returnReason !== undefined ? { returnReason: dto.returnReason } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
  }

  /** items 배열의 part를 평면화하는 헬퍼 메서드 */
  private async flattenItems(
    data: ShipmentReturn,
    company?: string,
    plant?: string,
  ): Promise<ShipmentReturn & { items: Array<ShipmentReturnItem & { itemName?: string }> }> {
    const items = await this.shipReturnItemRepository.find({
      where: { returnNo: data.returnNo, ...this.tenantWhere(company, plant) },
    });

    const itemsWithPart = await Promise.all(
      items.map(async (item) => {
        const part = await this.partRepository.findOne({
          where: { itemCode: item.itemCode, ...this.tenantWhere(company, plant) },
          select: ['itemCode', 'itemName'],
        });
        return {
          ...item,
          itemCode: part?.itemCode ?? item.itemCode,
          itemName: part?.itemName,
        };
      })
    );

    return {
      ...data,
      items: itemsWithPart,
    };
  }

  /** 반품 목록 조회 */
  async findAll(query: ShipReturnQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, returnDateFrom, returnDateTo } = query;
    const skip = (page - 1) * limit;

    const qb = this.shipReturnRepository
      .createQueryBuilder('sr')
      .orderBy('sr.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (company) qb.andWhere('sr.company = :company', { company });
    if (plant) qb.andWhere('sr.plant = :plant', { plant });
    if (status) qb.andWhere('sr.status = :status', { status });
    if (search) qb.andWhere('sr.returnNo LIKE :search', { search: `%${search}%` });
    if (returnDateFrom) qb.andWhere("sr.returnDate >= TO_DATE(:returnDateFrom, 'YYYY-MM-DD')", { returnDateFrom });
    if (returnDateTo) qb.andWhere("sr.returnDate < TO_DATE(:returnDateTo, 'YYYY-MM-DD') + 1", { returnDateTo });

    const [data, total] = await qb.getManyAndCount();

    // 품목 및 출하지시 정보 병합
    const resultData = await Promise.all(
      data.map(async (item) => {
        const shipOrder = item.shipmentId
          ? await this.shipOrderRepository.findOne({
              where: { shipOrderNo: item.shipmentId, ...this.tenantWhere(company, plant) },
              select: ['shipOrderNo', 'customerName'],
            })
          : null;

        const flattened = await this.flattenItems(item, company, plant);
        return {
          ...flattened,
          shipOrder,
        };
      })
    );

    return { data: resultData, total, page, limit };
  }

  /** 반품 단건 조회 */
  async findById(returnNo: string, company?: string, plant?: string) {
    const ret = await this.shipReturnRepository.findOne({
      where: { returnNo, ...this.tenantWhere(company, plant) },
    });

    if (!ret) throw new NotFoundException(`반품을 찾을 수 없습니다: ${returnNo}`);

    const shipOrder = ret.shipmentId
      ? await this.shipOrderRepository.findOne({
          where: { shipOrderNo: ret.shipmentId, ...this.tenantWhere(company, plant) },
          select: ['shipOrderNo', 'customerName'],
        })
      : null;

    const flattened = await this.flattenItems(ret, company, plant);
    return {
      ...flattened,
      shipOrder,
    };
  }

  /** 반품 생성 */
  async create(dto: CreateShipReturnDto, company?: string, plant?: string) {
    const existing = await this.shipReturnRepository.findOne({
      where: { returnNo: dto.returnNo, ...this.tenantWhere(company, plant) },
    });
    if (existing) throw new ConflictException(`이미 존재하는 반품 번호입니다: ${dto.returnNo}`);

    let savedReturnNo!: string;
    await this.tx.run(async (queryRunner) => {
      const shipReturn = this.shipReturnRepository.create({
        returnNo: dto.returnNo,
        shipmentId: dto.shipmentId,
        returnDate: parseDateStart(dto.returnDate),
        returnReason: dto.returnReason,
        remark: dto.remark,
        status: 'DRAFT',
        company: company || null,
        plant: plant || null,
      });

      const savedReturn = await queryRunner.manager.save(shipReturn);
      savedReturnNo = savedReturn.returnNo;

      // 품목 생성
      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item, idx) =>
          this.shipReturnItemRepository.create({
            returnNo: savedReturn.returnNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            returnQty: item.returnQty,
            disposalType: item.disposalType ?? 'RESTOCK',
            remark: item.remark,
            company: company || null,
            plant: plant || null,
          })
        );
        await queryRunner.manager.save(items);
      }
    });

    return this.findById(savedReturnNo, company, plant);
  }

  /** 반품 수정 */
  async update(returnNo: string, dto: UpdateShipReturnDto, company?: string, plant?: string) {
    const ret = await this.findById(returnNo, company, plant);
    if (ret.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 수정할 수 있습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `반품 상태(${dto.status})는 직접 변경할 수 없습니다. 반품 전용 처리 API를 사용해 주세요.`,
      );
    }
    if (dto.returnNo !== undefined && dto.returnNo !== returnNo) {
      throw new BadRequestException('반품 번호는 수정할 수 없습니다.');
    }

    await this.tx.run(async (queryRunner) => {
      const { items, status: _ignoredStatus, returnNo: _ignoredReturnNo, ...returnData } = dto;
      if (dto.items) {
        await queryRunner.manager.delete(ShipmentReturnItem, { returnNo, ...this.tenantWhere(company, plant) });

        const itemEntities = dto.items.map((item, idx) =>
          this.shipReturnItemRepository.create({
            returnNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            returnQty: item.returnQty,
            disposalType: item.disposalType ?? 'RESTOCK',
            remark: item.remark,
            company: company || null,
            plant: plant || null,
          })
        );
        await queryRunner.manager.save(itemEntities);
      }

      const updateData = this.buildShipmentReturnUpdate(returnData);

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(ShipmentReturn, { returnNo, ...this.tenantWhere(company, plant) }, updateData);
      }
    });

    return this.findById(returnNo, company, plant);
  }

  /** 반품 삭제 */
  async delete(returnNo: string, company?: string, plant?: string) {
    const ret = await this.findById(returnNo, company, plant);
    if (ret.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 삭제할 수 있습니다.');
    }

    await this.shipReturnRepository.delete({ returnNo, ...this.tenantWhere(company, plant) });

    return { returnNo, deleted: true };
  }
}
