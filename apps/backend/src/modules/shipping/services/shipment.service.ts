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
import { Repository, ILike, Between, In, MoreThanOrEqual, LessThanOrEqual, And, DataSource } from 'typeorm';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
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
    private readonly dataSource: DataSource,
  ) {}

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

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(shipNo && { shipNo: ILike(`%${shipNo}%`) }),
      ...(customer && { customer: ILike(`%${customer}%`) }),
      ...(status && { status }),
      ...(erpSyncYn && { erpSyncYn }),
      ...(shipDateFrom || shipDateTo
        ? {
            shipDate: And(
              shipDateFrom ? MoreThanOrEqual(new Date(shipDateFrom)) : undefined,
              shipDateTo ? LessThanOrEqual(new Date(shipDateTo)) : undefined
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.shipmentRepository.find({
        where,
        skip,
        take: limit,
        order: { shipDate: 'DESC', createdAt: 'DESC' },
      }),
      this.shipmentRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 출하 단건 조회 (ID)
   */
  async findById(id: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { id },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${id}`);
    }

    return shipment;
  }

  /**
   * 출하 단건 조회 (출하번호)
   */
  async findByShipNo(shipNo: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { shipNo },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${shipNo}`);
    }

    return shipment;
  }

  /**
   * 출하 생성
   */
  async create(dto: CreateShipmentDto) {
    // 중복 체크
    const existing = await this.shipmentRepository.findOne({
      where: { shipNo: dto.shipNo },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 출하번호입니다: ${dto.shipNo}`);
    }

    const shipment = this.shipmentRepository.create({
      shipNo: dto.shipNo,
      shipDate: dto.shipDate ? new Date(dto.shipDate) : null,
      vehicleNo: dto.vehicleNo,
      driverName: dto.driverName,
      destination: dto.destination,
      customer: dto.customer,
      remark: dto.remark,
      palletCount: 0,
      boxCount: 0,
      totalQty: 0,
      status: 'PREPARING',
      erpSyncYn: 'N',
    });

    return this.shipmentRepository.save(shipment);
  }

  /**
   * 출하 수정
   */
  async update(id: string, dto: UpdateShipmentDto) {
    const shipment = await this.findById(id);

    // SHIPPED 또는 DELIVERED 상태에서는 수정 불가
    if (shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      throw new BadRequestException('출하 완료된 건은 수정할 수 없습니다.');
    }

    const updateData: any = {};
    if (dto.shipDate !== undefined) updateData.shipDate = dto.shipDate ? new Date(dto.shipDate) : null;
    if (dto.vehicleNo !== undefined) updateData.vehicleNo = dto.vehicleNo;
    if (dto.driverName !== undefined) updateData.driverName = dto.driverName;
    if (dto.destination !== undefined) updateData.destination = dto.destination;
    if (dto.customer !== undefined) updateData.customer = dto.customer;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.shipmentRepository.update({ id }, updateData);

    return this.findById(id);
  }

  /**
   * 출하 삭제
   */
  async delete(id: string) {
    const shipment = await this.findById(id);

    // SHIPPED 또는 DELIVERED 상태에서는 삭제 불가
    if (shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      throw new BadRequestException('출하 완료된 건은 삭제할 수 없습니다.');
    }

    // 팔레트가 있으면 삭제 불가
    if (shipment.palletCount > 0) {
      throw new BadRequestException('팔레트가 적재된 출하는 삭제할 수 없습니다. 먼저 팔레트를 하차해주세요.');
    }

    await this.shipmentRepository.delete(id);

    return { id, deleted: true };
  }

  // ===== 팔레트 관리 =====

  /**
   * 팔레트 적재
   */
  async loadPallets(id: string, dto: LoadPalletsDto) {
    const shipment = await this.findById(id);

    // PREPARING 상태에서만 팔레트 적재 가능
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 팔레트를 적재할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    // 팔레트 존재 및 상태 확인
    const pallets = await this.palletRepository.find({
      where: {
        id: In(dto.palletIds),
      },
    });

    if (pallets.length !== dto.palletIds.length) {
      const foundIds = pallets.map(p => p.id);
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

    // 트랜잭션으로 팔레트 적재 및 출하 집계 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { id: In(dto.palletIds) },
        {
          shipmentId: id,
          status: 'LOADED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId: id })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { id },
        {
          palletCount: parseInt(shipmentSummary?.count) || 0,
          boxCount: parseInt(shipmentSummary?.boxCount) || 0,
          totalQty: parseInt(shipmentSummary?.totalQty) || 0,
        }
      );

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 팔레트 하차
   */
  async unloadPallets(id: string, dto: UnloadPalletsDto) {
    const shipment = await this.findById(id);

    // PREPARING 상태에서만 팔레트 하차 가능
    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 팔레트를 하차할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    // 팔레트가 이 출하에 있는지 확인
    const pallets = await this.palletRepository.find({
      where: {
        id: In(dto.palletIds),
        shipmentId: id,
      },
    });

    if (pallets.length !== dto.palletIds.length) {
      const foundIds = pallets.map(p => p.id);
      const notFound = dto.palletIds.filter(pid => !foundIds.includes(pid));
      throw new NotFoundException(`이 출하에 없는 팔레트입니다: ${notFound.join(', ')}`);
    }

    // 트랜잭션으로 팔레트 하차 및 출하 집계 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { id: In(dto.palletIds) },
        {
          shipmentId: null,
          status: 'CLOSED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId: id })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { id },
        {
          palletCount: parseInt(shipmentSummary?.count) || 0,
          boxCount: parseInt(shipmentSummary?.boxCount) || 0,
          totalQty: parseInt(shipmentSummary?.totalQty) || 0,
        }
      );

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ===== 상태 관리 =====

  /**
   * 출하 상태 변경: PREPARING -> LOADED
   */
  async markAsLoaded(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 적재완료 처리할 수 없습니다. PREPARING 상태여야 합니다.`);
    }

    if (shipment.palletCount <= 0) {
      throw new BadRequestException('팔레트가 없는 출하는 적재완료 처리할 수 없습니다.');
    }

    await this.shipmentRepository.update(
      { id },
      { status: 'LOADED' }
    );

    return this.findById(id);
  }

  /**
   * 출하 상태 변경: LOADED -> SHIPPED
   * OQC 검증: oqcStatus=FAIL 또는 PENDING인 박스가 있으면 출하 차단
   * (oqcStatus=null은 허용 — OQC는 선택적)
   */
  async markAsShipped(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 출하 처리할 수 없습니다. LOADED 상태여야 합니다.`);
    }

    // OQC 검증: 팔레트 내 박스 중 oqcStatus가 FAIL 또는 PENDING이면 출하 차단
    const pallets = await this.palletRepository.find({
      where: { shipmentId: id },
      select: ['id'],
    });

    const palletIds = pallets.map(p => p.id);
    if (palletIds.length > 0) {
      const failedBoxes = await this.boxRepository
        .createQueryBuilder('box')
        .where('box.palletId IN (:...palletIds)', { palletIds })
        .andWhere('box.oqcStatus IN (:...blockedStatuses)', { blockedStatuses: ['FAIL', 'PENDING'] })
        .select(['box.id', 'box.boxNo', 'box.oqcStatus'])
        .getMany();

      if (failedBoxes.length > 0) {
        const failList = failedBoxes.map(b => `${b.boxNo}(${b.oqcStatus})`).join(', ');
        throw new BadRequestException(
          `OQC 미완료/불합격 박스가 포함되어 출하할 수 없습니다: ${failList}`,
        );
      }
    }

    // 트랜잭션으로 출하 상태 및 팔레트/박스 상태 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 팔레트 상태 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { shipmentId: id },
        { status: 'SHIPPED' }
      );

      // 박스 상태 업데이트
      if (palletIds.length > 0) {
        await queryRunner.manager.update(
          BoxMaster,
          { palletId: In(palletIds) },
          { status: 'SHIPPED' }
        );
      }

      // 출하 상태 업데이트
      await queryRunner.manager.update(
        ShipmentLog,
        { id },
        {
          status: 'SHIPPED',
          shipAt: new Date(),
        }
      );

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 출하 상태 변경: SHIPPED -> DELIVERED
   */
  async markAsDelivered(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'SHIPPED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 배송완료 처리할 수 없습니다. SHIPPED 상태여야 합니다.`);
    }

    await this.shipmentRepository.update(
      { id },
      { status: 'DELIVERED' }
    );

    return this.findById(id);
  }

  /**
   * 출하 취소 (PREPARING/LOADED -> CANCELED)
   */
  async cancel(id: string, remark?: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'PREPARING' && shipment.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 취소할 수 없습니다. PREPARING 또는 LOADED 상태여야 합니다.`);
    }

    // 트랜잭션으로 출하 취소 및 팔레트/박스 상태 복원
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 팔레트 상태 복원 (CLOSED로)
      await queryRunner.manager.update(
        PalletMaster,
        { shipmentId: id },
        {
          shipmentId: null,
          status: 'CLOSED',
        }
      );

      // 출하 상태 업데이트
      const updateData: any = {
        status: 'CANCELED',
        palletCount: 0,
        boxCount: 0,
        totalQty: 0,
      };
      if (remark) updateData.remark = remark;

      await queryRunner.manager.update(
        ShipmentLog,
        { id },
        updateData
      );

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 상태 직접 변경 (관리자용)
   */
  async changeStatus(id: string, dto: ChangeShipmentStatusDto) {
    await this.findById(id); // 존재 확인

    const updateData: any = { status: dto.status };
    if (dto.remark) updateData.remark = dto.remark;

    await this.shipmentRepository.update({ id }, updateData);

    return this.findById(id);
  }

  // ===== ERP 연동 =====

  /**
   * ERP 동기화 플래그 업데이트
   */
  async updateErpSyncYn(id: string, dto: UpdateErpSyncDto) {
    await this.findById(id); // 존재 확인

    await this.shipmentRepository.update(
      { id },
      { erpSyncYn: dto.erpSyncYn }
    );

    return this.findById(id);
  }

  /**
   * ERP 미동기화 출하 목록 조회
   */
  async findUnsyncedForErp() {
    return this.shipmentRepository.find({
      where: {
        erpSyncYn: 'N',
        status: In(['SHIPPED', 'DELIVERED']),
      },
      order: { shipAt: 'ASC' },
    });
  }

  /**
   * ERP 동기화 완료 처리 (일괄)
   */
  async markAsSynced(ids: string[]) {
    await this.shipmentRepository.update(
      { id: In(ids) },
      { erpSyncYn: 'Y' }
    );

    return { count: ids.length };
  }

  // ===== 통계/집계 =====

  /**
   * 일자별 출하 통계
   */
  async getShipmentStats(query: ShipmentStatsQueryDto) {
    const { startDate, endDate, customer } = query;

    const where: any = {
      shipDate: Between(new Date(startDate), new Date(endDate)),
      status: In(['SHIPPED', 'DELIVERED']),
      ...(customer && { customer: ILike(`%${customer}%`) }),
    };

    const shipments = await this.shipmentRepository.find({
      where,
      select: ['id', 'shipNo', 'shipDate', 'customer', 'palletCount', 'boxCount', 'totalQty', 'status'],
      order: { shipDate: 'ASC' },
    });

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
  async getCustomerStats(startDate: string, endDate: string) {
    const shipments = await this.shipmentRepository.find({
      where: {
        shipDate: Between(new Date(startDate), new Date(endDate)),
        status: In(['SHIPPED', 'DELIVERED']),
      },
      select: ['customer', 'palletCount', 'boxCount', 'totalQty'],
    });

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
      period: { startDate, endDate },
      customerStats: Array.from(customerStats.values()).sort((a, b) => b.totalQty - a.totalQty),
    };
  }

  /**
   * 출하에 할당된 팔레트 목록 조회
   */
  async getShipmentPallets(id: string) {
    await this.findById(id); // 존재 확인

    const pallets = await this.palletRepository.find({
      where: { shipmentId: id },
      order: { palletNo: 'ASC' },
    });

    // 각 팔레트의 박스 목록도 조회
    const result = await Promise.all(
      pallets.map(async (pallet) => {
        const boxes = await this.boxRepository.find({
          where: { palletId: pallet.id },
          order: { boxNo: 'ASC' },
          select: ['id', 'boxNo', 'partId', 'qty', 'status'],
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
  async verifyPalletBarcode(id: string, palletNo: string) {
    await this.findById(id); // 존재 확인

    const pallet = await this.palletRepository.findOne({
      where: { palletNo },
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
      palletId: pallet.id,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      status: pallet.status,
    };
  }

  /**
   * 출하 상세 요약 정보 조회
   */
  async getShipmentSummary(id: string) {
    const shipment = await this.findById(id);

    // 품목별 수량 집계
    const boxesWithParts = await this.boxRepository
      .createQueryBuilder('box')
      .innerJoin(PalletMaster, 'pallet', 'box.palletId = pallet.id')
      .where('pallet.shipmentId = :shipmentId', { shipmentId: id })
      .select(['box.partId', 'box.qty'])
      .getMany();

    // 품목별 집계
    const partSummary = new Map<string, {
      partId: string;
      boxCount: number;
      qty: number;
    }>();

    boxesWithParts.forEach(box => {
      const existing = partSummary.get(box.partId) || {
        partId: box.partId,
        boxCount: 0,
        qty: 0,
      };

      partSummary.set(box.partId, {
        partId: box.partId,
        boxCount: existing.boxCount + 1,
        qty: existing.qty + box.qty,
      });
    });

    return {
      shipmentId: id,
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
