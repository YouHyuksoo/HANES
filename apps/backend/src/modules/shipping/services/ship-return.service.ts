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
import { Repository, IsNull, ILike, MoreThanOrEqual, LessThanOrEqual, And, DataSource, In } from 'typeorm';
import { ShipmentReturn } from '../../../entities/shipment-return.entity';
import { ShipmentReturnItem } from '../../../entities/shipment-return-item.entity';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateShipReturnDto, UpdateShipReturnDto, ShipReturnQueryDto } from '../dto/ship-return.dto';

@Injectable()
export class ShipReturnService {
  constructor(
    @InjectRepository(ShipmentReturn)
    private readonly shipReturnRepository: Repository<ShipmentReturn>,
    @InjectRepository(ShipmentReturnItem)
    private readonly shipReturnItemRepository: Repository<ShipmentReturnItem>,
    @InjectRepository(ShipmentOrder)
    private readonly shipOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** items 배열의 part를 평면화하는 헬퍼 메서드 */
  private async flattenItems(data: any): Promise<any> {
    const items = await this.shipReturnItemRepository.find({
      where: { returnId: data.id },
    });

    const itemsWithPart = await Promise.all(
      items.map(async (item) => {
        const part = await this.partRepository.findOne({
          where: { id: item.partId },
          select: ['id', 'partCode', 'partName'],
        });
        return {
          ...item,
          partId: part?.id ?? item.partId,
          partCode: part?.partCode,
          partName: part?.partName,
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

    const where: any = {
      deletedAt: IsNull(),
      ...(company && { company }),
      ...(plant && { plant }),
      ...(status && { status }),
      ...(search && {
        returnNo: ILike(`%${search}%`),
      }),
      ...(returnDateFrom || returnDateTo
        ? {
            returnDate: And(
              returnDateFrom ? MoreThanOrEqual(new Date(returnDateFrom)) : undefined,
              returnDateTo ? LessThanOrEqual(new Date(returnDateTo)) : undefined
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.shipReturnRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.shipReturnRepository.count({ where }),
    ]);

    // 품목 및 출하지시 정보 병합
    const resultData = await Promise.all(
      data.map(async (item) => {
        const shipOrder = item.shipmentId
          ? await this.shipOrderRepository.findOne({
              where: { id: item.shipmentId },
              select: ['id', 'shipOrderNo', 'customerName'],
            })
          : null;

        const flattened = await this.flattenItems(item);
        return {
          ...flattened,
          shipOrder,
        };
      })
    );

    return { data: resultData, total, page, limit };
  }

  /** 반품 단건 조회 */
  async findById(id: string) {
    const ret = await this.shipReturnRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!ret) throw new NotFoundException(`반품을 찾을 수 없습니다: ${id}`);

    const shipOrder = ret.shipmentId
      ? await this.shipOrderRepository.findOne({
          where: { id: ret.shipmentId },
          select: ['id', 'shipOrderNo', 'customerName'],
        })
      : null;

    const flattened = await this.flattenItems(ret);
    return {
      ...flattened,
      shipOrder,
    };
  }

  /** 반품 생성 */
  async create(dto: CreateShipReturnDto) {
    const existing = await this.shipReturnRepository.findOne({
      where: { returnNo: dto.returnNo, deletedAt: IsNull() },
    });
    if (existing) throw new ConflictException(`이미 존재하는 반품 번호입니다: ${dto.returnNo}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const shipReturn = this.shipReturnRepository.create({
        returnNo: dto.returnNo,
        shipmentId: dto.shipmentId,
        returnDate: dto.returnDate ? new Date(dto.returnDate) : null,
        returnReason: dto.returnReason,
        remark: dto.remark,
        status: 'DRAFT',
      });

      const savedReturn = await queryRunner.manager.save(shipReturn);

      // 품목 생성
      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item) =>
          this.shipReturnItemRepository.create({
            returnId: savedReturn.id,
            partId: item.partId,
            returnQty: item.returnQty,
            disposalType: item.disposalType ?? 'RESTOCK',
            remark: item.remark,
          })
        );
        await queryRunner.manager.save(items);
      }

      await queryRunner.commitTransaction();

      return this.findById(savedReturn.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 반품 수정 */
  async update(id: string, dto: UpdateShipReturnDto) {
    const ret = await this.findById(id);
    if (ret.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 수정할 수 있습니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.items) {
        await queryRunner.manager.delete(ShipmentReturnItem, { returnId: id });

        const items = dto.items.map((item) =>
          this.shipReturnItemRepository.create({
            returnId: id,
            partId: item.partId,
            returnQty: item.returnQty,
            disposalType: item.disposalType ?? 'RESTOCK',
            remark: item.remark,
          })
        );
        await queryRunner.manager.save(items);
      }

      const updateData: any = {};
      if (dto.returnNo !== undefined) updateData.returnNo = dto.returnNo;
      if (dto.shipmentId !== undefined) updateData.shipmentId = dto.shipmentId;
      if (dto.returnDate !== undefined) updateData.returnDate = dto.returnDate ? new Date(dto.returnDate) : null;
      if (dto.returnReason !== undefined) updateData.returnReason = dto.returnReason;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.remark !== undefined) updateData.remark = dto.remark;

      await queryRunner.manager.update(ShipmentReturn, { id }, updateData);

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 반품 삭제 (소프트 삭제) */
  async delete(id: string) {
    const ret = await this.findById(id);
    if (ret.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 삭제할 수 있습니다.');
    }

    await this.shipReturnRepository.update(
      { id },
      { deletedAt: new Date() }
    );

    return { id, deleted: true };
  }
}
