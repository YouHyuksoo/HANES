/**
 * @file src/modules/shipping/services/ship-order.service.ts
 * @description 출하지시 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 출하지시 생성/조회/수정/삭제 + 품목 관리
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> CLOSED
 *    - DRAFT: 작성 중 (수정/삭제 가능)
 *    - CONFIRMED: 확정 (실출하 생성 가능, 수정/삭제 불가)
 *    - CLOSED: 실출하 완료 후 자동 마감
 * 3. **품목 관리**: 출하지시 생성/수정 시 items를 함께 처리
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, MoreThanOrEqual, LessThanOrEqual, Between, In, FindOptionsWhere } from 'typeorm';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { CreateShipOrderDto, UpdateShipOrderDto, ShipOrderQueryDto } from '../dto/ship-order.dto';
import { ShipBoxDto } from '../dto/ship-box.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { SysConfigService } from '../../system/services/sys-config.service';

@Injectable()
export class ShipOrderService {
  constructor(
    @InjectRepository(ShipmentOrder)
    private readonly shipOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(ShipmentOrderItem)
    private readonly shipOrderItemRepository: Repository<ShipmentOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
    private readonly productInventory: ProductInventoryService,
    private readonly tx: TransactionService,
    private readonly sysConfig: SysConfigService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private buildShipmentOrderUpdate(
    dto: Omit<UpdateShipOrderDto, 'items' | 'status' | 'shipOrderNo'>,
  ): Partial<Pick<ShipmentOrder, 'customerId' | 'customerName' | 'dueDate' | 'shipDate' | 'remark'>> {
    return {
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(dto.customerName !== undefined ? { customerName: dto.customerName } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
      ...(dto.shipDate !== undefined ? { shipDate: dto.shipDate ? new Date(dto.shipDate) : null } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
  }

  /** 출하지시 목록 조회 */
  async findAll(query: ShipOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ShipmentOrder> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(status && { status }),
      ...(search && {
        shipOrderNo: ILike(`%${search}%`),
      }),
    };
    if (dueDateFrom && dueDateTo) {
      where.dueDate = Between(new Date(dueDateFrom), new Date(dueDateTo));
    } else if (dueDateFrom) {
      where.dueDate = MoreThanOrEqual(new Date(dueDateFrom));
    } else if (dueDateTo) {
      where.dueDate = LessThanOrEqual(new Date(dueDateTo));
    }

    const [data, total] = await Promise.all([
      this.shipOrderRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.shipOrderRepository.count({ where }),
    ]);

    // 품목 정보 일괄 조회 (N+1 제거)
    const orderNos = data.map((o) => o.shipOrderNo);
    const allItems = orderNos.length > 0
      ? await this.shipOrderItemRepository.find({ where: { shipOrderNo: In(orderNos), ...this.tenantWhere(company, plant) } })
      : [];

    const itemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({
          where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) },
          select: ['itemCode', 'itemName'],
        })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p.itemName]));

    const resultData = data.map((order) => {
      const items = allItems
        .filter((i) => i.shipOrderNo === order.shipOrderNo)
        .map((item) => ({
          ...item,
          itemName: partMap.get(item.itemCode),
        }));
      return { ...order, items };
    });

    return { data: resultData, total, page, limit };
  }

  /** 출하지시 단건 조회 */
  async findById(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.shipOrderRepository.findOne({
      where: { shipOrderNo, ...this.tenantWhere(company, plant) },
    });

    if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);

    const items = await this.shipOrderItemRepository.find({
      where: { shipOrderNo: order.shipOrderNo, ...this.tenantWhere(company, plant) },
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
      ...order,
      items: itemsWithPart,
    };
  }

  /** 출하지시 생성 */
  async create(dto: CreateShipOrderDto, company?: string, plant?: string) {
    const existing = await this.shipOrderRepository.findOne({
      where: { shipOrderNo: dto.shipOrderNo, ...this.tenantWhere(company, plant) },
    });
    if (existing) throw new ConflictException(`이미 존재하는 출하지시 번호입니다: ${dto.shipOrderNo}`);

    let savedShipOrderNo!: string;
    await this.tx.run(async (queryRunner) => {
      const order = this.shipOrderRepository.create({
        shipOrderNo: dto.shipOrderNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        shipDate: dto.shipDate ? new Date(dto.shipDate) : null,
        remark: dto.remark,
        status: 'DRAFT',
        company: company || null,
        plant: plant || null,
      });

      const savedOrder = await queryRunner.manager.save(order);
      savedShipOrderNo = savedOrder.shipOrderNo;

      // 품목 생성
      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item, idx) =>
          this.shipOrderItemRepository.create({
            shipOrderNo: savedOrder.shipOrderNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            shippedQty: 0,
            remark: item.remark,
            company: company || null,
            plant: plant || null,
          })
        );
        await queryRunner.manager.save(items);
      }
    });

    return this.findById(savedShipOrderNo, company, plant);
  }

  /** 출하지시 수정 */
  async update(shipOrderNo: string, dto: UpdateShipOrderDto, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 수정할 수 있습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `출하지시 상태(${dto.status})는 직접 변경할 수 없습니다. 확정/마감 전용 API를 사용해 주세요.`,
      );
    }
    if (dto.shipOrderNo !== undefined && dto.shipOrderNo !== shipOrderNo) {
      throw new BadRequestException('출하지시 번호는 수정할 수 없습니다.');
    }

    await this.tx.run(async (queryRunner) => {
      const { items, status: _ignoredStatus, shipOrderNo: _ignoredShipOrderNo, ...orderData } = dto;
      if (dto.items) {
        await queryRunner.manager.delete(ShipmentOrderItem, { shipOrderNo, ...this.tenantWhere(company, plant) });

        const itemEntities = dto.items.map((item, idx) =>
          this.shipOrderItemRepository.create({
            shipOrderNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            shippedQty: 0,
            remark: item.remark,
            company: company || null,
            plant: plant || null,
          })
        );
        await queryRunner.manager.save(itemEntities);
      }

      const updateData = this.buildShipmentOrderUpdate(orderData);

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(ShipmentOrder, { shipOrderNo, ...this.tenantWhere(company, plant) }, updateData);
      }
    });

    return this.findById(shipOrderNo, company, plant);
  }

  /** 출하지시 삭제 */
  async delete(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 삭제할 수 있습니다.');
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.delete(ShipmentOrderItem, { shipOrderNo, ...this.tenantWhere(company, plant) });
      await queryRunner.manager.delete(ShipmentOrder, { shipOrderNo, ...this.tenantWhere(company, plant) });
    });

    return { shipOrderNo, deleted: true };
  }

  /**
   * 출하지시 확정 (DRAFT -> CONFIRMED)
   * 확정 후 실출하 생성 가능
   */
  async confirm(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 확정할 수 있습니다.');
    }

    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('품목이 없는 출하지시는 확정할 수 없습니다.');
    }

    await this.shipOrderRepository.update(
      { shipOrderNo, ...this.tenantWhere(company, plant) },
      { status: 'CONFIRMED' },
    );

    return this.findById(shipOrderNo, company, plant);
  }

  /**
   * 출하지시 기반 박스 단건 출하 (웹 모달 / PDA 공용)
   * 단일 트랜잭션: 박스 SHIPPED + FG_MAIN 재고차감 + 라인 shippedQty 증가 + 완출 시 지시 CLOSED
   */
  async shipBox(shipOrderNo: string, dto: ShipBoxDto, company?: string, plant?: string) {
    return this.tx.run(async (qr) => {
      const where = this.tenantWhere(company, plant);

      const order = await qr.manager.findOne(ShipmentOrder, { where: { shipOrderNo, ...where } });
      if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);
      if (order.status !== 'CONFIRMED') {
        throw new BadRequestException(`확정(CONFIRMED) 상태의 출하지시만 출하할 수 있습니다. 현재: ${order.status}`);
      }

      const box = await qr.manager.findOne(BoxMaster, { where: { boxNo: dto.boxNo, ...where } });
      if (!box) throw new NotFoundException(`박스를 찾을 수 없습니다: ${dto.boxNo}`);
      if (box.status === 'SHIPPED') throw new BadRequestException(`이미 출하된 박스입니다: ${dto.boxNo}`);
      if (box.status !== 'CLOSED') throw new BadRequestException(`마감(CLOSED)된 박스만 출하할 수 있습니다: ${dto.boxNo}`);
      // OQC 사용여부(OQC_ENABLED) 설정이 켜진 경우에만 합격(PASS) 박스만 출하 허용. 미사용이면 모든 마감 박스 출하 가능.
      const oqcEnabled = await this.sysConfig.isEnabled('OQC_ENABLED');
      if (oqcEnabled && box.oqcStatus !== 'PASS') {
        throw new BadRequestException(`OQC 합격(PASS) 박스만 출하할 수 있습니다: ${dto.boxNo}`);
      }
      // 팔레트에 적재된 박스는 팔레트 출하(markAsShipped) 경로 전용 → 이중 차감 방지를 위해 박스 스캔 출하에서 제외
      if (box.palletNo) throw new BadRequestException(`팔레트에 적재된 박스는 박스 스캔 출하 대상이 아닙니다. 팔레트 출하를 사용하세요: ${dto.boxNo}`);

      const line = await qr.manager.findOne(ShipmentOrderItem, { where: { shipOrderNo, itemCode: box.itemCode, ...where } });
      if (!line) throw new BadRequestException(`출하지시에 없는 품목입니다: ${box.itemCode}`);

      if (line.shippedQty + box.qty > line.orderQty) {
        throw new BadRequestException(`출하수량 초과: 지시 ${line.orderQty}, 기출하 ${line.shippedQty}, 요청 ${box.qty}`);
      }

      const warehouse = await qr.manager.findOne(Warehouse, { where: { warehouseType: 'FG', isDefault: 'Y', ...where } });
      if (!warehouse) throw new BadRequestException('FG 기본창고(IS_DEFAULT=Y)가 설정되어 있지 않습니다.');

      const serials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
      if (serials.length > 0 && serials.length !== box.qty) {
        throw new BadRequestException(`박스 수량(${box.qty})과 시리얼 수량(${serials.length})이 일치하지 않습니다: ${dto.boxNo}`);
      }

      const issueBase = {
        warehouseId: warehouse.warehouseCode,
        itemCode: box.itemCode,
        itemType: 'FINISHED' as const,
        transType: 'FG_OUT' as const,
        refType: 'SHIP_ORDER',
        refId: shipOrderNo,
        workerId: dto.workerId,
        remark: `출하지시 박스출하:${dto.boxNo}`,
        company,
        plant,
      };

      if (serials.length > 0) {
        for (const serial of serials) {
          await this.productInventory.issueStockInTx(qr, {
            ...issueBase,
            prdUid: serial,
            qty: 1,
          });
        }
      } else {
        await this.productInventory.issueStockInTx(qr, {
          ...issueBase,
          prdUid: '*',
          qty: box.qty,
        });
      }

      await qr.manager.update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'SHIPPED' });
      if (serials.length > 0) {
        await qr.manager.update(FgLabel, { fgBarcode: In(serials), ...where }, { status: 'SHIPPED' });
      }

      const newShipped = line.shippedQty + box.qty;
      await qr.manager.update(ShipmentOrderItem, { shipOrderNo, seq: line.seq, ...where }, { shippedQty: newShipped });

      const allLines = await qr.manager.find(ShipmentOrderItem, { where: { shipOrderNo, ...where } });
      const fullyShipped = allLines.every((l) =>
        (l.seq === line.seq ? newShipped : l.shippedQty) >= l.orderQty,
      );
      if (fullyShipped) {
        await qr.manager.update(ShipmentOrder, { shipOrderNo, ...where }, { status: 'CLOSED' });
      }

      return {
        shipOrderNo,
        boxNo: box.boxNo,
        itemCode: box.itemCode,
        qty: box.qty,
        lineShippedQty: newShipped,
        lineOrderQty: line.orderQty,
        orderStatus: fullyShipped ? 'CLOSED' : 'CONFIRMED',
        fullyShipped,
      };
    });
  }

  /**
   * 출하지시 기반 박스 출하 취소.
   * 출하 직전 상태로 되돌린다: 제품재고 복원 + 박스 CLOSED + FG_LABEL PACKED + 라인 shippedQty 차감 + 지시 CONFIRMED.
   */
  async cancelShipBox(shipOrderNo: string, dto: ShipBoxDto, company?: string, plant?: string) {
    return this.tx.run(async (qr) => {
      const where = this.tenantWhere(company, plant);

      const order = await qr.manager.findOne(ShipmentOrder, { where: { shipOrderNo, ...where } });
      if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);
      if (!['CONFIRMED', 'CLOSED'].includes(order.status)) {
        throw new BadRequestException(`출하 취소는 CONFIRMED/CLOSED 지시만 가능합니다. 현재: ${order.status}`);
      }

      const box = await qr.manager.findOne(BoxMaster, { where: { boxNo: dto.boxNo, ...where } });
      if (!box) throw new NotFoundException(`박스를 찾을 수 없습니다: ${dto.boxNo}`);
      if (box.status !== 'SHIPPED') {
        throw new BadRequestException(`출하된(SHIPPED) 박스만 출하 취소할 수 있습니다: ${dto.boxNo}`);
      }

      const line = await qr.manager.findOne(ShipmentOrderItem, { where: { shipOrderNo, itemCode: box.itemCode, ...where } });
      if (!line) throw new BadRequestException(`출하지시에 없는 품목입니다: ${box.itemCode}`);
      if (line.shippedQty < box.qty) {
        throw new BadRequestException(`출하 취소 수량이 기출하 수량보다 큽니다: 기출하 ${line.shippedQty}, 요청 ${box.qty}`);
      }

      const warehouse = await qr.manager.findOne(Warehouse, { where: { warehouseType: 'FG', isDefault: 'Y', ...where } });
      if (!warehouse) throw new BadRequestException('FG 기본창고(IS_DEFAULT=Y)가 설정되어 있지 않습니다.');

      const serials: string[] = box.serialList ? JSON.parse(box.serialList) : [];
      if (serials.length > 0 && serials.length !== box.qty) {
        throw new BadRequestException(`박스 수량(${box.qty})과 시리얼 수량(${serials.length})이 일치하지 않습니다: ${dto.boxNo}`);
      }

      const receiveBase = {
        warehouseId: warehouse.warehouseCode,
        itemCode: box.itemCode,
        itemType: 'FINISHED' as const,
        transType: 'FG_OUT_CANCEL' as const,
        refType: 'SHIP_ORDER_CANCEL',
        refId: shipOrderNo,
        workerId: dto.workerId,
        remark: `출하지시 박스출하 취소:${dto.boxNo}`,
        company,
        plant,
      };

      if (serials.length > 0) {
        for (const serial of serials) {
          await this.productInventory.receiveStockInTx(qr, {
            ...receiveBase,
            prdUid: serial,
            qty: 1,
          });
        }
      } else {
        await this.productInventory.receiveStockInTx(qr, {
          ...receiveBase,
          prdUid: '*',
          qty: box.qty,
        });
      }

      await qr.manager.update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'CLOSED' });
      if (serials.length > 0) {
        await qr.manager.update(FgLabel, { fgBarcode: In(serials), ...where }, { status: 'PACKED' });
      }

      const newShipped = line.shippedQty - box.qty;
      await qr.manager.update(ShipmentOrderItem, { shipOrderNo, seq: line.seq, ...where }, { shippedQty: newShipped });
      await qr.manager.update(ShipmentOrder, { shipOrderNo, ...where }, { status: 'CONFIRMED' });

      return {
        shipOrderNo,
        boxNo: box.boxNo,
        itemCode: box.itemCode,
        qty: box.qty,
        lineShippedQty: newShipped,
        lineOrderQty: line.orderQty,
        orderStatus: 'CONFIRMED',
        canceled: true,
      };
    });
  }
}
