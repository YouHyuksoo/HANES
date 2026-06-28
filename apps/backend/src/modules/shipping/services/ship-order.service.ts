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
import { Repository, ILike, MoreThanOrEqual, LessThanOrEqual, Between, In, IsNull, FindOptionsWhere } from 'typeorm';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ShipmentReturn } from '../../../entities/shipment-return.entity';
import { ShipmentReturnItem } from '../../../entities/shipment-return-item.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import {
  CreateShipOrderDto,
  UpdateShipOrderDto,
  ShipOrderQueryDto,
  CreateShipOrderPalletDto,
  ShipOrderPalletsDto,
} from '../dto/ship-order.dto';
import { ShipBoxDto } from '../dto/ship-box.dto';
import { AddBoxToPalletDto, RemoveBoxFromPalletDto } from '../dto/pallet.dto';
import { CancelOrderShipmentDto } from '../dto/cancel-shipment.dto';
import { ShipmentService } from './shipment.service';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { NumberingService } from '../../../shared/numbering.service';

@Injectable()
export class ShipOrderService {
  constructor(
    @InjectRepository(ShipmentOrder)
    private readonly shipOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(ShipmentOrderItem)
    private readonly shipOrderItemRepository: Repository<ShipmentOrderItem>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerRepository: Repository<PartnerMaster>,
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    @InjectRepository(PalletMaster)
    private readonly palletRepository: Repository<PalletMaster>,
    @InjectRepository(ShipmentLog)
    private readonly shipmentRepository: Repository<ShipmentLog>,
    private readonly productInventory: ProductInventoryService,
    private readonly tx: TransactionService,
    private readonly sysConfig: SysConfigService,
    private readonly numbering: NumberingService,
    private readonly shipmentService: ShipmentService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /**
   * 고객사코드(customerId = PARTNER_MASTERS.partnerCode)로 거래처마스터에서 고객명을 해석한다.
   * 고객명은 프론트가 보내는 값이 아니라 거래처마스터의 현재 이름을 출처로 한다.
   */
  private async resolveCustomerName(customerId?: string | null, company?: string, plant?: string): Promise<string | null> {
    if (!customerId) return null;
    const partner = await this.partnerRepository.findOne({
      where: { partnerCode: customerId, ...this.tenantWhere(company, plant) },
      select: ['partnerCode', 'partnerName'],
    });
    return partner?.partnerName ?? null;
  }

  /** 여러 customerId → 고객명 맵 (목록 조인용, N+1 회피) */
  private async customerNameMap(customerIds: (string | null | undefined)[], company?: string, plant?: string): Promise<Map<string, string>> {
    const ids = [...new Set(customerIds.filter((c): c is string => !!c))];
    if (ids.length === 0) return new Map();
    const partners = await this.partnerRepository.find({
      where: { partnerCode: In(ids), ...this.tenantWhere(company, plant) },
      select: ['partnerCode', 'partnerName'],
    });
    return new Map(partners.map((p) => [p.partnerCode, p.partnerName]));
  }

  private assertRequiredShipDate(shipDate: string | null | undefined) {
    if (typeof shipDate !== 'string' || shipDate.trim().length === 0) {
      throw new BadRequestException('고객사 출하일은 필수입니다.');
    }
    return shipDate;
  }

  private assertOrderLineMap(order: ShipmentOrder & { items?: ShipmentOrderItem[] }) {
    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException(`확정(CONFIRMED) 상태의 출하지시만 작업할 수 있습니다. 현재: ${order.status}`);
    }
    if (!order.items?.length) {
      throw new BadRequestException('품목이 없는 출하지시는 작업할 수 없습니다.');
    }
    return new Map(order.items.map((item) => [item.itemCode, item] as const));
  }

  private async getAllocatedQtyByItem(shipOrderNo: string, company?: string, plant?: string) {
    const pallets = await this.palletRepository.find({
      where: { shipOrderNo, ...this.tenantWhere(company, plant) },
      select: ['palletNo', 'status'],
    });
    const activePalletNos = pallets
      .filter((p) => p.status !== 'SHIPPED')
      .map((p) => p.palletNo);
    if (activePalletNos.length === 0) return new Map<string, number>();

    const boxes = await this.boxRepository.find({
      where: { palletNo: In(activePalletNos), ...this.tenantWhere(company, plant) },
      select: ['boxNo', 'itemCode', 'qty'],
    });

    const allocated = new Map<string, number>();
    for (const box of boxes ?? []) {
      allocated.set(box.itemCode, (allocated.get(box.itemCode) ?? 0) + box.qty);
    }
    return allocated;
  }

  private buildShipmentOrderUpdate(
    dto: Omit<UpdateShipOrderDto, 'items' | 'status' | 'shipOrderNo'>,
  ): Partial<Pick<ShipmentOrder, 'customerId' | 'customerName' | 'customerPoNo' | 'dueDate' | 'shipDate' | 'remark'>> {
    return {
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      // customerName은 프론트 dto가 아니라 거래처마스터에서 해석한다(update()에서 처리)
      ...(dto.customerPoNo !== undefined ? { customerPoNo: dto.customerPoNo } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: parseDateStart(dto.dueDate) } : {}),
      ...(dto.shipDate !== undefined ? { shipDate: parseDateStart(this.assertRequiredShipDate(dto.shipDate)) } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
  }

  /** 출하지시 목록 조회 */
  async findAll(query: ShipOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo, shipDateFrom, shipDateTo, includeOpen } = query;
    const skip = (page - 1) * limit;

    // 미완료(작업 대상) 상태 — 기간 밖이어도 항상 노출 대상
    const OPEN_STATUSES = ['DRAFT', 'CONFIRMED', 'SHIPPING'];

    // 날짜·상태를 제외한 공통 조건
    const common: FindOptionsWhere<ShipmentOrder> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(search && { shipOrderNo: ILike(`%${search}%`) }),
    };

