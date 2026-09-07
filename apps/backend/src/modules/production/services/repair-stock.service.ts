/**
 * @file repair-stock.service.ts
 * @description 수리 대상 재고 인수와 종결의 부품 소비/양품 복귀를 호출자 트랜잭션 안에서 처리한다.
 * 수리실 보관 수량은 수리오더와 REPAIR 원장이 담당한다. 시작 이후 품목/수량은 변경하지 않는다.
 * 호출자는 먼저 해당 RepairOrder를 pessimistic_write로 잠그고 상태 전이를 검증해야 한다.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { isProductStockOnHold } from '@harness/shared';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { RepairUsedPart } from '../../../entities/repair-used-part.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { MatIssueService } from '../../material/services/mat-issue.service';

export interface RepairMaterialAllocation {
  itemCode: string;
  matUid: string;
  warehouseCode: string;
  qty: number;
}

@Injectable()
export class RepairStockService {
  constructor(
    private readonly productInventory: ProductInventoryService,
    private readonly matIssue: MatIssueService,
  ) {}

  async startInTx(qr: QueryRunner, order: RepairOrder, warehouseCode: string): Promise<void> {
    this.assertOrder(order);
    if ((await this.movements(qr, order)).length) {
      throw new BadRequestException('이미 재고를 출고한 수리오더입니다.');
    }
    await this.activeWarehouse(qr, order, warehouseCode, ['WIP', 'FG', 'DEFECT']);
    const item = await qr.manager.findOne(ItemMaster, {
      where: { itemCode: order.itemCode, ...this.tenant(order) },
    });
    if (!item || item.useYn !== 'Y' || !['FINISHED', 'SEMI_PRODUCT'].includes(item.itemType)) {
      throw new BadRequestException('수리 대상은 사용 중인 반제품/완제품 품목이어야 합니다.');
    }
    const stock = await qr.manager.findOne(ProductStock, {
      where: { warehouseCode, itemCode: order.itemCode, qualityStatus: this.sourceQuality(order), ...this.tenant(order) },
      lock: { mode: 'pessimistic_write' },
    });
    if (!stock || stock.qty < order.qty || stock.availableQty < order.qty || isProductStockOnHold(stock.status)) {
      throw new BadRequestException('수리할 대상 가용재고가 부족하거나 보류 상태입니다.');
    }
    if (stock.itemType !== item.itemType) {
      throw new BadRequestException('불량재고와 품목의 제품 구분이 일치하지 않습니다.');
    }
    await this.productInventory.issueStockInTx(qr, {
      warehouseId: warehouseCode,
      itemCode: order.itemCode,
      itemType: stock.itemType,
      prdUid: order.prdUid ?? undefined,
      qualityStatus: this.sourceQuality(order),
      qty: order.qty,
      transType: stock.itemType === 'FINISHED' ? 'FG_OUT' : 'WIP_OUT',
      processCode: order.sourceProcess ?? undefined,
      refType: 'REPAIR',
      refId: String(order.seq),
      workerId: order.workerId ?? undefined,
      remark: `REPAIR:${order.seq} 수리실 인수`,
      ...this.tenant(order),
    });
  }

  async finishInTx(
    qr: QueryRunner,
    order: RepairOrder,
    returnWarehouseCode: string | undefined,
    allocations: RepairMaterialAllocation[],
  ): Promise<void> {
    this.assertOrder(order);
    const origin = await this.startMovement(qr, order);
    const scrap = order.disposition === 'SCRAP';
    if (!scrap) {
      if (!order.returnProcess?.trim()) throw new BadRequestException('복귀 공정이 필요합니다.');
      await this.activeWarehouse(qr, order, returnWarehouseCode, ['WIP', 'FG']);
    }

    await this.validateAllocations(qr, order, allocations);
    // LOT 잠금 순서를 고정하고 기존 자재출고 검증(IQC/보류/가용량)을 재사용한다.
    for (const allocation of [...allocations].sort((a, b) => a.matUid.localeCompare(b.matUid))) {
      await this.matIssue.createInTx(qr, {
        warehouseCode: allocation.warehouseCode,
        issueType: 'REPAIR',
        items: [{ matUid: allocation.matUid, issueQty: allocation.qty }],
        workerId: order.workerId ?? undefined,
        remark: `REPAIR:${order.seq}`,
      }, order.company, order.plant);
    }

    // 폐기는 수리실 인수 때 차감한 수량으로 종결하며 양품을 다시 만들지 않는다.
    if (scrap) return;
    await this.productInventory.receiveStockInTx(qr, {
      warehouseId: returnWarehouseCode!,
      itemCode: order.itemCode,
      itemType: origin.itemType!,
      prdUid: order.prdUid ?? undefined,
      qualityStatus: 'GOOD',
      qty: order.qty,
      transType: origin.itemType === 'FINISHED' ? 'FG_IN' : 'WIP_IN',
      orderNo: origin.orderNo ?? undefined,
      processCode: order.returnProcess!,
      refType: 'REPAIR',
      refId: String(order.seq),
      workerId: order.workerId ?? undefined,
      remark: `REPAIR:${order.seq} 수리 종결 복귀`,
      ...this.tenant(order),
    });
  }

  /** 재검사 대기 진입도 실제 수리실 인수 원장에 연결된 오더만 허용한다. */
  async assertStartedInTx(qr: QueryRunner, order: RepairOrder): Promise<void> {
    this.assertOrder(order);
    await this.startMovement(qr, order);
  }

  private async startMovement(qr: QueryRunner, order: RepairOrder): Promise<ProductTransaction> {
    const movements = await this.movements(qr, order);
    const origin = movements[0];
    if (movements.length !== 1 || !origin || origin.status !== 'DONE'
      || origin.qualityStatus !== this.sourceQuality(order) || origin.qty !== -order.qty
      || origin.itemCode !== order.itemCode || origin.company !== order.company || origin.plant !== order.plant
      || !['FG_OUT', 'WIP_OUT'].includes(origin.transType)
      || !['FINISHED', 'SEMI_PRODUCT'].includes(origin.itemType ?? '')
      || !origin.fromWarehouseId || origin.toWarehouseId) {
      throw new BadRequestException('수리 시작 출고 원장이 일치하지 않거나 이미 종결된 수리입니다.');
    }
    return origin;
  }

  private async validateAllocations(qr: QueryRunner, order: RepairOrder, allocations: RepairMaterialAllocation[]) {
    if (!Array.isArray(allocations)) throw new BadRequestException('사용부품 LOT 배분 목록이 필요합니다.');
    const parts = await qr.manager.find(RepairUsedPart, {
      where: { repairDate: order.repairDate, seq: order.seq, ...this.tenant(order) },
    });
    const expected = new Map<string, number>();
    for (const part of parts) {
      this.assertQuantity(part.qty);
      expected.set(part.itemCode, (expected.get(part.itemCode) ?? 0) + part.qty);
    }
    const actual = new Map<string, number>();
    const lots = new Set<string>();
    for (const allocation of allocations) {
      this.assertQuantity(allocation.qty);
      if (!allocation.itemCode?.trim() || !allocation.matUid?.trim() || !allocation.warehouseCode?.trim()) {
        throw new BadRequestException('사용부품 품목, LOT, 출고 창고를 모두 지정해야 합니다.');
      }
      if (lots.has(allocation.matUid)) throw new BadRequestException('같은 자재 LOT는 한 번만 배분할 수 있습니다.');
      lots.add(allocation.matUid);
      actual.set(allocation.itemCode, (actual.get(allocation.itemCode) ?? 0) + allocation.qty);
    }
    if (expected.size !== actual.size || [...expected].some(([itemCode, qty]) => actual.get(itemCode) !== qty)) {
      throw new BadRequestException('사용부품 저장 수량과 LOT 배분 수량이 일치하지 않습니다.');
    }
    for (const allocation of [...allocations].sort((a, b) => a.matUid.localeCompare(b.matUid))) {
      await this.activeWarehouse(qr, order, allocation.warehouseCode);
      const item = await qr.manager.findOne(ItemMaster, {
        where: { itemCode: allocation.itemCode, ...this.tenant(order) },
      });
      if (!item || item.useYn !== 'Y' || item.itemType !== 'RAW_MATERIAL') {
        throw new BadRequestException(`사용부품은 사용 중인 원자재 품목이어야 합니다: ${allocation.itemCode}`);
      }
      const lot = await qr.manager.findOne(MatLot, {
        where: { matUid: allocation.matUid, ...this.tenant(order) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lot || lot.itemCode !== allocation.itemCode) {
        throw new BadRequestException(`사용부품과 LOT 품목이 일치하지 않습니다: ${allocation.matUid}`);
      }
    }
  }

  private async activeWarehouse(qr: QueryRunner, order: RepairOrder, warehouseCode?: string, types?: string[]) {
    if (!warehouseCode?.trim()) throw new BadRequestException('창고를 지정해야 합니다.');
    const warehouse = await qr.manager.findOne(Warehouse, {
      where: { warehouseCode, ...this.tenant(order) },
    });
    if (!warehouse || warehouse.useYn !== 'Y' || (types && !types.includes(warehouse.warehouseType))) {
      throw new BadRequestException(`처리 가능한 사용 중 창고가 아닙니다: ${warehouseCode}`);
    }
    return warehouse;
  }

  private movements(qr: QueryRunner, order: RepairOrder) {
    return qr.manager.find(ProductTransaction, {
      where: { refType: 'REPAIR', refId: String(order.seq), ...this.tenant(order) },
    });
  }

  private tenant(order: RepairOrder) { return { company: order.company, plant: order.plant }; }

  /** 외관검사는 FG 라벨만 불합격으로 바꾸고 재고 품질은 GOOD 그대로 유지한다. */
  private sourceQuality(order: RepairOrder): 'GOOD' | 'DEFECT' {
    return order.fgBarcode ? 'GOOD' : 'DEFECT';
  }

  private assertOrder(order: RepairOrder) {
    if (!order.company?.trim() || !order.plant?.trim() || !order.itemCode?.trim()
      || !Number.isSafeInteger(order.seq) || order.seq < 1) {
      throw new BadRequestException('수리오더 식별자와 회사/공장 정보가 필요합니다.');
    }
    this.assertQuantity(order.qty);
  }

  private assertQuantity(qty: number) {
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new BadRequestException('수량은 양의 정수여야 합니다.');
  }
}
