/**
 * @file src/modules/shipping/services/pallet.service.ts
 * @description 팔레트 관리 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **박스 관리**: addBox, removeBox로 박스 추가/제거
 * 3. **상태 관리**: closePallet로 팔레트 닫기, 출하 할당
 * 4. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 *
 * 실제 DB 스키마 (pallet_masters 테이블):
 * - palletNo가 유니크 키
 * - status: OPEN, CLOSED, LOADED, SHIPPED
 * - shipmentId로 ShipmentLog와 연결 (nullable)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike, DataSource, In } from 'typeorm';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreatePalletDto,
  UpdatePalletDto,
  PalletQueryDto,
  AddBoxToPalletDto,
  RemoveBoxFromPalletDto,
  AssignPalletToShipmentDto,
  PalletStatus,
} from '../dto/pallet.dto';

@Injectable()
export class PalletService {
  private readonly logger = new Logger(PalletService.name);

  constructor(
    @InjectRepository(PalletMaster)
    private readonly palletRepository: Repository<PalletMaster>,
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    @InjectRepository(ShipmentLog)
    private readonly shipmentRepository: Repository<ShipmentLog>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 팔레트 목록 조회
   */
  async findAll(query: PalletQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      palletNo,
      shipmentId,
      status,
      unassigned,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: IsNull(),
      ...(company && { company }),
      ...(plant && { plant }),
      ...(palletNo && { palletNo: ILike(`%${palletNo}%`) }),
      ...(shipmentId && { shipmentId }),
      ...(status && { status }),
      ...(unassigned && { shipmentId: IsNull() }),
    };

    const [data, total] = await Promise.all([
      this.palletRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.palletRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 팔레트 단건 조회 (ID)
   */
  async findById(id: string) {
    const pallet = await this.palletRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${id}`);
    }

    return pallet;
  }

  /**
   * 팔레트 단건 조회 (팔레트번호)
   */
  async findByPalletNo(palletNo: string) {
    const pallet = await this.palletRepository.findOne({
      where: { palletNo, deletedAt: IsNull() },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${palletNo}`);
    }

    return pallet;
  }

  /**
   * 팔레트 생성
   */
  async create(dto: CreatePalletDto) {
    // 중복 체크
    const existing = await this.palletRepository.findOne({
      where: { palletNo: dto.palletNo, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 팔레트번호입니다: ${dto.palletNo}`);
    }

    const pallet = this.palletRepository.create({
      palletNo: dto.palletNo,
      boxCount: 0,
      totalQty: 0,
      status: 'OPEN',
    });

    return this.palletRepository.save(pallet);
  }

  /**
   * 팔레트 수정
   */
  async update(id: string, dto: UpdatePalletDto) {
    const pallet = await this.findById(id);

    // SHIPPED 상태에서는 수정 불가
    if (pallet.status === 'SHIPPED') {
      throw new BadRequestException('출하된 팔레트는 수정할 수 없습니다.');
    }

    const updateData: any = {};
    if (dto.shipmentId !== undefined) updateData.shipmentId = dto.shipmentId;
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.palletRepository.update({ id }, updateData);

    return this.findById(id);
  }

  /**
   * 팔레트 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const pallet = await this.findById(id);

    // SHIPPED 상태에서는 삭제 불가
    if (pallet.status === 'SHIPPED') {
      throw new BadRequestException('출하된 팔레트는 삭제할 수 없습니다.');
    }

    // 박스가 있으면 삭제 불가
    if (pallet.boxCount > 0) {
      throw new BadRequestException('박스가 포함된 팔레트는 삭제할 수 없습니다. 먼저 박스를 제거해주세요.');
    }

    // 출하에 할당되어 있으면 삭제 불가
    if (pallet.shipmentId) {
      throw new BadRequestException('출하에 할당된 팔레트는 삭제할 수 없습니다. 먼저 출하에서 제거해주세요.');
    }

    await this.palletRepository.update(
      { id },
      { deletedAt: new Date() }
    );

    return { id, deleted: true };
  }

  // ===== 박스 관리 =====

  /**
   * 팔레트에 박스 추가
   */
  async addBox(id: string, dto: AddBoxToPalletDto) {
    const pallet = await this.findById(id);

    // OPEN 상태에서만 박스 추가 가능
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 박스를 추가할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 박스 존재 및 상태 확인
    const boxes = await this.boxRepository.find({
      where: {
        id: In(dto.boxIds),
        deletedAt: IsNull(),
      },
    });

    if (boxes.length !== dto.boxIds.length) {
      const foundIds = boxes.map(b => b.id);
      const notFound = dto.boxIds.filter(boxId => !foundIds.includes(boxId));
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${notFound.join(', ')}`);
    }

    // 박스 상태 확인
    const invalidBoxes = boxes.filter(b => b.status !== 'CLOSED');
    if (invalidBoxes.length > 0) {
      throw new BadRequestException(`CLOSED 상태가 아닌 박스가 있습니다: ${invalidBoxes.map(b => b.boxNo).join(', ')}`);
    }

    // 이미 다른 팔레트에 할당된 박스 확인
    const assignedBoxes = boxes.filter(b => b.palletId && b.palletId !== id);
    if (assignedBoxes.length > 0) {
      throw new BadRequestException(`이미 다른 팔레트에 할당된 박스가 있습니다: ${assignedBoxes.map(b => b.boxNo).join(', ')}`);
    }

    // 트랜잭션으로 박스 할당 및 팔레트 집계 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 박스 업데이트
      await queryRunner.manager.update(
        BoxMaster,
        { id: In(dto.boxIds) },
        { palletId: id }
      );

      // 팔레트 집계 업데이트
      const palletSummary = await queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletId = :palletId', { palletId: id })
        .andWhere('box.deletedAt IS NULL')
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      const updatedPallet = await queryRunner.manager.update(
        PalletMaster,
        { id },
        {
          boxCount: parseInt(palletSummary?.count) || 0,
          totalQty: parseInt(palletSummary?.totalQty) || 0,
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
   * 팔레트에서 박스 제거
   */
  async removeBox(id: string, dto: RemoveBoxFromPalletDto) {
    const pallet = await this.findById(id);

    // OPEN 상태에서만 박스 제거 가능
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 박스를 제거할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 박스가 이 팔레트에 있는지 확인
    const boxes = await this.boxRepository.find({
      where: {
        id: In(dto.boxIds),
        palletId: id,
        deletedAt: IsNull(),
      },
    });

    if (boxes.length !== dto.boxIds.length) {
      const foundIds = boxes.map(b => b.id);
      const notFound = dto.boxIds.filter(boxId => !foundIds.includes(boxId));
      throw new NotFoundException(`이 팔레트에 없는 박스입니다: ${notFound.join(', ')}`);
    }

    // 트랜잭션으로 박스 제거 및 팔레트 집계 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 박스 업데이트
      await queryRunner.manager.update(
        BoxMaster,
        { id: In(dto.boxIds) },
        { palletId: null }
      );

      // 팔레트 집계 업데이트
      const palletSummary = await queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletId = :palletId', { palletId: id })
        .andWhere('box.deletedAt IS NULL')
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        PalletMaster,
        { id },
        {
          boxCount: parseInt(palletSummary?.count) || 0,
          totalQty: parseInt(palletSummary?.totalQty) || 0,
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
   * 팔레트 닫기 (OPEN -> CLOSED)
   */
  async closePallet(id: string) {
    const pallet = await this.findById(id);

    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 팔레트를 닫을 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 빈 팔레트는 닫을 수 없음
    if (pallet.boxCount <= 0) {
      throw new BadRequestException('빈 팔레트는 닫을 수 없습니다.');
    }

    await this.palletRepository.update(
      { id },
      {
        status: 'CLOSED',
        closeAt: new Date(),
      }
    );

    return this.findById(id);
  }

  /**
   * 팔레트 다시 열기 (CLOSED -> OPEN)
   */
  async reopenPallet(id: string) {
    const pallet = await this.findById(id);

    if (pallet.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 팔레트를 다시 열 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 출하에 할당되어 있으면 다시 열 수 없음
    if (pallet.shipmentId) {
      throw new BadRequestException('출하에 할당된 팔레트는 다시 열 수 없습니다.');
    }

    await this.palletRepository.update(
      { id },
      {
        status: 'OPEN',
        closeAt: null,
      }
    );

    return this.findById(id);
  }

  // ===== 출하 할당 =====

  /**
   * 팔레트를 출하에 할당
   */
  async assignToShipment(id: string, dto: AssignPalletToShipmentDto) {
    const pallet = await this.findById(id);

    // CLOSED 상태에서만 출하 할당 가능
    if (pallet.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 출하에 할당할 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 이미 다른 출하에 할당되어 있는 경우
    if (pallet.shipmentId && pallet.shipmentId !== dto.shipmentId) {
      throw new BadRequestException('이미 다른 출하에 할당된 팔레트입니다.');
    }

    // 출하 존재 및 상태 확인
    const shipment = await this.shipmentRepository.findOne({
      where: { id: dto.shipmentId, deletedAt: IsNull() },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${dto.shipmentId}`);
    }

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`출하 상태(${shipment.status})가 PREPARING이 아닙니다. PREPARING 상태 출하에만 팔레트를 할당할 수 있습니다.`);
    }

    // 트랜잭션으로 팔레트 할당 및 출하 집계 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { id },
        {
          shipmentId: dto.shipmentId,
          status: 'LOADED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId: dto.shipmentId })
        .andWhere('pallet.deletedAt IS NULL')
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { id: dto.shipmentId },
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
   * 팔레트를 출하에서 제거
   */
  async removeFromShipment(id: string) {
    const pallet = await this.findById(id);

    if (!pallet.shipmentId) {
      throw new BadRequestException('출하에 할당되지 않은 팔레트입니다.');
    }

    // 출하가 PREPARING 상태일 때만 제거 가능
    const shipment = await this.shipmentRepository.findOne({
      where: { id: pallet.shipmentId, deletedAt: IsNull() },
    });

    if (!shipment) {
      throw new NotFoundException('출하를 찾을 수 없습니다.');
    }

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`출하 상태(${shipment.status})가 PREPARING이 아닙니다. PREPARING 상태 출하에서만 팔레트를 제거할 수 있습니다.`);
    }

    const shipmentId = pallet.shipmentId;

    // 트랜잭션으로 팔레트 제거 및 출하 집계 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { id },
        {
          shipmentId: null,
          status: 'CLOSED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId })
        .andWhere('pallet.deletedAt IS NULL')
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { id: shipmentId },
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

  // ===== 조회 유틸리티 =====

  /**
   * 출하별 팔레트 목록 조회
   */
  async findByShipmentId(shipmentId: string) {
    return this.palletRepository.find({
      where: { shipmentId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 미할당 팔레트 목록 조회 (출하에 할당되지 않은 CLOSED 상태)
   */
  async findUnassignedPallets() {
    return this.palletRepository.find({
      where: {
        shipmentId: IsNull(),
        status: 'CLOSED',
        deletedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 팔레트 요약 정보 조회
   */
  async getPalletSummary(id: string) {
    const pallet = await this.findById(id);

    // 품목별 수량 집계 - 박스 기준
    const partSummary = await this.boxRepository
      .createQueryBuilder('box')
      .select('box.partId', 'partId')
      .addSelect('COUNT(*)', 'boxCount')
      .addSelect('SUM(box.qty)', 'qty')
      .where('box.palletId = :palletId', { palletId: id })
      .andWhere('box.deletedAt IS NULL')
      .groupBy('box.partId')
      .getRawMany();

    // 품목 정보 조회
    const partIds = partSummary.map(p => p.partId);
    const parts = await this.partRepository.find({
      where: partIds.length > 0 ? { id: In(partIds) } : {},
      select: ['id', 'partCode', 'partName'],
    });

    const partsMap = new Map(parts.map(p => [p.id, p]));

    return {
      palletId: id,
      palletNo: pallet.palletNo,
      status: pallet.status,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      closeAt: pallet.closeAt,
      partBreakdown: partSummary.map(ps => ({
        part: partsMap.get(ps.partId),
        boxCount: parseInt(ps.boxCount),
        qty: parseInt(ps.qty) || 0,
      })),
    };
  }
}