    // 납기일 범위(기존 기능 유지)
    const dueRange =
      dueDateFrom && dueDateTo
        ? Between(parseDateStart(dueDateFrom)!, parseDateEnd(dueDateTo)!)
        : dueDateFrom
          ? MoreThanOrEqual(parseDateStart(dueDateFrom)!)
          : dueDateTo
            ? LessThanOrEqual(parseDateEnd(dueDateTo)!)
            : undefined;

    // 출하예정일 범위
    const shipRange =
      shipDateFrom && shipDateTo
        ? Between(parseDateStart(shipDateFrom)!, parseDateEnd(shipDateTo)!)
        : shipDateFrom
          ? MoreThanOrEqual(parseDateStart(shipDateFrom)!)
          : shipDateTo
            ? LessThanOrEqual(parseDateEnd(shipDateTo)!)
            : undefined;

    const dated: FindOptionsWhere<ShipmentOrder> = {
      ...common,
      ...(dueRange && { dueDate: dueRange }),
      ...(shipRange && { shipDate: shipRange }),
    };

    // 상태 명시 → 해당 상태만(기간 적용, 미완료-always 무시)
    // 상태 미지정 + 기간 있음 + includeOpen → 기간 내 전체 + 기간 밖 미완료도 포함
    let where: FindOptionsWhere<ShipmentOrder> | FindOptionsWhere<ShipmentOrder>[];
    if (status) {
      where = { ...dated, status };
    } else if (includeOpen && (shipRange || dueRange)) {
      where = [dated, { ...common, status: In(OPEN_STATUSES) }];
    } else {
      where = dated;
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

    // 고객명은 거래처마스터에서 조인해 표시(저장값이 아니라 현재 이름)
    const custMap = await this.customerNameMap(data.map((o) => o.customerId), company, plant);

    // 출하지시별 구성 팔레트수/박스수 집계 (PalletMaster.boxCount는 박스 할당 시 갱신되는 신뢰값)
    const palletsForOrders = orderNos.length > 0
      ? await this.palletRepository.find({
          where: { shipOrderNo: In(orderNos), ...this.tenantWhere(company, plant) },
          select: ['palletNo', 'shipOrderNo', 'boxCount'],
        })
      : [];
    const palletCountMap = new Map<string, number>();
    const boxCountMap = new Map<string, number>();
    for (const p of palletsForOrders) {
      const key = p.shipOrderNo ?? '';
      palletCountMap.set(key, (palletCountMap.get(key) ?? 0) + 1);
      boxCountMap.set(key, (boxCountMap.get(key) ?? 0) + (p.boxCount ?? 0));
    }

    const resultData = data.map((order) => {
      const items = allItems
        .filter((i) => i.shipOrderNo === order.shipOrderNo)
        .map((item) => ({
          ...item,
          itemName: partMap.get(item.itemCode),
        }));
      return {
        ...order,
        customerName: custMap.get(order.customerId ?? '') ?? order.customerName,
        items,
        palletCount: palletCountMap.get(order.shipOrderNo) ?? 0,
        boxCount: boxCountMap.get(order.shipOrderNo) ?? 0,
      };
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
      customerName: (await this.resolveCustomerName(order.customerId, company, plant)) ?? order.customerName,
      items: itemsWithPart,
    };
  }

  /** 출하지시 생성 */
  async create(dto: CreateShipOrderDto, company?: string, plant?: string) {
    this.assertRequiredShipDate(dto.shipDate);
    let savedShipOrderNo!: string;
    await this.tx.run(async (queryRunner) => {
      const shipOrderNo = dto.shipOrderNo?.trim() || await this.numbering.nextShipmentNo(queryRunner);
      const existing = await this.shipOrderRepository.findOne({
        where: { shipOrderNo, ...this.tenantWhere(company, plant) },
      });
      if (existing) throw new ConflictException(`이미 존재하는 출하지시 번호입니다: ${shipOrderNo}`);

      const order = this.shipOrderRepository.create({
        shipOrderNo,
        customerId: dto.customerId,
        // 고객명은 거래처마스터(customerId)에서 해석해 채운다(프론트 입력값 사용 안 함)
        customerName: await this.resolveCustomerName(dto.customerId, company, plant),
        customerPoNo: dto.customerPoNo,
        dueDate: parseDateStart(dto.dueDate),
        shipDate: parseDateStart(dto.shipDate),
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
      // 고객사 변경 시 고객명은 거래처마스터에서 재해석
      if (orderData.customerId !== undefined) {
        updateData.customerName = await this.resolveCustomerName(orderData.customerId, company, plant);
      }

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
   * 출하지시 확정취소 (CONFIRMED -> DRAFT)
   * 빈 OPEN 팔레트는 같이 정리하고, 박스/출하수량/마감 이후 팔레트가 있으면 차단한다.
   */
  async unconfirm(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant);
    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('CONFIRMED 상태에서만 확정취소할 수 있습니다.');
    }

    const shippedQty = (order.items ?? []).reduce((sum, item) => sum + (Number(item.shippedQty) || 0), 0);
    if (shippedQty > 0) {
      throw new BadRequestException('출하수량이 있는 출하지시는 확정취소할 수 없습니다.');
    }

    const where = { shipOrderNo, ...this.tenantWhere(company, plant) };
    const pallets = await this.palletRepository.find({
      where,
      select: ['palletNo', 'status', 'shipmentId', 'boxCount', 'totalQty'],
    });
    const palletNos = pallets.map((pallet) => pallet.palletNo);
    const boxWhere = palletNos.length > 0
      ? [
          where,
          { palletNo: In(palletNos), ...this.tenantWhere(company, plant) },
        ]
      : where;
    const blockingPallets = pallets.filter((pallet) =>
      pallet.status !== 'OPEN' ||
      !!pallet.shipmentId ||
      (Number(pallet.boxCount) || 0) > 0 ||
      (Number(pallet.totalQty) || 0) > 0
    );
    const boxCount = await this.boxRepository.count({ where: boxWhere });
    if (boxCount > 0 || blockingPallets.length > 0) {
      const parts: string[] = [];
      if (blockingPallets.length > 0) {
        parts.push(`팔레트 ${blockingPallets.map((pallet) => pallet.palletNo).join(', ')}`);
      }
      if (boxCount > 0) {
        const blockingBoxes = await this.boxRepository.find({ where: boxWhere, select: ['boxNo'] });
        parts.push(`박스 ${blockingBoxes.map((box) => box.boxNo).join(', ')}`);
      }
      throw new BadRequestException(`확정취소 불가 — 배정된 ${parts.join(' / ')}를 먼저 해제하세요.`);
    }

    if (palletNos.length > 0) {
      await this.tx.run(async (queryRunner) => {
        await queryRunner.manager.delete(PalletMaster, { palletNo: In(palletNos), ...where });
        await queryRunner.manager.update(ShipmentOrder, where, { status: 'DRAFT' });
      });
      return this.findById(shipOrderNo, company, plant);
    }

    await this.shipOrderRepository.update(where, { status: 'DRAFT' });

    return this.findById(shipOrderNo, company, plant);
  }

  /** 출하지시 중심 팔레트 작업 현황 */
  async getFulfillment(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant) as ShipmentOrder & { items: ShipmentOrderItem[] };
    const lines = (order.items ?? []).map((item) => ({
      ...item,
      remainingQty: Math.max(0, item.orderQty - item.shippedQty),
    }));
    const itemCodes = [...new Set(lines.filter((line) => line.remainingQty > 0).map((line) => line.itemCode))];
    const oqcEnabled = await this.sysConfig.isEnabled('OQC_ENABLED');

    const [candidateBoxes, pallets, shipments] = await Promise.all([
      itemCodes.length
        ? this.boxRepository.find({
            where: {
              itemCode: In(itemCodes),
              status: 'CLOSED',
              ...(oqcEnabled ? { oqcStatus: 'PASS' } : {}),
              palletNo: IsNull(),
              ...this.tenantWhere(company, plant),
            },
            order: { createdAt: 'ASC' },
            take: 500,
          })
        : Promise.resolve([]),
      this.palletRepository.find({
        where: { shipOrderNo, ...this.tenantWhere(company, plant) },
        order: { createdAt: 'ASC' },
      }),
      this.shipmentRepository.find({
        where: { shipOrderNo, ...this.tenantWhere(company, plant) },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const palletNos = pallets.map((pallet) => pallet.palletNo);
    const palletBoxes = palletNos.length > 0
      ? await this.boxRepository.find({
          where: { palletNo: In(palletNos), ...this.tenantWhere(company, plant) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const boxesByPallet = new Map<string, BoxMaster[]>();
    for (const box of palletBoxes) {
      if (!box.palletNo) continue;
      boxesByPallet.set(box.palletNo, [...(boxesByPallet.get(box.palletNo) ?? []), box]);
    }

    return {
      order,
      lines,
      candidateBoxes,
      pallets: pallets.map((pallet) => ({ ...pallet, id: pallet.palletNo, boxes: boxesByPallet.get(pallet.palletNo) ?? [] })),
      shipments: shipments.map((shipment) => ({ ...shipment, id: shipment.shipNo })),
    };
  }

  /** 출하지시에 귀속된 팔레트 생성 */
  async createPalletForOrder(shipOrderNo: string, dto: CreateShipOrderPalletDto, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant) as ShipmentOrder & { items: ShipmentOrderItem[] };
    this.assertOrderLineMap(order);

    const existingOrderPallets = await this.palletRepository.find({
      where: { shipOrderNo, ...this.tenantWhere(company, plant) },
      select: ['palletNo', 'shipOrderNo', 'status'],
    });
    if (existingOrderPallets.length > 0) {
      throw new BadRequestException(
        `이미 팔레트가 생성된 출하지시입니다: ${shipOrderNo}`,
      );
    }

    return this.tx.run(async (qr) => {
      const palletNo = dto.palletNo?.trim() || await this.numbering.nextPalletNo(qr);
      const existing = await this.palletRepository.findOne({
        where: { palletNo, ...this.tenantWhere(company, plant) },
      });
      if (existing) throw new ConflictException(`이미 존재하는 팔레트번호입니다: ${palletNo}`);

      const pallet = this.palletRepository.create({
        palletNo,
        shipOrderNo,
        shipmentId: null,
        boxCount: 0,
        totalQty: 0,
        status: 'OPEN',
        company: company || null,
        plant: plant || null,
      });
      const saved = await qr.manager.save(pallet);
      return { ...saved, id: saved.palletNo };
    });
  }

  /** 출하지시 팔레트에 박스 적재 */
  async addBoxesToOrderPallet(
    shipOrderNo: string,
    palletNo: string,
    dto: AddBoxToPalletDto,
    company?: string,
    plant?: string,
  ) {
    const order = await this.findById(shipOrderNo, company, plant) as ShipmentOrder & { items: ShipmentOrderItem[] };
    const lineByItem = this.assertOrderLineMap(order);

    const pallet = await this.palletRepository.findOne({
      where: { palletNo, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${palletNo}`);
    if (pallet.shipOrderNo !== shipOrderNo) {
      throw new BadRequestException(`해당 출하지시의 팔레트가 아닙니다: ${palletNo}`);
    }
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`OPEN 상태 팔레트에만 박스를 적재할 수 있습니다. 현재: ${pallet.status}`);
    }

    const boxes = await this.boxRepository.find({
      where: { boxNo: In(dto.boxIds), ...this.tenantWhere(company, plant) },
    });
    if (boxes.length !== dto.boxIds.length) {
      const foundNos = boxes.map((box) => box.boxNo);
      const notFound = dto.boxIds.filter((boxNo) => !foundNos.includes(boxNo));
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${notFound.join(', ')}`);
    }

    const invalidItem = boxes.find((box) => !lineByItem.has(box.itemCode));
    if (invalidItem) throw new BadRequestException(`출하지시에 없는 품목입니다: ${invalidItem.itemCode}`);

    const invalidStatus = boxes.filter((box) => box.status !== 'CLOSED');
    if (invalidStatus.length > 0) {
      throw new BadRequestException(`CLOSED 상태가 아닌 박스가 있습니다: ${invalidStatus.map((box) => box.boxNo).join(', ')}`);
    }

    const oqcEnabled = await this.sysConfig.isEnabled('OQC_ENABLED');
    if (oqcEnabled) {
      const oqcBlocked = boxes.filter((box) => box.oqcStatus !== 'PASS');
      if (oqcBlocked.length > 0) {
        throw new BadRequestException(`OQC 미완료/불합격 박스는 적재할 수 없습니다: ${oqcBlocked.map((box) => box.boxNo).join(', ')}`);
      }
    }

    const assignedOther = boxes.filter((box) => box.palletNo && box.palletNo !== palletNo);
    if (assignedOther.length > 0) {
      throw new BadRequestException(`이미 다른 팔레트에 적재된 박스입니다: ${assignedOther.map((box) => box.boxNo).join(', ')}`);
    }

    const allocated = await this.getAllocatedQtyByItem(shipOrderNo, company, plant);
    const newQtyByItem = new Map<string, number>();
    for (const box of boxes) {
      if (box.palletNo === palletNo) continue;
      newQtyByItem.set(box.itemCode, (newQtyByItem.get(box.itemCode) ?? 0) + box.qty);
    }
    for (const [itemCode, newQty] of newQtyByItem) {
      const line = lineByItem.get(itemCode)!;
      const remaining = line.orderQty - line.shippedQty;
      const afterAllocated = (allocated.get(itemCode) ?? 0) + newQty;
      if (afterAllocated > remaining) {
        throw new BadRequestException(`출하지시 잔량을 초과합니다: ${itemCode} 잔량 ${remaining}, 구성 후 ${afterAllocated}`);
      }
    }

    await this.tx.run(async (qr) => {
      await qr.manager.update(
        BoxMaster,
        { boxNo: In(dto.boxIds), ...this.tenantWhere(company, plant) },
        { palletNo },
      );

      const summary = await qr.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo })
        .andWhere(company ? 'box.company = :company' : '1=1', { company })
        .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await qr.manager.update(
        PalletMaster,
        { palletNo, ...this.tenantWhere(company, plant) },
        {
          boxCount: parseInt(summary?.count, 10) || 0,
          totalQty: parseInt(summary?.totalQty, 10) || 0,
        },
      );
    });

    return this.getFulfillment(shipOrderNo, company, plant);
  }

  /** 출하지시 팔레트에서 박스 제거 */
  async removeBoxesFromOrderPallet(
    shipOrderNo: string,
    palletNo: string,
    dto: RemoveBoxFromPalletDto,
    company?: string,
    plant?: string,
  ) {
    const pallet = await this.palletRepository.findOne({
      where: { palletNo, shipOrderNo, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) throw new NotFoundException(`출하지시 팔레트를 찾을 수 없습니다: ${palletNo}`);
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`OPEN 상태 팔레트에서만 박스를 제거할 수 있습니다. 현재: ${pallet.status}`);
    }

    await this.tx.run(async (qr) => {
      await qr.manager.update(
        BoxMaster,
        { boxNo: In(dto.boxIds), palletNo, ...this.tenantWhere(company, plant) },
        { palletNo: null },
      );

      const summary = await qr.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo })
        .andWhere(company ? 'box.company = :company' : '1=1', { company })
        .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await qr.manager.update(PalletMaster, { palletNo, ...this.tenantWhere(company, plant) }, {
        boxCount: parseInt(summary?.count, 10) || 0,
        totalQty: parseInt(summary?.totalQty, 10) || 0,
      });
    });

    return this.getFulfillment(shipOrderNo, company, plant);
  }

  /** 팔레트 라벨 발행 완료: OPEN -> CLOSED */
  async closeOrderPallet(shipOrderNo: string, palletNo: string, company?: string, plant?: string) {
    const pallet = await this.palletRepository.findOne({
      where: { palletNo, shipOrderNo, ...this.tenantWhere(company, plant) },
    });
    if (!pallet) throw new NotFoundException(`출하지시 팔레트를 찾을 수 없습니다: ${palletNo}`);
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`OPEN 상태 팔레트만 라벨 발행 완료 처리할 수 있습니다. 현재: ${pallet.status}`);
    }
    if (pallet.boxCount <= 0) throw new BadRequestException('빈 팔레트는 라벨 발행 완료 처리할 수 없습니다.');

    await this.palletRepository.update(
      { palletNo, shipOrderNo, ...this.tenantWhere(company, plant) },
      { status: 'CLOSED', closeAt: new Date() },
    );
    return this.getFulfillment(shipOrderNo, company, plant);
  }

  /** 출하지시 팔레트 바코드 스캔 후 제품출하 확정 */
  async shipOrderPallets(shipOrderNo: string, dto: ShipOrderPalletsDto, company?: string, plant?: string) {
    const order = await this.findById(shipOrderNo, company, plant) as ShipmentOrder & { items: ShipmentOrderItem[] };
    const lineByItem = this.assertOrderLineMap(order);

    const pallets = await this.palletRepository.find({
      where: { palletNo: In(dto.palletNos), shipOrderNo, ...this.tenantWhere(company, plant) },
    });
    if (pallets.length !== dto.palletNos.length) {
      const found = new Set(pallets.map((pallet) => pallet.palletNo));
      throw new NotFoundException(`출하지시에 없는 팔레트입니다: ${dto.palletNos.filter((no) => !found.has(no)).join(', ')}`);
    }
    const invalid = pallets.filter((pallet) => pallet.status !== 'CLOSED' || pallet.shipmentId);
    if (invalid.length > 0) {
      throw new BadRequestException(`출하대기(CLOSED) 상태가 아닌 팔레트가 있습니다: ${invalid.map((p) => p.palletNo).join(', ')}`);
    }

    const boxes = await this.boxRepository.find({
      where: { palletNo: In(dto.palletNos), ...this.tenantWhere(company, plant) },
    });
    if (boxes.length === 0) throw new BadRequestException('출하 처리할 박스가 없습니다.');

    const itemQtyMap = new Map<string, number>();
    const fgBarcodes: string[] = [];
    const oqcEnabled = await this.sysConfig.isEnabled('OQC_ENABLED');
    for (const box of boxes) {
      if (!lineByItem.has(box.itemCode)) throw new BadRequestException(`출하지시에 없는 품목입니다: ${box.itemCode}`);
      if (box.status !== 'CLOSED') throw new BadRequestException(`CLOSED 상태가 아닌 박스가 있습니다: ${box.boxNo}`);
      if (oqcEnabled && box.oqcStatus !== 'PASS') throw new BadRequestException(`OQC 미완료/불합격 박스가 포함되었습니다: ${box.boxNo}`);
      itemQtyMap.set(box.itemCode, (itemQtyMap.get(box.itemCode) ?? 0) + box.qty);
      if (box.serialList) {
        try {
          const serials: string[] = JSON.parse(box.serialList);
          if (serials.length > 0 && serials.length !== box.qty) {
            throw new BadRequestException(`박스 수량(${box.qty})과 시리얼 수량(${serials.length})이 일치하지 않습니다: ${box.boxNo}`);
          }
          fgBarcodes.push(...serials);
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          throw new BadRequestException(`박스 시리얼 목록을 해석할 수 없습니다: ${box.boxNo}`);
        }
      }
    }
    for (const [itemCode, qty] of itemQtyMap) {
      const line = lineByItem.get(itemCode)!;
      if (line.shippedQty + qty > line.orderQty) {
        throw new BadRequestException(`출하수량 초과: ${itemCode} 지시 ${line.orderQty}, 기출하 ${line.shippedQty}, 요청 ${qty}`);
      }
    }

    let shipNo!: string;
    await this.tx.run(async (qr) => {
      shipNo = await this.numbering.nextShipmentNo(qr);
      const existing = await this.shipmentRepository.findOne({
        where: { shipNo, ...this.tenantWhere(company, plant) },
      });
      if (existing) throw new ConflictException(`이미 존재하는 출하번호입니다: ${shipNo}`);

      const shipment = this.shipmentRepository.create({
        shipNo,
        shipDate: order.shipDate ?? new Date(),
        shipAt: new Date(),
        customer: order.customerName,
        destination: order.customerName,
        shipOrderNo,
        palletCount: pallets.length,
        boxCount: boxes.length,
        totalQty: boxes.reduce((sum, box) => sum + box.qty, 0),
        status: 'LOADED',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
      await qr.manager.save(shipment);

      await qr.manager.update(
        PalletMaster,
        { palletNo: In(dto.palletNos), shipOrderNo, ...this.tenantWhere(company, plant) },
        { shipmentId: shipNo, status: 'SHIPPED' },
      );
      await qr.manager.update(
        BoxMaster,
        { palletNo: In(dto.palletNos), ...this.tenantWhere(company, plant) },
        { status: 'SHIPPED', shipOrderNo, shippedAt: new Date() },
      );
      if (fgBarcodes.length > 0) {
        await qr.manager.update(FgLabel, { fgBarcode: In(fgBarcodes), ...this.tenantWhere(company, plant) }, { status: 'SHIPPED' });
      }

      const warehouse = await qr.manager.findOne(Warehouse, {
        where: { warehouseType: 'FG', isDefault: 'Y', ...this.tenantWhere(company, plant) },
      });
      if (!warehouse) throw new BadRequestException('FG 기본창고(IS_DEFAULT=Y)가 설정되어 있지 않습니다.');

      for (const [itemCode, qty] of itemQtyMap) {
        await this.productInventory.issueStockByItemFifoInTx(qr, {
          warehouseId: warehouse.warehouseCode,
          itemCode,
          qty,
          transType: 'FG_OUT',
          refType: 'SHIPMENT',
          refId: shipNo,
          workerId: dto.workerId,
          remark: `출하지시 팔레트출하:${shipOrderNo}`,
          company,
          plant,
        });

        const line = lineByItem.get(itemCode)!;
        await qr.manager.update(
          ShipmentOrderItem,
          { shipOrderNo, seq: line.seq, ...this.tenantWhere(company, plant) },
          { shippedQty: line.shippedQty + qty },
        );
      }

      const fullyShipped = order.items.every((line) => {
        const shipped = line.shippedQty + (itemQtyMap.get(line.itemCode) ?? 0);
        return shipped >= line.orderQty;
      });
      if (fullyShipped) {
        await qr.manager.update(ShipmentOrder, { shipOrderNo, ...this.tenantWhere(company, plant) }, { status: 'CLOSED' });
      }

      await qr.manager.update(
        ShipmentLog,
        { shipNo, ...this.tenantWhere(company, plant) },
        { status: 'SHIPPED', shipAt: new Date() },
      );
    });

    return {
      shipNo,
      shipOrderNo,
      palletNos: dto.palletNos,
      shipped: true,
    };
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

      // 재고 차감 — FG_MAIN 재고를 수량 기준 FIFO로 차감한다(재고 키 체계와 무관).
      // 입고는 배치 시리얼({orderNo}-NNN)로, 박스는 FG바코드로 키잉돼 시리얼이 어긋나도
      // 수량 기준이라 정상 출하된다. 시리얼 단위 추적은 아래 FG_LABELS → SHIPPED 전이가 담당.
      await this.productInventory.issueStockByItemFifoInTx(qr, {
        warehouseId: warehouse.warehouseCode,
        itemCode: box.itemCode,
        qty: box.qty,
        transType: 'FG_OUT',
        refType: 'SHIP_ORDER',
        refId: shipOrderNo,
        workerId: dto.workerId,
        remark: `출하지시 박스출하:${dto.boxNo}`,
        company,
        plant,
      });

      await qr.manager.update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'SHIPPED', shipOrderNo, shippedAt: new Date() });
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
   * 출하지시 박스 출하 취소 트랜잭션 본문 헬퍼 (외부 트랜잭션 합성용).
   * 출하 직전 상태로 되돌린다: 제품재고 복원 + 박스 CLOSED + FG_LABEL PACKED + 라인 shippedQty 차감 + 지시 CONFIRMED.
   */
  async cancelShipBoxInTx(
    qr: import('typeorm').QueryRunner,
    shipOrderNo: string,
    boxNo: string,
    workerId?: string,
    company?: string,
    plant?: string,
  ): Promise<{ shipOrderNo: string; boxNo: string; itemCode: string; qty: number; lineShippedQty: number; lineOrderQty: number; orderStatus: string; canceled: boolean }> {
    const where = this.tenantWhere(company, plant);

    const order = await qr.manager.findOne(ShipmentOrder, { where: { shipOrderNo, ...where } });
    if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);
    if (!['CONFIRMED', 'CLOSED'].includes(order.status)) {
      throw new BadRequestException(`출하 취소는 CONFIRMED/CLOSED 지시만 가능합니다. 현재: ${order.status}`);
    }

    const box = await qr.manager.findOne(BoxMaster, { where: { boxNo, ...where } });
    if (!box) throw new NotFoundException(`박스를 찾을 수 없습니다: ${boxNo}`);
    if (box.status !== 'SHIPPED') {
      throw new BadRequestException(`출하된(SHIPPED) 박스만 출하 취소할 수 있습니다: ${boxNo}`);
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
      throw new BadRequestException(`박스 수량(${box.qty})과 시리얼 수량(${serials.length})이 일치하지 않습니다: ${boxNo}`);
    }

    const originalFgOut = await qr.manager.findOne(ProductTransaction, {
      where: {
        transType: 'FG_OUT',
        refType: 'SHIP_ORDER',
        refId: shipOrderNo,
        itemCode: box.itemCode,
        qty: -box.qty,
        status: 'DONE',
        remark: `출하지시 박스출하:${boxNo}`,
        ...where,
      },
    });
    if (!originalFgOut) {
      throw new BadRequestException(`출하 원장(FG_OUT)을 찾을 수 없어 취소할 수 없습니다: ${boxNo}`);
    }
    if (originalFgOut.fromWarehouseId !== warehouse.warehouseCode) {
      throw new BadRequestException(`출하 원장 창고가 현재 FG 기본창고와 일치하지 않습니다: ${boxNo}`);
    }

    // 재고 복원 — 원본 FG_OUT을 표준 수불 취소로 역분개해 원본 CANCELED + CANCEL_REF_ID 연결을 남긴다.
    await this.productInventory.cancelTransactionInTx(qr, originalFgOut, {
      transactionId: originalFgOut.transNo,
      workerId,
      remark: `출하지시 박스출하 취소:${boxNo}`,
    });

    await qr.manager.update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'CLOSED', shippedAt: null, shipOrderNo: null });
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
  }

  /**
   * 출하지시 기반 박스 출하 취소.
   * 출하 직전 상태로 되돌린다: 제품재고 복원 + 박스 CLOSED + FG_LABEL PACKED + 라인 shippedQty 차감 + 지시 CONFIRMED.
   */
  async cancelShipBox(shipOrderNo: string, dto: ShipBoxDto, company?: string, plant?: string) {
    return this.tx.run((qr) => this.cancelShipBoxInTx(qr, shipOrderNo, dto.boxNo, dto.workerId, company, plant));
  }

  /**
   * 출하지시 단위 출하취소: 팔레트출하분 reverse/cancel + 박스출하분 cancel-ship-box를
   * 단일 트랜잭션으로 합성하고 SHIPPING_RETURNS에 취소이력을 기록한다.
   * ERP 가드는 트랜잭션 진입 전 사전조회 시점에 검증한다(부분 부작용 방지).
   */
  async cancelOrderShipment(shipOrderNo: string, dto: CancelOrderShipmentDto, company?: string, plant?: string) {
    const where = this.tenantWhere(company, plant);

    // 사전 조회(검증용)
    const shipments = await this.shipmentRepository.find({
      where: { shipOrderNo, ...where },
    });
    const activeShipments = shipments.filter((s) => ['PREPARING', 'LOADED', 'SHIPPED'].includes(s.status));
    const looseBoxes = await this.boxRepository.find({
      where: { shipOrderNo, palletNo: IsNull(), status: 'SHIPPED', ...where },
    });

    if (activeShipments.length === 0 && looseBoxes.length === 0) {
      throw new BadRequestException('취소할 출하분이 없습니다.');
    }
    // ERP 가드: 하나라도 연동완료면 전체 중단 (트랜잭션 진입 전 — 부분 부작용 방지)
    const erpBlocked = activeShipments.find((s) => s.erpSyncYn === 'Y');
    if (erpBlocked) {
      throw new BadRequestException(
        `ERP 연동이 완료된 출하(${erpBlocked.shipNo})가 포함되어 취소할 수 없습니다. ERP 연동분부터 정리해 주세요.`,
      );
    }

    const canceledShipments: string[] = [];
    const canceledBoxes: string[] = [];
    const totalByItem = new Map<string, number>();

    let returnNo!: string;
    await this.tx.run(async (qr) => {
      // 1) 팔레트출하분: SHIPPED→reverse 후 CANCELED 마감+팔레트 분리, PREPARING/LOADED→cancel
      //    트랜잭션 내에서 shipment를 잠금 재조회 + 상태/ERP 재검증(비잠금 사전조회의 동시성 창 제거)
      for (const s0 of activeShipments) {
        const s = await qr.manager.findOne(ShipmentLog, {
          where: { shipNo: s0.shipNo, ...where },
          lock: { mode: 'pessimistic_write' },
        });
        if (!s) throw new BadRequestException(`출하건을 찾을 수 없습니다: ${s0.shipNo}`);
        if (s.erpSyncYn === 'Y') {
          throw new BadRequestException(`ERP 연동이 완료된 출하(${s.shipNo})가 포함되어 취소할 수 없습니다. ERP 연동분부터 정리해 주세요.`);
        }
        if (!['PREPARING', 'LOADED', 'SHIPPED'].includes(s.status)) {
          throw new BadRequestException(`이미 처리된 출하입니다: ${s.shipNo} (현재 ${s.status})`);
        }
        if (s.status === 'SHIPPED') {
          // 재고복원/라벨/팔레트 LOADED/박스 CLOSED/shippedQty 복원; 품목별 복원수량 맵 반환
          const reversedMap = await this.shipmentService.reverseShipmentInTx(qr, s, dto.reason, company, plant);
          for (const [code, q] of reversedMap) {
            totalByItem.set(code, (totalByItem.get(code) ?? 0) + q);
          }
          // 되돌린 후 출하 자체를 취소 마감 + 팔레트 분리(CLOSED)
          await qr.manager.update(
            PalletMaster,
            { shipmentId: s.shipNo, ...where },
            { shipmentId: null, status: 'CLOSED' },
          );
          await qr.manager.update(
            ShipmentLog,
            { shipNo: s.shipNo, ...where },
            { status: 'CANCELED', palletCount: 0, boxCount: 0, totalQty: 0, remark: `출하취소:${dto.reason}` },
          );
        } else {
          await this.shipmentService.cancelInTx(qr, s, dto.reason, company, plant);
        }
        canceledShipments.push(s.shipNo);
      }

      // 2) 박스출하분: cancel-ship-box(재고복원/박스 CLOSED/라벨/shippedQty 복원)
      for (const b of looseBoxes) {
        const res = await this.cancelShipBoxInTx(qr, shipOrderNo, b.boxNo, dto.workerId, company, plant);
        canceledBoxes.push(b.boxNo);
        totalByItem.set(res.itemCode, (totalByItem.get(res.itemCode) ?? 0) + res.qty);
      }

      // 3) 취소이력(SHIPPING_RETURNS) 자동 생성: 팔레트출하분 + 박스출하분 합산 항목화
      returnNo = await this.numbering.nextReturnNo(qr);
      const ret = qr.manager.create(ShipmentReturn, {
        returnNo,
        shipmentId: shipOrderNo,
        returnDate: new Date(),
        returnReason: dto.reason,
        status: 'COMPLETED',
        remark: `출하취소(shipments:${canceledShipments.join(',') || '-'} / boxes:${canceledBoxes.length})`,
        company,
        plant,
      });
      await qr.manager.save(ret);

      let seq = 1;
      const returnItems = [...totalByItem].map(([itemCode, qty]) =>
        qr.manager.create(ShipmentReturnItem, {
          returnNo,
          seq: seq++,
          itemCode,
          returnQty: qty,
          disposalType: 'RESTOCK',
          company,
          plant,
        }),
      );
      if (returnItems.length > 0) {
        await qr.manager.save(returnItems);
      }
    });

    const restoredQty = [...totalByItem.values()].reduce((a, b) => a + b, 0);
    return { shipOrderNo, canceledShipments, canceledBoxes, restoredQty, returnNo };
  }

  /** 좌측 출하이력: 출하분(SHIPPED 박스)이 있는 출하지시 단위 통합 목록 */
  async findShippedOrders(company?: string, plant?: string) {
    const rows: Array<{
      SHIP_ORDER_NO: string; CUSTOMER_NAME: string | null; SHIP_DATE: Date | null;
      SHIPPED_QTY: number; PALLET_BOXES: number; LOOSE_BOXES: number;
      PALLET_COUNT: number; ERP_SYNCED: number;
    }> = await this.boxRepository.manager.query(
      `SELECT b.SHIP_ORDER_NO,
              o.CUSTOMER_NAME,
              o.SHIP_DATE,
              SUM(b.QTY)                                              AS SHIPPED_QTY,
              SUM(CASE WHEN b.PALLET_NO IS NOT NULL THEN 1 ELSE 0 END) AS PALLET_BOXES,
              SUM(CASE WHEN b.PALLET_NO IS NULL THEN 1 ELSE 0 END)     AS LOOSE_BOXES,
              COUNT(DISTINCT b.PALLET_NO)                             AS PALLET_COUNT,
              NVL((SELECT MAX(CASE WHEN s.ERP_SYNC_YN = 'Y' THEN 1 ELSE 0 END)
                     FROM SHIPMENT_LOGS s
                    WHERE s.SHIP_ORDER_NO = b.SHIP_ORDER_NO
                      AND s.COMPANY = b.COMPANY AND s.PLANT_CD = b.PLANT_CD), 0) AS ERP_SYNCED
         FROM BOX_MASTERS b
         JOIN SHIPMENT_ORDERS o
           ON o.SHIP_ORDER_NO = b.SHIP_ORDER_NO
          AND o.COMPANY = b.COMPANY AND o.PLANT_CD = b.PLANT_CD
        WHERE b.STATUS = 'SHIPPED'
          AND b.SHIP_ORDER_NO IS NOT NULL
          AND b.COMPANY = :1 AND b.PLANT_CD = :2
        GROUP BY b.SHIP_ORDER_NO, o.CUSTOMER_NAME, o.SHIP_DATE, b.COMPANY, b.PLANT_CD
        ORDER BY o.SHIP_DATE DESC NULLS LAST, b.SHIP_ORDER_NO DESC`,
      [company, plant],
    );

    const data = rows.map((r) => ({
      shipOrderNo: r.SHIP_ORDER_NO,
      customerName: r.CUSTOMER_NAME,
      shipDate: r.SHIP_DATE,
      shippedQty: Number(r.SHIPPED_QTY) || 0,
      palletCount: Number(r.PALLET_COUNT) || 0,
      boxCount: (Number(r.PALLET_BOXES) || 0) + (Number(r.LOOSE_BOXES) || 0),
      shipType: Number(r.PALLET_BOXES) > 0 && Number(r.LOOSE_BOXES) > 0
        ? 'MIXED'
        : Number(r.PALLET_BOXES) > 0 ? 'PALLET' : 'BOX',
      hasErpSynced: Number(r.ERP_SYNCED) === 1,
    }));
    return { data };
  }

  /** 우측 상세: 선택 출하지시의 팔레트(+박스) 및 박스출하(palletNo '*') */
  async getShippedDetail(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.shipOrderRepository.findOne({
      where: { shipOrderNo, ...this.tenantWhere(company, plant) },
      select: ['shipOrderNo', 'customerName', 'shipDate'],
    });
    if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);

    const pallets = await this.palletRepository.find({
      where: { shipOrderNo, status: In(['LOADED', 'SHIPPED']), ...this.tenantWhere(company, plant) },
      order: { createdAt: 'ASC' },
    });
    const palletNos = pallets.map((p) => p.palletNo);
    const palletBoxes = palletNos.length
      ? await this.boxRepository.find({ where: { palletNo: In(palletNos), ...this.tenantWhere(company, plant) }, order: { createdAt: 'ASC' } })
      : [];
    const boxesByPallet = new Map<string, typeof palletBoxes>();
    for (const b of palletBoxes) {
      if (!b.palletNo) continue;
      boxesByPallet.set(b.palletNo, [...(boxesByPallet.get(b.palletNo) ?? []), b]);
    }

    const looseBoxes = await this.boxRepository.find({
      where: { shipOrderNo, palletNo: IsNull(), status: 'SHIPPED', ...this.tenantWhere(company, plant) },
      order: { shippedAt: 'ASC' },
    });

    return {
      order,
      pallets: pallets.map((p) => ({
        palletNo: p.palletNo, status: p.status, boxCount: p.boxCount, totalQty: p.totalQty,
        shipNo: p.shipmentId ?? null, erpSyncYn: null,
        boxes: (boxesByPallet.get(p.palletNo) ?? []).map((b) => ({ boxNo: b.boxNo, itemCode: b.itemCode, qty: b.qty })),
      })),
      boxShipped: looseBoxes.map((b) => ({ boxNo: b.boxNo, itemCode: b.itemCode, qty: b.qty, palletNo: '*', shippedAt: b.shippedAt })),
    };
  }
}
