/**
 * @file src/modules/shipping/services/shipment.service.ts
 * @description 출하 관리 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **팔레트 관리**: loadPallets, unloadPallets로 팔레트 적재/하차
 * 3. **상태 관리**: 상태 변경 (PREPARING -> LOADED -> SHIPPED -> DELIVERED)
 * 4. **ERP 연동**: erpSyncYn 플래그 관리
 * 5. **통계**: 일자별 출하 통계 조회
 *
 * 실제 DB 스키마 (shipment_logs 테이블):
 * - shipNo가 유니크 키
 * - status: PREPARING, LOADED, SHIPPED, DELIVERED, CANCELED
 * - palletCount, boxCount, totalQty는 팔레트 적재 시 자동 계산
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  ShipmentQueryDto,
  LoadPalletsDto,
  UnloadPalletsDto,
  ChangeShipmentStatusDto,
  UpdateErpSyncDto,
  ShipmentStatsQueryDto,
  ShipmentStatus,
} from '../dto/shipment.dto';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    @InjectRepository(ShipmentLog)
    private readonly shipmentRepository: Repository<ShipmentLog>,
    @InjectRepository(PalletMaster)
    private readonly palletRepository: Repository<PalletMaster>,
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
    private readonly productInventoryService: ProductInventoryService,
    private readonly sysConfig: SysConfigService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private buildShipmentUpdate(
    dto: Omit<UpdateShipmentDto, 'status' | 'shipNo'>,
  ): Partial<Pick<ShipmentLog, 'shipDate' | 'vehicleNo' | 'driverName' | 'destination' | 'customer' | 'remark' | 'shipOrderNo'>> {
    return {
      ...(dto.shipDate !== undefined ? { shipDate: parseDateStart(dto.shipDate) } : {}),
      ...(dto.vehicleNo !== undefined ? { vehicleNo: dto.vehicleNo } : {}),
      ...(dto.driverName !== undefined ? { driverName: dto.driverName } : {}),
      ...(dto.destination !== undefined ? { destination: dto.destination } : {}),
      ...(dto.customer !== undefined ? { customer: dto.customer } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.shipOrderNo !== undefined ? { shipOrderNo: dto.shipOrderNo || null } : {}),
    };
  }

  /**
   * 출하 목록 조회
   */
  async findAll(query: ShipmentQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      shipNo,
      customer,
      status,
      shipDateFrom,
      shipDateTo,
      erpSyncYn,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.shipmentRepository.createQueryBuilder('s');
    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });
    if (shipNo) qb.andWhere('s.shipNo LIKE :shipNo', { shipNo: `%${shipNo}%` });
    if (customer) qb.andWhere('s.customer LIKE :customer', { customer: `%${customer}%` });
    if (status) qb.andWhere('s.status = :status', { status });
    if (erpSyncYn) qb.andWhere('s.erpSyncYn = :erpSyncYn', { erpSyncYn });
    if (shipDateFrom) qb.andWhere("s.shipDate >= TO_DATE(:shipDateFrom, 'YYYY-MM-DD')", { shipDateFrom });
    if (shipDateTo) qb.andWhere("s.shipDate < TO_DATE(:shipDateTo, 'YYYY-MM-DD') + 1", { shipDateTo });

    const total = await qb.getCount();
    const data = await qb
      .orderBy('s.shipDate', 'DESC')
      .addOrderBy('s.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 출하 단건 조회 (shipNo PK)
   */
  async findById(shipNo: string, company?: string, plant?: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { shipNo, ...this.tenantWhere(company, plant) },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${shipNo}`);
    }

    return shipment;
  }

  /**
   * 출하 단건 조회 (출하번호) — findById와 동일, 호환용
   */
  async findByShipNo(shipNo: string, company?: string, plant?: string) {
    return this.findById(shipNo, company, plant);
  }

  /**
   * 출하 생성
   */
  async create(dto: CreateShipmentDto, company?: string, plant?: string) {
    // 중복 체크
    const existing = await this.shipmentRepository.findOne({
      where: { shipNo: dto.shipNo, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 출하번호입니다: ${dto.shipNo}`);
    }

    const shipment = this.shipmentRepository.create({
      shipNo: dto.shipNo,
      shipDate: parseDateStart(dto.shipDate),
      vehicleNo: dto.vehicleNo,
      driverName: dto.driverName,
      destination: dto.destination,
      customer: dto.customer,
      remark: dto.remark,
      shipOrderNo: dto.shipOrderNo || null,
      palletCount: 0,
      boxCount: 0,
      totalQty: 0,
      status: 'PREPARING',
      erpSyncYn: 'N',
      company: company || null,
      plant: plant || null,
    });

    return this.shipmentRepository.save(shipment);
  }

  /**
   * 출하 수정
   */
  async update(id: string, dto: UpdateShipmentDto, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    // SHIPPED 또는 DELIVERED 상태에서는 수정 불가
    if (shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      throw new BadRequestException('출하 완료된 건은 수정할 수 없습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        '출하 상태 변경은 전용 처리만 허용됩니다. 적재/출하/역분개/취소 API를 사용해 주세요.',
      );
    }
    if (dto.shipNo !== undefined && dto.shipNo !== id) {
      throw new BadRequestException('출하 번호는 수정할 수 없습니다.');
    }

    const { status: _ignoredStatus, shipNo: _ignoredShipNo, ...shipmentData } = dto;
    const updateData = this.buildShipmentUpdate(shipmentData);

    if (Object.keys(updateData).length > 0) {
      await this.shipmentRepository.update(
        { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
        updateData,
      );
    }

    return this.findById(id, company, plant);
  }

  /**
   * 출하 삭제
   */
  async delete(id: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    // SHIPPED 또는 DELIVERED 상태에서는 삭제 불가
    if (shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      throw new BadRequestException('출하 완료된 건은 삭제할 수 없습니다.');
    }
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(
        '출하 흐름에 들어간 건은 직접 삭제할 수 없습니다. 팔레트 하차 또는 출하 취소 절차로 먼저 정리해 주세요.',
      );
    }

    // 팔레트가 있으면 삭제 불가
    if (shipment.palletCount > 0) {
      throw new BadRequestException('팔레트가 적재된 출하는 삭제할 수 없습니다. 먼저 팔레트를 하차해주세요.');
    }

    await this.shipmentRepository.delete({ shipNo: id, ...this.tenantWhere(company, plant) });

    return { id, deleted: true };
  }

  // ===== 팔레트 관리 =====

  /**
   * 팔레트 적재
   */
  async loadPallets(id: string, dto: LoadPalletsDto, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    // PREPARING 상태에서만 팔레트 적재 가능
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 팔레트를 적재할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    // 팔레트 존재 및 상태 확인
    const pallets = await this.palletRepository.find({
      where: {
        palletNo: In(dto.palletIds),
        ...this.tenantWhere(company, plant),
      },
    });

    if (pallets.length !== dto.palletIds.length) {
      const foundIds = pallets.map(p => p.palletNo);
      const notFound = dto.palletIds.filter(pid => !foundIds.includes(pid));
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${notFound.join(', ')}`);
    }

    // 팔레트 상태 확인
    const invalidPallets = pallets.filter(p => p.status !== 'CLOSED');
    if (invalidPallets.length > 0) {
      throw new BadRequestException(`CLOSED 상태가 아닌 팔레트가 있습니다: ${invalidPallets.map(p => p.palletNo).join(', ')}`);
    }

    // 이미 다른 출하에 할당된 팔레트 확인
    const assignedPallets = pallets.filter(p => p.shipmentId && p.shipmentId !== id);
    if (assignedPallets.length > 0) {
      throw new BadRequestException(`이미 다른 출하에 할당된 팔레트가 있습니다: ${assignedPallets.map(p => p.palletNo).join(', ')}`);
    }

    if (shipment.shipOrderNo) {
      const wrongOrderPallets = pallets.filter(p => p.shipOrderNo !== shipment.shipOrderNo);
      if (wrongOrderPallets.length > 0) {
        throw new BadRequestException(
          `출하지시가 다른 팔레트는 적재할 수 없습니다: ${wrongOrderPallets.map(p => p.palletNo).join(', ')}`,
        );
      }
    } else {
      const orderBoundPallets = pallets.filter(p => p.shipOrderNo);
      if (orderBoundPallets.length > 0) {
        throw new BadRequestException(
          `출하지시에 귀속된 팔레트는 출하지시 작업 화면에서 출하 처리해야 합니다: ${orderBoundPallets.map(p => p.palletNo).join(', ')}`,
        );
      }
    }

    // OQC 검증: OQC 사용여부(OQC_ENABLED) 설정이 켜진 경우에만 PASS 아닌 박스 적재 차단. 미사용이면 모두 적재 가능.
    const palletNos = pallets.map(p => p.palletNo);
    if (palletNos.length > 0 && (await this.sysConfig.isEnabled('OQC_ENABLED'))) {
      const oqcBlockedBoxes = await this.boxRepository
        .createQueryBuilder('box')
        .where('box.palletNo IN (:...palletNos)', { palletNos })
        .andWhere(company ? 'box.company = :company' : '1=1', { company })
        .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
        .andWhere('(box.oqcStatus IS NULL OR box.oqcStatus IN (:...blockedStatuses))', {
          blockedStatuses: ['FAIL', 'PENDING'],
        })
        .select(['box.boxNo', 'box.oqcStatus', 'box.palletNo'])
        .getMany();

      if (oqcBlockedBoxes.length > 0) {
        const blockList = oqcBlockedBoxes.map(b => `${b.boxNo}(${b.oqcStatus})`).join(', ');
        throw new BadRequestException(
          `OQC 미완료/불합격 박스가 포함된 팔레트는 출하에 적재할 수 없습니다: ${blockList}`,
        );
      }
    }

    // 트랜잭션으로 팔레트 적재 및 출하 집계 업데이트
    await this.tx.run(async (queryRunner) => {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: In(dto.palletIds), ...this.tenantWhere(company, plant) },
        {
          shipmentId: id,
          status: 'LOADED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId: id })
        .andWhere(company ? 'pallet.company = :company' : '1=1', { company })
        .andWhere(plant ? 'pallet.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
        {
          palletCount: parseInt(shipmentSummary?.count) || 0,
          boxCount: parseInt(shipmentSummary?.boxCount) || 0,
          totalQty: parseInt(shipmentSummary?.totalQty) || 0,
        }
      );
    });

    return this.findById(id, company, plant);
  }

  /**
   * 팔레트 하차
   */
  async unloadPallets(id: string, dto: UnloadPalletsDto, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    // PREPARING 상태에서만 팔레트 하차 가능
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 팔레트를 하차할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    // 팔레트가 이 출하에 있는지 확인
    const pallets = await this.palletRepository.find({
      where: {
        palletNo: In(dto.palletIds),
        shipmentId: id,
        ...this.tenantWhere(company, plant),
      },
    });

    if (pallets.length !== dto.palletIds.length) {
      const foundIds = pallets.map(p => p.palletNo);
      const notFound = dto.palletIds.filter(pid => !foundIds.includes(pid));
      throw new NotFoundException(`이 출하에 없는 팔레트입니다: ${notFound.join(', ')}`);
    }

    // 트랜잭션으로 팔레트 하차 및 출하 집계 업데이트
    await this.tx.run(async (queryRunner) => {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: In(dto.palletIds), ...this.tenantWhere(company, plant) },
        {
          shipmentId: null,
          status: 'CLOSED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId: id })
        .andWhere(company ? 'pallet.company = :company' : '1=1', { company })
        .andWhere(plant ? 'pallet.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
        {
          palletCount: parseInt(shipmentSummary?.count) || 0,
          boxCount: parseInt(shipmentSummary?.boxCount) || 0,
          totalQty: parseInt(shipmentSummary?.totalQty) || 0,
        }
      );
    });

    return this.findById(id, company, plant);
  }

  // ===== 상태 관리 =====

  /**
   * 출하 상태 변경: PREPARING -> LOADED
   */
  async markAsLoaded(id: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 적재완료 처리할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    if (shipment.palletCount <= 0) {
      throw new BadRequestException('팔레트가 없는 출하는 적재완료 처리할 수 없습니다.');
    }

    await this.shipmentRepository.update(
      { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
      { status: 'LOADED' }
    );

    return this.findById(id, company, plant);
  }

  /**
   * 출하 상태 변경: LOADED -> SHIPPED
   * OQC 검증: PASS가 아닌 박스가 있으면 출하 차단
   */
  async markAsShipped(id: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    if (shipment.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 출하 처리할 수 없습니다. LOADED 상태여야 합니다.`);
    }

    // OQC 검증: OQC 사용여부(OQC_ENABLED) 설정이 켜진 경우에만 PASS 아닌 박스 출하 차단. 미사용이면 모두 출하 가능.
    const pallets = await this.palletRepository.find({
      where: { shipmentId: id, ...this.tenantWhere(company, plant) },
      select: ['palletNo'],
    });

    const palletIds = pallets.map(p => p.palletNo);
    if (palletIds.length > 0 && (await this.sysConfig.isEnabled('OQC_ENABLED'))) {
      const failedBoxes = await this.boxRepository
        .createQueryBuilder('box')
        .where('box.palletNo IN (:...palletIds)', { palletIds })
        .andWhere(company ? 'box.company = :company' : '1=1', { company })
        .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
        .andWhere('(box.oqcStatus IS NULL OR box.oqcStatus IN (:...blockedStatuses))', {
          blockedStatuses: ['FAIL', 'PENDING'],
        })
        .select(['box.boxNo', 'box.oqcStatus'])
        .getMany();

      if (failedBoxes.length > 0) {
        const failList = failedBoxes.map(b => `${b.boxNo}(${b.oqcStatus})`).join(', ');
        throw new BadRequestException(
          `OQC 미완료/불합격 박스가 포함되어 출하할 수 없습니다: ${failList}`,
        );
      }
    }

    // 박스 목록 조회 (품목별 수량 집계 + FG 라벨 상태 업데이트용)
    let allBoxes: BoxMaster[] = [];
    if (palletIds.length > 0) {
      allBoxes = await this.boxRepository.find({
        where: { palletNo: In(palletIds), ...this.tenantWhere(company, plant) },
        select: ['boxNo', 'itemCode', 'qty', 'serialList'],
      });
    }

    // 품목별 출고 수량 집계
    const allFgBarcodes: string[] = [];

    for (const box of allBoxes) {
      // serialList에서 FG 바코드 수집
      if (box.serialList) {
        try {
          const serials: string[] = JSON.parse(box.serialList);
          allFgBarcodes.push(...serials);
        } catch { /* serialList 파싱 실패 시 무시 */ }
      }
    }

    // 트랜잭션으로 출하 상태 및 팔레트/박스 상태 업데이트
    await this.tx.run(async (queryRunner) => {
      // 1. 팔레트 상태 업데이트
      await queryRunner.manager.update(
        PalletMaster,
          { shipmentId: id, ...this.tenantWhere(company, plant) },
        { status: 'SHIPPED' }
      );

      // 2. 박스 상태 업데이트
      if (palletIds.length > 0) {
        await queryRunner.manager.update(
          BoxMaster,
          { palletNo: In(palletIds), ...this.tenantWhere(company, plant) },
          { status: 'SHIPPED', shipOrderNo: shipment.shipOrderNo ?? null, shippedAt: new Date() },
        );
      }

      // 3. 출하 상태 업데이트
      await queryRunner.manager.update(
        ShipmentLog,
          { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
        {
          status: 'SHIPPED',
          shipAt: new Date(),
        }
      );

      // 4. FG_LABEL 상태 → SHIPPED 일괄 업데이트
      if (allFgBarcodes.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < allFgBarcodes.length; i += batchSize) {
          const batch = allFgBarcodes.slice(i, i + batchSize);
          await queryRunner.manager.update(
            FgLabel,
            { fgBarcode: In(batch), ...this.tenantWhere(company, plant) },
            { status: 'SHIPPED' },
          );
        }
      }

      // 5. 품목별 제품재고 차감 (트랜잭션 낭부 — 원자성 보장)
      //    재고 부족 시 전체 출하 롤백
      const fgLabels = allFgBarcodes.length > 0
        ? await queryRunner.manager.getRepository(FgLabel).find({
            where: { fgBarcode: In(allFgBarcodes), ...this.tenantWhere(company, plant) },
          })
        : [];
      const fgLabelMap = new Map(fgLabels.map((label) => [label.fgBarcode, label] as const));
      if (fgLabels.length !== allFgBarcodes.length) {
        const missingBarcodes = allFgBarcodes.filter((barcode) => !fgLabelMap.has(barcode));
        throw new BadRequestException(
          `FG 바코드 정보가 없는 시리얼이 포함되었습니다: ${missingBarcodes.join(', ')}`,
        );
      }

      const warehouse = await queryRunner.manager.findOne(Warehouse, {
        where: { warehouseType: 'FG', isDefault: 'Y', ...this.tenantWhere(company, plant) },
      });
      if (!warehouse) {
        throw new BadRequestException('FG 기본창고(IS_DEFAULT=Y)가 설정되어 있지 않습니다.');
      }

      const itemQtyMap = new Map<string, number>();
      for (const box of allBoxes) {
        const existingQty = itemQtyMap.get(box.itemCode) || 0;
        itemQtyMap.set(box.itemCode, existingQty + box.qty);
      }

      for (const [itemCode, qty] of itemQtyMap) {
        // 재고 키 체계(배치 시리얼/FG바코드)와 무관하게 수량 FIFO로 차감 — 입고-출하 키 불일치로
        // 인한 "재고 부족" 방지. 시리얼 추적은 FG_LABELS(SHIPPED 전이)가 담당.
        await this.productInventoryService.issueStockByItemFifoInTx(queryRunner, {
          warehouseId: warehouse.warehouseCode,
          itemCode,
          qty,
          transType: 'FG_OUT',
          refType: 'SHIPMENT',
          refId: id,
          remark: `출하 ${id} 제품 출고`,
          company: shipment.company,
          plant: shipment.plant,
        });
      }

      // 6. 출하지시 shippedQty 업데이트 (shipOrderNo 연계 시)
      if (shipment.shipOrderNo) {
        const lines = await queryRunner.manager.find(ShipmentOrderItem, {
          where: { shipOrderNo: shipment.shipOrderNo, ...this.tenantWhere(company, plant) },
        });
        const lineByItem = new Map<string, ShipmentOrderItem>();
        for (const l of lines) {
          if (!lineByItem.has(l.itemCode)) lineByItem.set(l.itemCode, l);
        }
        for (const [itemCode, qty] of itemQtyMap) {
          const line = lineByItem.get(itemCode);
          if (line) {
            const newShipped = line.shippedQty + qty;
            await queryRunner.manager.update(
              ShipmentOrderItem,
              { shipOrderNo: shipment.shipOrderNo, seq: line.seq, ...this.tenantWhere(company, plant) },
              { shippedQty: newShipped },
            );
          }
        }

        const allLines = await queryRunner.manager.find(ShipmentOrderItem, {
          where: { shipOrderNo: shipment.shipOrderNo, ...this.tenantWhere(company, plant) },
        });
        const fullyShipped = allLines.every((l) => l.shippedQty >= l.orderQty);
        if (fullyShipped) {
          await queryRunner.manager.update(
            ShipmentOrder,
            { shipOrderNo: shipment.shipOrderNo, ...this.tenantWhere(company, plant) },
            { status: 'CLOSED' },
          );
        }
      }
    });

    return this.findById(id, company, plant);
  }

  /**
   * 출하 상태 변경: SHIPPED -> DELIVERED
   */
  async markAsDelivered(id: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    if (shipment.status !== 'SHIPPED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 배송완료 처리할 수 없습니다. SHIPPED 상태여야 합니다.`);
    }

    await this.shipmentRepository.update(
      { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
      { status: 'DELIVERED' }
    );

    return this.findById(id, company, plant);
  }

  /**
   * 출하 취소 트랜잭션 본문 헬퍼 (외부 트랜잭션 합성용)
   * 호출자가 상태 검증(PREPARING/LOADED)을 완료한 뒤 호출한다.
   */
  async cancelInTx(qr: import('typeorm').QueryRunner, shipment: ShipmentLog, remark?: string, company?: string, plant?: string): Promise<void> {
    const id = shipment.shipNo;

    // 팔레트 상태 복원 (CLOSED로)
    const pallets = await qr.manager.find(PalletMaster, {
      where: { shipmentId: id, ...this.tenantWhere(company, plant) },
      select: ['palletNo'],
    });
    const palletNos = pallets.map((p) => p.palletNo);

    await qr.manager.update(
      PalletMaster,
      { shipmentId: id, ...this.tenantWhere(company, plant) },
      {
        shipmentId: null,
        status: 'CLOSED',
      }
    );

    // 박스 상태 명시적 복원 (CLOSED로)
    if (palletNos.length > 0) {
      await qr.manager.update(
        BoxMaster,
        { palletNo: In(palletNos), ...this.tenantWhere(company, plant) },
        { status: 'CLOSED', shippedAt: null, shipOrderNo: null },
      );
    }

    // 출하 상태 업데이트
    const updateData: Partial<Pick<ShipmentLog, 'status' | 'palletCount' | 'boxCount' | 'totalQty' | 'remark'>> = {
      status: 'CANCELED',
      palletCount: 0,
      boxCount: 0,
      totalQty: 0,
    };
    if (remark) updateData.remark = remark;

    await qr.manager.update(
      ShipmentLog,
      { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
      updateData
    );
  }

  /**
   * 출하 취소 (PREPARING/LOADED -> CANCELED)
   */
  async cancel(id: string, remark?: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    if (shipment.status !== 'PREPARING' && shipment.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 취소할 수 없습니다. PREPARING 또는 LOADED 상태여야 합니다.`);
    }

    await this.tx.run((qr) => this.cancelInTx(qr, shipment, remark, company, plant));

    return this.findById(id, company, plant);
  }

  /**
   * 출하 역분개 트랜잭션 본문 헬퍼 (외부 트랜잭션 합성용)
   * 호출자가 상태(SHIPPED) 및 ERP 검증을 완료한 뒤 호출한다.
   * 사전 조회(팔레트, 박스, FG바코드, 재고트랜잭션)를 포함하며 qr.manager를 사용한다.
   */
  async reverseShipmentInTx(qr: import('typeorm').QueryRunner, shipment: ShipmentLog, remark?: string, company?: string, plant?: string): Promise<Map<string, number>> {
    const id = shipment.shipNo;

    // 팔레트/박스 조회
    const pallets = await qr.manager.find(PalletMaster, {
      where: { shipmentId: id, ...this.tenantWhere(company, plant) },
      select: ['palletNo'],
    });
    const palletIds = pallets.map(p => p.palletNo);

    // 박스에서 FG 바코드 수집
    let allBoxes: BoxMaster[] = [];
    const allFgBarcodes: string[] = [];
    if (palletIds.length > 0) {
      allBoxes = await qr.manager.find(BoxMaster, {
        where: { palletNo: In(palletIds), ...this.tenantWhere(company, plant) },
        select: ['boxNo', 'itemCode', 'qty', 'serialList'],
      });
      for (const box of allBoxes) {
        if (box.serialList) {
          try {
            const serials: string[] = JSON.parse(box.serialList);
            allFgBarcodes.push(...serials);
          } catch { /* 파싱 실패 무시 */ }
        }
      }
    }

    // 제품 재고 역분개 대상 조회
    const shipmentTransactions = await qr.manager.find(ProductTransaction, {
      where: { refType: 'SHIPMENT', refId: id, status: 'DONE', ...this.tenantWhere(company, plant) },
    });

    // 1. 팔레트 상태 → LOADED
    await qr.manager.update(
      PalletMaster,
      { shipmentId: id, ...this.tenantWhere(company, plant) },
      { status: 'LOADED' },
    );

    // 2. 박스 상태 → CLOSED
    if (palletIds.length > 0) {
      await qr.manager.update(
        BoxMaster,
        { palletNo: In(palletIds), ...this.tenantWhere(company, plant) },
        { status: 'CLOSED', shippedAt: null, shipOrderNo: null },
      );
    }

    // 3. 출하 상태 → LOADED
    await qr.manager.update(
      ShipmentLog,
      { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
      {
        status: 'LOADED',
        shipAt: null,
        remark: remark || `출하 역분개 처리`,
      },
    );

    // 4. FG_LABEL 상태 → PACKED 복원 (SHIPPED → PACKED)
    if (allFgBarcodes.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < allFgBarcodes.length; i += batchSize) {
        const batch = allFgBarcodes.slice(i, i + batchSize);
        await qr.manager.update(
          FgLabel,
          { fgBarcode: In(batch), status: 'SHIPPED', ...this.tenantWhere(company, plant) },
          { status: 'PACKED' },
        );
      }
    }

    // 5. 제품 재고 역분개 (FG_OUT → FG_OUT_CANCEL)
    for (const trans of shipmentTransactions) {
      await this.productInventoryService.cancelTransactionInTx(
        qr,
        trans,
        {
          transactionId: trans.transNo,
          remark: remark || `출하 ${id} 역분개`,
        },
      );
    }

    // 6. 출하지시 shippedQty 복원 (shipOrderNo 연계 시)
    const itemQtyMap = new Map<string, number>();
    if (shipment.shipOrderNo) {
      for (const box of allBoxes) {
        const existingQty = itemQtyMap.get(box.itemCode) || 0;
        itemQtyMap.set(box.itemCode, existingQty + box.qty);
      }

      const lines = await qr.manager.find(ShipmentOrderItem, {
        where: { shipOrderNo: shipment.shipOrderNo, ...this.tenantWhere(company, plant) },
      });
      const lineByItem = new Map<string, ShipmentOrderItem>();
      for (const l of lines) {
        if (!lineByItem.has(l.itemCode)) lineByItem.set(l.itemCode, l);
      }
      for (const [itemCode, qty] of itemQtyMap) {
        const line = lineByItem.get(itemCode);
        if (line) {
          const newShipped = Math.max(0, line.shippedQty - qty);
          await qr.manager.update(
            ShipmentOrderItem,
            { shipOrderNo: shipment.shipOrderNo, seq: line.seq, ...this.tenantWhere(company, plant) },
            { shippedQty: newShipped },
          );
        }
      }

      // 역분개 시에는 CONFIRMED로 되돌림
      await qr.manager.update(
        ShipmentOrder,
        { shipOrderNo: shipment.shipOrderNo, ...this.tenantWhere(company, plant) },
        { status: 'CONFIRMED' },
      );
    }

    return itemQtyMap;
  }

  /**
   * 출하 역분개 (SHIPPED -> LOADED): 재고 복구 + FG_LABEL 상태 복원
   * 출하 완료 후 취소가 필요한 경우 사용
   */
  async reverseShipment(id: string, remark?: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    if (shipment.status !== 'SHIPPED') {
      throw new BadRequestException(
        `현재 상태(${shipment.status})에서는 출하 역분개할 수 없습니다. SHIPPED 상태여야 합니다.`,
      );
    }
    if (shipment.erpSyncYn === 'Y') {
      throw new BadRequestException(
        `출하 ${shipment.shipNo} 는 ERP 연동이 완료되어 역분개할 수 없습니다. ` +
          `ERP 연동분부터 먼저 정리한 뒤 출하 역분개를 진행해 주세요.`,
      );
    }

    await this.tx.run((qr) => this.reverseShipmentInTx(qr, shipment, remark, company, plant));

    return this.findById(id, company, plant);
  }

  /**
   * 상태 직접 변경 (관리자용)
   */
  async changeStatus(id: string, dto: ChangeShipmentStatusDto, company?: string, plant?: string) {
    await this.findById(id, company, plant); // 존재 확인
    throw new BadRequestException(
      `출하 상태(${dto.status})는 직접 변경할 수 없습니다. 적재/출하/배송완료/역분개/취소 전용 API를 사용해 주세요.`,
    );
  }

  // ===== ERP 연동 =====

  /**
   * ERP 동기화 플래그 업데이트
   */
  async updateErpSyncYn(id: string, dto: UpdateErpSyncDto, company?: string, plant?: string) {
    await this.findById(id, company, plant); // 존재 확인

    await this.shipmentRepository.update(
      { shipNo: typeof id === 'string' ? id : String(id), ...this.tenantWhere(company, plant) },
      { erpSyncYn: dto.erpSyncYn }
    );

    return this.findById(id, company, plant);
  }

  /**
   * ERP 미동기화 출하 목록 조회
   */
  async findUnsyncedForErp(company?: string, plant?: string) {
    return this.shipmentRepository.find({
      where: {
        erpSyncYn: 'N',
        status: In(['SHIPPED', 'DELIVERED']),
        ...this.tenantWhere(company, plant),
      },
      order: { shipAt: 'ASC' },
    });
  }

  /**
   * ERP 동기화 완료 처리 (일괄)
   */
  async markAsSynced(ids: string[], company?: string, plant?: string) {
    await this.shipmentRepository.update(
      { shipNo: In(ids), ...this.tenantWhere(company, plant) },
      { erpSyncYn: 'Y' }
    );

    return { count: ids.length };
  }

  // ===== 통계/집계 =====

  /**
   * 일자별 출하 통계
   */
  async getShipmentStats(query: ShipmentStatsQueryDto, company?: string, plant?: string) {
    const { startDate, endDate, customer } = query;

    const qb = this.shipmentRepository
      .createQueryBuilder('s')
      .select(['s.shipNo', 's.shipDate', 's.customer', 's.palletCount', 's.boxCount', 's.totalQty', 's.status'])
      .where('s.status IN (:...statuses)', { statuses: ['SHIPPED', 'DELIVERED'] })
      .andWhere("s.shipDate >= TO_DATE(:startDate, 'YYYY-MM-DD')", { startDate })
      .andWhere("s.shipDate < TO_DATE(:endDate, 'YYYY-MM-DD') + 1", { endDate })
      .orderBy('s.shipDate', 'ASC');
    if (customer) qb.andWhere('s.customer LIKE :customer', { customer: `%${customer}%` });
    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });

    const shipments = await qb.getMany();

    // 일자별 집계
    const dailyStats = new Map<string, {
      date: string;
      shipmentCount: number;
      palletCount: number;
      boxCount: number;
      totalQty: number;
    }>();

    shipments.forEach(s => {
      const dateKey = s.shipDate ? s.shipDate.toISOString().split('T')[0] : 'unknown';
      const existing = dailyStats.get(dateKey) || {
        date: dateKey,
        shipmentCount: 0,
        palletCount: 0,
        boxCount: 0,
        totalQty: 0,
      };

      dailyStats.set(dateKey, {
        date: dateKey,
        shipmentCount: existing.shipmentCount + 1,
        palletCount: existing.palletCount + s.palletCount,
        boxCount: existing.boxCount + s.boxCount,
        totalQty: existing.totalQty + s.totalQty,
      });
    });

    // 전체 합계
    const totals = shipments.reduce(
      (acc, s) => ({
        shipmentCount: acc.shipmentCount + 1,
        palletCount: acc.palletCount + s.palletCount,
        boxCount: acc.boxCount + s.boxCount,
        totalQty: acc.totalQty + s.totalQty,
      }),
      { shipmentCount: 0, palletCount: 0, boxCount: 0, totalQty: 0 },
    );

    return {
      period: { startDate, endDate },
      customer: customer || 'ALL',
      dailyStats: Array.from(dailyStats.values()),
      totals,
    };
  }

  /**
   * 고객사별 출하 통계
   */
  async getCustomerStats(fromDate: string, toDate: string, company?: string, plant?: string) {
    const qb = this.shipmentRepository
      .createQueryBuilder('s')
      .select(['s.customer', 's.palletCount', 's.boxCount', 's.totalQty'])
      .where('s.status IN (:...statuses)', { statuses: ['SHIPPED', 'DELIVERED'] })
      .andWhere("s.shipDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate })
      .andWhere("s.shipDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });
    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });

    const shipments = await qb.getMany();

    // 고객사별 집계
    const customerStats = new Map<string, {
      customer: string;
      shipmentCount: number;
      palletCount: number;
      boxCount: number;
      totalQty: number;
    }>();

    shipments.forEach(s => {
      const customerKey = s.customer || 'UNKNOWN';
      const existing = customerStats.get(customerKey) || {
        customer: customerKey,
        shipmentCount: 0,
        palletCount: 0,
        boxCount: 0,
        totalQty: 0,
      };

      customerStats.set(customerKey, {
        customer: customerKey,
        shipmentCount: existing.shipmentCount + 1,
        palletCount: existing.palletCount + s.palletCount,
        boxCount: existing.boxCount + s.boxCount,
        totalQty: existing.totalQty + s.totalQty,
      });
    });

    return {
      period: { fromDate, toDate },
      customerStats: Array.from(customerStats.values()).sort((a, b) => b.totalQty - a.totalQty),
    };
  }

  /**
   * 출하에 할당된 팔레트 목록 조회
   */
  async getShipmentPallets(id: string, company?: string, plant?: string) {
    await this.findById(id, company, plant); // 존재 확인

    const pallets = await this.palletRepository.find({
      where: { shipmentId: id, ...this.tenantWhere(company, plant) },
      order: { palletNo: 'ASC' },
    });

    // 각 팔레트의 박스 목록도 조회
    const result = await Promise.all(
      pallets.map(async (pallet) => {
        const boxes = await this.boxRepository.find({
          where: { palletNo: In([pallet.palletNo]), ...this.tenantWhere(company, plant) },
          order: { boxNo: 'ASC' },
          select: ['boxNo', 'itemCode', 'qty', 'status'],
        });
        return { ...pallet, boxes };
      }),
    );

    return result;
  }

  /**
   * 팔레트 바코드 스캔 검증
   * 스캔한 팔레트 번호가 출하에 속하는지 확인
   */
  async verifyPalletBarcode(id: string, palletNo: string, company?: string, plant?: string) {
    await this.findById(id, company, plant); // 존재 확인

    const pallet = await this.palletRepository.findOne({
      where: { palletNo, ...this.tenantWhere(company, plant) },
    });

    if (!pallet) {
      return { verified: false, reason: 'NOT_FOUND', palletNo };
    }

    if (pallet.shipmentId !== id) {
      return { verified: false, reason: 'WRONG_SHIPMENT', palletNo };
    }

    return {
      verified: true,
      palletNo: pallet.palletNo,
      palletId: pallet.palletNo,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      status: pallet.status,
    };
  }

  /**
   * 출하 상세 요약 정보 조회
   */
  async getShipmentSummary(id: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);

    // 품목별 수량 집계
    const boxesWithParts = await this.boxRepository
      .createQueryBuilder('box')
      .innerJoin(PalletMaster, 'pallet', 'box.palletNo = pallet.palletNo AND box.company = pallet.company AND box.plant = pallet.plant')
      .where('pallet.shipmentId = :shipmentId', { shipmentId: id })
      .andWhere(company ? 'box.company = :company' : '1=1', { company })
      .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
      .select(['box.itemCode', 'box.qty'])
      .getMany();

    // 품목별 집계
    const partSummary = new Map<string, {
      itemCode: string;
      boxCount: number;
      qty: number;
    }>();

    boxesWithParts.forEach(box => {
      const existing = partSummary.get(box.itemCode) || {
        itemCode: box.itemCode,
        boxCount: 0,
        qty: 0,
      };

      partSummary.set(box.itemCode, {
        itemCode: box.itemCode,
        boxCount: existing.boxCount + 1,
        qty: existing.qty + box.qty,
      });
    });

    return {
      shipNo: shipment.shipNo,
      status: shipment.status,
      customer: shipment.customer,
      destination: shipment.destination,
      shipDate: shipment.shipDate,
      shipAt: shipment.shipAt,
      vehicleNo: shipment.vehicleNo,
      driverName: shipment.driverName,
      palletCount: shipment.palletCount,
      boxCount: shipment.boxCount,
      totalQty: shipment.totalQty,
      erpSyncYn: shipment.erpSyncYn,
      partBreakdown: Array.from(partSummary.values()),
    };
  }
}
