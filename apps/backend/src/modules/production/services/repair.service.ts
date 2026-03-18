/**
 * @file services/repair.service.ts
 * @description 수리관리 서비스 - 수리오더 CRUD + 수리실 재고 조회
 *
 * 초보자 가이드:
 * 1. findAll: 필터 기반 목록 조회 (페이징)
 * 2. findOne: 단건 조회 (사용부품 포함)
 * 3. create: 수리 등록 (트랜잭션: 마스터 + 사용부품)
 * 4. update: 수리 수정 (트랜잭션: 마스터 + 사용부품 전체교체)
 * 5. remove: 수리 삭제 (트랜잭션: 마스터 + 사용부품)
 * 6. getInventory: 수리실 현재고 (status IN RECEIVED, IN_REPAIR)
 */
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { RepairUsedPart } from '../../../entities/repair-used-part.entity';
import {
  RepairQueryDto,
  CreateRepairDto,
  UpdateRepairDto,
} from '../dto/repair.dto';

@Injectable()
export class RepairService {
  constructor(
    @InjectRepository(RepairOrder)
    private readonly repairOrderRepo: Repository<RepairOrder>,
    @InjectRepository(RepairUsedPart)
    private readonly repairUsedPartRepo: Repository<RepairUsedPart>,
    private readonly dataSource: DataSource,
  ) {}

  /** 수리 목록 조회 */
  async findAll(query: RepairQueryDto, company: string, plant: string) {
    const {
      page = 1,
      limit = 50,
      status,
      repairDateFrom,
      repairDateTo,
      sourceProcess,
      workerId,
      search,
    } = query;

    const where: any = { company, plant };
    if (status) where.status = status;
    if (sourceProcess) where.sourceProcess = sourceProcess;
    if (workerId) where.workerId = workerId;
    if (repairDateFrom && repairDateTo) {
      where.repairDate = Between(
        new Date(repairDateFrom),
        new Date(repairDateTo),
      );
    }

    let qb = this.repairOrderRepo
      .createQueryBuilder('r')
      .where(where)
      .orderBy('r.REPAIR_DATE', 'DESC')
      .addOrderBy('r.SEQ', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb = qb.andWhere(
        '(r.FG_BARCODE LIKE :search OR r.ITEM_CODE LIKE :search OR r.ITEM_NAME LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /** 수리 단건 조회 (사용부품 포함) */
  async findOne(
    repairDate: string,
    seq: number,
    company: string,
    plant: string,
  ) {
    const order = await this.repairOrderRepo.findOne({
      where: { repairDate: new Date(repairDate), seq, company, plant },
    });
    if (!order) {
      throw new NotFoundException(
        `수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`,
      );
    }
    const usedParts = await this.repairUsedPartRepo.find({
      where: { repairDate: new Date(repairDate), seq, company, plant },
    });
    return { ...order, usedParts };
  }

  /** 수리 등록 */
  async create(dto: CreateRepairDto, company: string, plant: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repairDate = dto.repairDate
        ? new Date(dto.repairDate)
        : new Date();

      // SEQ 채번: 해당 날짜의 MAX(SEQ) + 1
      const maxResult = await queryRunner.manager
        .createQueryBuilder(RepairOrder, 'r')
        .select('MAX(r.SEQ)', 'maxSeq')
        .where(
          'r.REPAIR_DATE = :repairDate AND r.COMPANY = :company AND r.PLANT_CD = :plant',
          { repairDate, company, plant },
        )
        .getRawOne();
      const seq = (maxResult?.maxSeq || 0) + 1;

      // 마스터 저장
      const order = queryRunner.manager.create(RepairOrder, {
        repairDate,
        seq,
        status: 'RECEIVED',
        fgBarcode: dto.fgBarcode || null,
        itemCode: dto.itemCode,
        itemName: dto.itemName || null,
        qty: dto.qty,
        prdUid: dto.prdUid || null,
        sourceProcess: dto.sourceProcess || null,
        returnProcess: dto.returnProcess || null,
        repairResult: dto.repairResult || null,
        genuineType: dto.genuineType || null,
        defectType: dto.defectType || null,
        defectCause: dto.defectCause || null,
        defectPosition: dto.defectPosition || null,
        disposition: dto.disposition || null,
        workerId: dto.workerId || null,
        receivedAt: new Date(),
        remark: dto.remark || null,
        company,
        plant,
      });
      await queryRunner.manager.save(RepairOrder, order);

      // 사용부품 저장
      if (dto.usedParts?.length) {
        const parts = dto.usedParts.map((p) =>
          queryRunner.manager.create(RepairUsedPart, {
            repairDate,
            seq,
            itemCode: p.itemCode,
            itemName: p.itemName || null,
            prdUid: p.prdUid || null,
            qty: p.qty,
            remark: p.remark || null,
            company,
            plant,
          }),
        );
        await queryRunner.manager.save(RepairUsedPart, parts);
      }

      await queryRunner.commitTransaction();
      return { repairDate, seq };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수리 수정 */
  async update(
    repairDate: string,
    seq: number,
    dto: UpdateRepairDto,
    company: string,
    plant: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(RepairOrder, {
        where: { repairDate: new Date(repairDate), seq, company, plant },
      });
      if (!existing) {
        throw new NotFoundException(
          `수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`,
        );
      }

      // 마스터 업데이트
      const { usedParts, ...masterDto } = dto;
      const updateData: any = { ...masterDto };
      delete updateData.repairDate;

      // 수리후재처리 결정 시 완료 처리
      if (
        dto.disposition &&
        dto.disposition !== 'PENDING' &&
        existing.status !== 'COMPLETED'
      ) {
        updateData.completedAt = new Date();
        updateData.status = 'COMPLETED';
      }

      await queryRunner.manager.update(
        RepairOrder,
        { repairDate: new Date(repairDate), seq },
        updateData,
      );

      // 사용부품 전체 교체
      if (usedParts !== undefined) {
        await queryRunner.manager.delete(RepairUsedPart, {
          repairDate: new Date(repairDate),
          seq,
        });
        if (usedParts?.length) {
          const parts = usedParts.map((p) =>
            queryRunner.manager.create(RepairUsedPart, {
              repairDate: new Date(repairDate),
              seq,
              itemCode: p.itemCode,
              itemName: p.itemName || null,
              prdUid: p.prdUid || null,
              qty: p.qty,
              remark: p.remark || null,
              company,
              plant,
            }),
          );
          await queryRunner.manager.save(RepairUsedPart, parts);
        }
      }

      await queryRunner.commitTransaction();
      return { repairDate, seq };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수리 삭제 */
  async remove(
    repairDate: string,
    seq: number,
    company: string,
    plant: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(RepairOrder, {
        where: { repairDate: new Date(repairDate), seq, company, plant },
      });
      if (!existing) {
        throw new NotFoundException(
          `수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`,
        );
      }

      await queryRunner.manager.delete(RepairUsedPart, {
        repairDate: new Date(repairDate),
        seq,
      });
      await queryRunner.manager.delete(RepairOrder, {
        repairDate: new Date(repairDate),
        seq,
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수리실 현재고 조회 */
  async getInventory(company: string, plant: string) {
    return this.repairOrderRepo.find({
      where: { company, plant, status: In(['RECEIVED', 'IN_REPAIR']) },
      order: { receivedAt: 'ASC' },
    });
  }
}
