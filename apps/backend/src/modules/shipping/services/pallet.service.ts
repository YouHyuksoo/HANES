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
import { Repository, IsNull, ILike, In, Between, FindOptionsWhere } from 'typeorm';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import {
  CreatePalletDto,
  UpdatePalletDto,
  PalletQueryDto,
  AddBoxToPalletDto,
  RemoveBoxFromPalletDto,
  AssignPalletToShipmentDto,
  PalletStatus,
} from '../dto/pallet.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

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
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

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
      createdFrom,
      createdTo,
      includeOpen,
    } = query;
    const skip = (page - 1) * limit;

    // 미완료(작업 대상) 상태 — 기간 밖이어도 항상 노출 대상
    const OPEN_STATUSES = ['OPEN', 'CLOSED', 'LOADED'];

    // 날짜·상태를 제외한 공통 조건
    const common: FindOptionsWhere<PalletMaster> = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(palletNo && { palletNo: ILike(`%${palletNo}%`) }),
      ...(shipmentId && { shipmentId }),
      ...(unassigned && { shipmentId: IsNull() }),
    };

    // 생성일 범위
    const createdRange =
      createdFrom && createdTo
        ? Between(parseDateStart(createdFrom)!, parseDateEnd(createdTo)!)
        : createdFrom
          ? Between(parseDateStart(createdFrom)!, parseDateEnd(createdFrom)!)
          : createdTo
            ? Between(parseDateStart(createdTo)!, parseDateEnd(createdTo)!)
            : undefined;

    const dated: FindOptionsWhere<PalletMaster> = {
      ...common,
      ...(createdRange && { createdAt: createdRange }),
    };

    // 상태 명시 → 해당 상태만(기간 적용, 미완료-always 무시)
    // 상태 미지정 + 기간 있음 + includeOpen → 기간 내 전체 + 기간 밖 미완료도 포함
    let where: FindOptionsWhere<PalletMaster> | FindOptionsWhere<PalletMaster>[];
    if (status) {
      where = { ...dated, status };
    } else if (includeOpen && createdRange) {
      where = [dated, { ...common, status: In(OPEN_STATUSES) }];
    } else {
      where = dated;
    }

    const [data, total] = await Promise.all([
      this.palletRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.palletRepository.count({ where }),
    ]);

    return { data: data.map((pallet) => ({ ...pallet, id: pallet.palletNo })), total, page, limit };
  }

  /**
   * 팔레트 단건 조회 (ID)
   */
  async findById(id: string, company?: string, plant?: string) {
    const pallet = await this.palletRepository.findOne({
      where: { palletNo: id, ...this.tenantWhere(company, plant) },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${id}`);
    }

    return pallet;
  }

  /**
   * 팔레트번호로 조회 (findById의 별칭)
   */
  async findByPalletNo(palletNo: string, company?: string, plant?: string) {
    return this.findById(palletNo, company, plant);
  }

  /**
   * 팔레트 생성
   */
  async create(dto: CreatePalletDto, company?: string, plant?: string) {
    throw new BadRequestException(
      '출하지시 없는 팔레트는 생성할 수 없습니다. 출하지시 기준 팔레트 생성 API를 사용해 주세요.',
    );
    // 팔레트번호 미지정 시 자동 채번 (PLT+YYMMDD+4자리, SEQ_PALLET_NO_DAILY)
    const palletNo = dto.palletNo ?? await this.numbering.nextPalletNo();

    // 중복 체크
    const existing = await this.palletRepository.findOne({
      where: { palletNo, ...this.tenantWhere(company, plant) },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 팔레트번호입니다: ${palletNo}`);
    }

    const pallet = this.palletRepository.create({
      palletNo,
      boxCount: 0,
      totalQty: 0,
      status: 'OPEN',
      company: company || null,
      plant: plant || null,
    });

    return this.palletRepository.save(pallet);
  }

  /**
   * 팔레트 수정
   */
  async update(id: string, dto: UpdatePalletDto, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    // SHIPPED 상태에서는 수정 불가
    if (pallet.status === 'SHIPPED') {
      throw new BadRequestException('출하된 팔레트는 수정할 수 없습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `팔레트 상태(${dto.status})는 직접 변경할 수 없습니다. 박스적재/출하할당/출하 전용 API를 사용해 주세요.`,
      );
    }

    const updateData: Partial<Pick<PalletMaster, 'shipmentId'>> = {};
    if (dto.shipmentId !== undefined) updateData.shipmentId = dto.shipmentId;

    await this.palletRepository.update({ palletNo: id, ...this.tenantWhere(company, plant) }, updateData);

    return this.findById(id, company, plant);
  }

  /**
   * 팔레트 삭제
   */
  async delete(id: string, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    // SHIPPED 상태에서는 삭제 불가
    if (pallet.status === 'SHIPPED') {
      throw new BadRequestException('출하된 팔레트는 삭제할 수 없습니다.');
    }
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(
        '물류 흐름에 들어간 팔레트는 직접 삭제할 수 없습니다. 박스 해제 또는 출하 해제 후 다시 정리해 주세요.',
      );
    }

    // 박스가 있으면 삭제 불가
    if (pallet.boxCount > 0) {
      throw new BadRequestException('박스가 포함된 팔레트는 삭제할 수 없습니다. 먼저 박스를 제거해주세요.');
    }

    // 출하에 할당되어 있으면 삭제 불가
    if (pallet.shipmentId) {
      throw new BadRequestException('출하에 할당된 팔레트는 삭제할 수 없습니다. 먼저 출하에서 제거해주세요.');
    }

    await this.palletRepository.delete({ palletNo: id, ...this.tenantWhere(company, plant) });

    return { id, deleted: true };
  }

  // ===== 박스 관리 =====

  /**
   * 팔레트에 박스 추가
   */
  async addBox(id: string, dto: AddBoxToPalletDto, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);
    throw new BadRequestException(
      `팔레트 구성은 출하지시 기준 API를 사용해야 합니다. 출하지시: ${pallet.shipOrderNo ?? '없음'}`,
    );

    // OPEN 상태에서만 박스 추가 가능
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 박스를 추가할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 박스 존재 및 상태 확인
    const boxes = await this.boxRepository.find({
      where: {
        boxNo: In(dto.boxIds),
        ...this.tenantWhere(company, plant),
      },
    });

    if (boxes.length !== dto.boxIds.length) {
      const foundNos = boxes.map(b => b.boxNo);
      const notFound = dto.boxIds.filter(boxId => !foundNos.includes(boxId));
      throw new NotFoundException(`박스를 찾을 수 없습니다: ${notFound.join(', ')}`);
    }

    // 박스 상태 확인
    const invalidBoxes = boxes.filter(b => b.status !== 'CLOSED');
    if (invalidBoxes.length > 0) {
      throw new BadRequestException(`CLOSED 상태가 아닌 박스가 있습니다: ${invalidBoxes.map(b => b.boxNo).join(', ')}`);
    }

    // OQC 상태 검증: PASS가 아닌 박스는 적재 불가
    const oqcBlockedBoxes = boxes.filter(b => b.oqcStatus !== 'PASS');
    if (oqcBlockedBoxes.length > 0) {
      const blockList = oqcBlockedBoxes.map(b => `${b.boxNo}(${b.oqcStatus})`).join(', ');
      throw new BadRequestException(
        `OQC 미완료/불합격 박스는 팔레트에 적재할 수 없습니다: ${blockList}`,
      );
    }

    // 이미 다른 팔레트에 할당된 박스 확인
    const assignedBoxes = boxes.filter(b => b.palletNo && b.palletNo !== id);
    if (assignedBoxes.length > 0) {
      throw new BadRequestException(`이미 다른 팔레트에 할당된 박스가 있습니다: ${assignedBoxes.map(b => b.boxNo).join(', ')}`);
    }

    // 팔레트 구성 단위(packUnit, 팔레트당 박스 수) 검증.
    // 추가 박스들의 품목이 섞여 있을 수 있으므로 각 품목 packUnit 중 가장 작은(가장 엄격한) 값으로 검증한다.
    // packUnit 미설정(0/null)인 품목은 검증 대상에서 제외한다(혼재 가정).
    const partItemCodes = [...new Set(boxes.map(b => b.itemCode).filter(Boolean))];
    const parts = partItemCodes.length > 0
      ? await this.partRepository.find({ where: { itemCode: In(partItemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const palletUnits = parts
      .map(p => p.packUnit ?? 0)
      .filter(n => Number.isFinite(n) && n > 0);
    if (palletUnits.length > 0) {
      const packUnit = Math.min(...palletUnits);
      if (pallet.boxCount + dto.boxIds.length > packUnit) {
        const available = packUnit - pallet.boxCount;
        throw new BadRequestException(
          `팔레트구성단위(${packUnit})를 초과했습니다. (현재 ${pallet.boxCount}개, 추가 요청 ${dto.boxIds.length}개, 최대 ${packUnit}개, 추가 가능 ${available}개)`
        );
      }
    }

    // 트랜잭션으로 박스 할당 및 팔레트 집계 업데이트
    await this.tx.run(async (queryRunner) => {
      // 박스 업데이트
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: In(dto.boxIds), ...this.tenantWhere(company, plant) },
        { palletNo: id }
      );

      // 팔레트 집계 업데이트
      const palletSummary = await queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo: id })
        .andWhere(company ? 'box.company = :company' : '1=1', { company })
        .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      const updatedPallet = await queryRunner.manager.update(
        PalletMaster,
        { palletNo: id, ...this.tenantWhere(company, plant) },
        {
          boxCount: parseInt(palletSummary?.count) || 0,
          totalQty: parseInt(palletSummary?.totalQty) || 0,
        }
      );
    });

    return this.findById(id, company, plant);
  }

  /**
   * 팔레트에서 박스 제거
   */
  async removeBox(id: string, dto: RemoveBoxFromPalletDto, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    // OPEN 상태에서만 박스 제거 가능
    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 박스를 제거할 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 박스가 이 팔레트에 있는지 확인
    const boxes = await this.boxRepository.find({
      where: {
        boxNo: In(dto.boxIds),
        palletNo: id,
        ...this.tenantWhere(company, plant),
      },
    });

    if (boxes.length !== dto.boxIds.length) {
      const foundNos = boxes.map(b => b.boxNo);
      const notFound = dto.boxIds.filter(boxId => !foundNos.includes(boxId));
      throw new NotFoundException(`이 팔레트에 없는 박스입니다: ${notFound.join(', ')}`);
    }

    // 트랜잭션으로 박스 제거 및 팔레트 집계 업데이트
    await this.tx.run(async (queryRunner) => {
      // 박스 업데이트
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: In(dto.boxIds), ...this.tenantWhere(company, plant) },
        { palletNo: null }
      );

      // 팔레트 집계 업데이트
      const palletSummary = await queryRunner.manager
        .createQueryBuilder(BoxMaster, 'box')
        .where('box.palletNo = :palletNo', { palletNo: id })
        .andWhere(company ? 'box.company = :company' : '1=1', { company })
        .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(box.qty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: id, ...this.tenantWhere(company, plant) },
        {
          boxCount: parseInt(palletSummary?.count) || 0,
          totalQty: parseInt(palletSummary?.totalQty) || 0,
        }
      );
    });

    return this.findById(id, company, plant);
  }

  // ===== 상태 관리 =====

  /**
   * 팔레트 닫기 (OPEN -> CLOSED)
   */
  async closePallet(id: string, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);
    if (!pallet.shipOrderNo) {
      throw new BadRequestException('출하지시 없는 팔레트는 마감할 수 없습니다.');
    }

    if (pallet.status !== 'OPEN') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 팔레트를 닫을 수 없습니다. OPEN 상태여야 합니다.`);
    }

    // 빈 팔레트는 닫을 수 없음
    if (pallet.boxCount <= 0) {
      throw new BadRequestException('빈 팔레트는 닫을 수 없습니다.');
    }

    // packUnit 기준 검증: 품목 packUnit 중 최소값에 도달해야 마감 가능
    const palletBoxes = await this.boxRepository.find({
      where: { palletNo: id, ...this.tenantWhere(company, plant) },
    });
    const partItemCodes = [...new Set(palletBoxes.map(b => b.itemCode).filter(Boolean))];
    const parts = partItemCodes.length > 0
      ? await this.partRepository.find({ where: { itemCode: In(partItemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const palletUnits = parts
      .map(p => p.packUnit ?? 0)
      .filter(n => Number.isFinite(n) && n > 0);
    if (palletUnits.length > 0) {
      const packUnit = Math.min(...palletUnits);
      if (pallet.boxCount < packUnit) {
        throw new BadRequestException(
          `팔레트구성단위(${packUnit})에 도달하지 않았습니다. (현재 ${pallet.boxCount}개, 최소 ${packUnit}개 필요)`
        );
      }
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: id, ...this.tenantWhere(company, plant) },
        {
          status: 'CLOSED',
          closeAt: new Date(),
        }
      );
    });

    return this.findById(id, company, plant);
  }

  /**
   * 팔레트 다시 열기 (CLOSED -> OPEN)
   */
  async reopenPallet(id: string, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    if (pallet.status !== 'CLOSED') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 팔레트를 다시 열 수 없습니다. CLOSED 상태여야 합니다.`);
    }

    // 출하에 할당되어 있으면 다시 열 수 없음
    if (pallet.shipmentId) {
      throw new BadRequestException('출하에 할당된 팔레트는 다시 열 수 없습니다.');
    }

    await this.palletRepository.update(
      { palletNo: id, ...this.tenantWhere(company, plant) },
      {
        status: 'OPEN',
        closeAt: null,
      }
    );

    return this.findById(id, company, plant);
  }

  // ===== 출하 할당 =====

  /**
   * 팔레트를 출하에 할당
   */
  async assignToShipment(id: string, dto: AssignPalletToShipmentDto, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

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
      where: { shipNo: dto.shipmentId, ...this.tenantWhere(company, plant) },
    });

    if (!shipment) {
      throw new NotFoundException(`출하를 찾을 수 없습니다: ${dto.shipmentId}`);
    }

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`출하 상태(${shipment.status})가 PREPARING이 아닙니다. PREPARING 상태 출하에만 팔레트를 할당할 수 있습니다.`);
    }

    if (shipment.shipOrderNo) {
      if (pallet.shipOrderNo !== shipment.shipOrderNo) {
        throw new BadRequestException(
          `출하지시가 다른 팔레트는 출하에 할당할 수 없습니다. (팔레트 출하지시: ${pallet.shipOrderNo ?? '없음'}, 출하 출하지시: ${shipment.shipOrderNo})`
        );
      }
    } else if (pallet.shipOrderNo) {
      throw new BadRequestException(
        `출하지시(${pallet.shipOrderNo})에 귀속된 팔레트는 출하지시 작업 화면에서 출하 처리해야 합니다.`
      );
    }

    // 트랜잭션으로 팔레트 할당 및 출하 집계 업데이트
    await this.tx.run(async (queryRunner) => {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: id, ...this.tenantWhere(company, plant) },
        {
          shipmentId: dto.shipmentId,
          status: 'LOADED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId: dto.shipmentId })
        .andWhere(company ? 'pallet.company = :company' : '1=1', { company })
        .andWhere(plant ? 'pallet.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { shipNo: dto.shipmentId, ...this.tenantWhere(company, plant) },
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
   * 팔레트를 출하에서 제거
   */
  async removeFromShipment(id: string, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    if (!pallet.shipmentId) {
      throw new BadRequestException('출하에 할당되지 않은 팔레트입니다.');
    }

    // 출하가 PREPARING 상태일 때만 제거 가능
    const shipment = await this.shipmentRepository.findOne({
      where: { shipNo: pallet.shipmentId, ...this.tenantWhere(company, plant) },
    });

    if (!shipment) {
      throw new NotFoundException('출하를 찾을 수 없습니다.');
    }

    if (shipment.status !== 'PREPARING') {
      throw new BadRequestException(`출하 상태(${shipment.status})가 PREPARING이 아닙니다. PREPARING 상태 출하에서만 팔레트를 제거할 수 있습니다.`);
    }

    const shipmentId = pallet.shipmentId;

    // 트랜잭션으로 팔레트 제거 및 출하 집계 업데이트
    await this.tx.run(async (queryRunner) => {
      // 팔레트 업데이트
      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: id, ...this.tenantWhere(company, plant) },
        {
          shipmentId: null,
          status: 'CLOSED',
        }
      );

      // 출하 집계 업데이트
      const shipmentSummary = await queryRunner.manager
        .createQueryBuilder(PalletMaster, 'pallet')
        .where('pallet.shipmentId = :shipmentId', { shipmentId })
        .andWhere(company ? 'pallet.company = :company' : '1=1', { company })
        .andWhere(plant ? 'pallet.plant = :plant' : '1=1', { plant })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(pallet.boxCount)', 'boxCount')
        .addSelect('SUM(pallet.totalQty)', 'totalQty')
        .getRawOne();

      await queryRunner.manager.update(
        ShipmentLog,
        { shipNo: shipmentId, ...this.tenantWhere(company, plant) },
        {
          palletCount: parseInt(shipmentSummary?.count) || 0,
          boxCount: parseInt(shipmentSummary?.boxCount) || 0,
          totalQty: parseInt(shipmentSummary?.totalQty) || 0,
        }
      );
    });

    return this.findById(id, company, plant);
  }

  // ===== 출하 확정 =====

  /**
   * 팔레트 출하 확정 (LOADED -> SHIPPED)
   */
  async markAsShipped(id: string, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    if (pallet.status !== 'LOADED') {
      throw new BadRequestException(`현재 상태(${pallet.status})에서는 출하 확정할 수 없습니다. LOADED 상태여야 합니다.`);
    }

    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.update(
        PalletMaster,
        { palletNo: id, ...this.tenantWhere(company, plant) },
        {
          status: 'SHIPPED',
          shippedAt: new Date(),
        }
      );
    });

    return this.findById(id, company, plant);
  }

  // ===== 조회 유틸리티 =====

  /**
   * 출하별 팔레트 목록 조회
   */
  async findByShipmentId(shipmentId: string, company?: string, plant?: string) {
    return this.palletRepository.find({
      where: { shipmentId, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 팔레트 바코드(팔레트번호)로 하위 박스 목록 조회
   * 반환: { palletNo, status, boxCount, totalQty, boxes: [...] }
   */
  async findBoxesByPallet(palletBarcode: string, company?: string, plant?: string) {
    const pallet = await this.palletRepository.findOne({
      where: { palletNo: palletBarcode, ...this.tenantWhere(company, plant) },
    });

    if (!pallet) {
      throw new NotFoundException(`팔레트를 찾을 수 없습니다: ${palletBarcode}`);
    }

    const boxes = await this.boxRepository.find({
      where: { palletNo: palletBarcode, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'ASC' },
    });

    return {
      palletNo: pallet.palletNo,
      status: pallet.status,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      shipmentId: pallet.shipmentId,
      closeAt: pallet.closeAt,
      boxes: boxes.map(box => ({
        boxNo: box.boxNo,
        itemCode: box.itemCode,
        qty: box.qty,
        status: box.status,
        oqcStatus: box.oqcStatus,
        closeAt: box.closeAt,
        createdAt: box.createdAt,
      })),
    };
  }

  /**
   * 미할당 팔레트 목록 조회 (출하에 할당되지 않은 CLOSED 상태)
   */
  async findUnassignedPallets(company?: string, plant?: string) {
    return this.palletRepository.find({
      where: {
        shipmentId: IsNull(),
        status: 'CLOSED',
        ...this.tenantWhere(company, plant),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 팔레트 요약 정보 조회
   */
  async getPalletSummary(id: string, company?: string, plant?: string) {
    const pallet = await this.findById(id, company, plant);

    // 품목별 수량 집계 - 박스 기준
    const partSummary = await this.boxRepository
      .createQueryBuilder('box')
      .select('box.itemCode', 'itemCode')
      .addSelect('COUNT(*)', 'boxCount')
      .addSelect('SUM(box.qty)', 'qty')
      .where('box.palletNo = :palletNo', { palletNo: id })
      .andWhere(company ? 'box.company = :company' : '1=1', { company })
      .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
      .groupBy('box.itemCode')
      .getRawMany();

    // 품목 정보 조회
    const itemCodes = partSummary.map(p => p.itemCode);
    const parts = await this.partRepository.find({
      where: itemCodes.length > 0
        ? { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) }
        : this.tenantWhere(company, plant),
      select: ['itemCode', 'itemName'],
    });

    const partsMap = new Map(parts.map(p => [p.itemCode, p]));

    return {
      palletNo: pallet.palletNo,
      status: pallet.status,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      closeAt: pallet.closeAt,
      partBreakdown: partSummary.map(ps => ({
        part: partsMap.get(ps.itemCode),
        boxCount: parseInt(ps.boxCount),
        qty: parseInt(ps.qty) || 0,
      })),
    };
  }
}
