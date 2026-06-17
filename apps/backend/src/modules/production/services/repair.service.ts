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
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, FindOptionsWhere } from 'typeorm';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { RepairUsedPart } from '../../../entities/repair-used-part.entity';
import { TransactionService } from '../../../shared/transaction.service';
import {
  RepairQueryDto,
  CreateRepairDto,
  UpdateRepairDto,
} from '../dto/repair.dto';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class RepairService {
  constructor(
    @InjectRepository(RepairOrder)
    private readonly repairOrderRepo: Repository<RepairOrder>,
    @InjectRepository(RepairUsedPart)
    private readonly repairUsedPartRepo: Repository<RepairUsedPart>,
    private readonly tx: TransactionService,
  ) {}

  private buildRepairOrderUpdate(
    dto: Omit<UpdateRepairDto, 'usedParts' | 'repairDate'>,
  ): Partial<Pick<RepairOrder,
    | 'fgBarcode'
    | 'itemCode'
    | 'itemName'
    | 'qty'
    | 'prdUid'
    | 'sourceProcess'
    | 'returnProcess'
    | 'repairResult'
    | 'genuineType'
    | 'defectType'
    | 'defectCause'
    | 'defectPosition'
    | 'disposition'
    | 'workerId'
    | 'remark'
    | 'completedAt'
    | 'status'
  >> {
    return {
      ...(dto.fgBarcode !== undefined ? { fgBarcode: dto.fgBarcode || null } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.itemName !== undefined ? { itemName: dto.itemName || null } : {}),
      ...(dto.qty !== undefined ? { qty: dto.qty } : {}),
      ...(dto.prdUid !== undefined ? { prdUid: dto.prdUid || null } : {}),
      ...(dto.sourceProcess !== undefined ? { sourceProcess: dto.sourceProcess || null } : {}),
      ...(dto.returnProcess !== undefined ? { returnProcess: dto.returnProcess || null } : {}),
      ...(dto.repairResult !== undefined ? { repairResult: dto.repairResult || null } : {}),
      ...(dto.genuineType !== undefined ? { genuineType: dto.genuineType || null } : {}),
      ...(dto.defectType !== undefined ? { defectType: dto.defectType || null } : {}),
      ...(dto.defectCause !== undefined ? { defectCause: dto.defectCause || null } : {}),
      ...(dto.defectPosition !== undefined ? { defectPosition: dto.defectPosition || null } : {}),
      ...(dto.disposition !== undefined ? { disposition: dto.disposition || null } : {}),
      ...(dto.workerId !== undefined ? { workerId: dto.workerId || null } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark || null } : {}),
    };
  }

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

    const where: FindOptionsWhere<RepairOrder> = { company, plant };
    if (status) where.status = status;
    if (sourceProcess) where.sourceProcess = sourceProcess;
    if (workerId) where.workerId = workerId;
    if (repairDateFrom && repairDateTo) {
      where.repairDate = Between(
        parseDateStart(repairDateFrom)!,
        parseDateEnd(repairDateTo)!,
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
      where: { repairDate: parseDateStart(repairDate)!, seq, company, plant },
    });
    if (!order) {
      throw new NotFoundException(
        `수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`,
      );
    }
    const usedParts = await this.repairUsedPartRepo.find({
      where: { repairDate: parseDateStart(repairDate)!, seq, company, plant },
    });
    return { ...order, usedParts };
  }

  /** 수리 등록 */
  async create(dto: CreateRepairDto, company: string, plant: string) {
    return this.tx.run(async (queryRunner) => {
      const repairDate = dto.repairDate
        ? parseDateStart(dto.repairDate)!
        : new Date();

      const seqResult = await queryRunner.manager.query(
        `SELECT SEQ_REPAIR_ORDERS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const seq = seqResult[0].nextSeq;

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

      return { repairDate, seq };
    });
  }

  /** 수리 수정 */
  async update(
    repairDate: string,
    seq: number,
    dto: UpdateRepairDto,
    company: string,
    plant: string,
  ) {
    return this.tx.run(async (queryRunner) => {
      const existing = await queryRunner.manager.findOne(RepairOrder, {
        where: { repairDate: parseDateStart(repairDate)!, seq, company, plant },
      });
      if (!existing) {
        throw new NotFoundException(
          `수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`,
        );
      }

      // 마스터 업데이트
      const { usedParts, repairDate: _ignoredRepairDate, ...masterDto } = dto;
      const updateData = this.buildRepairOrderUpdate(masterDto);

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
        { repairDate: parseDateStart(repairDate)!, seq, company, plant },
        updateData,
      );

      // 사용부품 전체 교체
      if (usedParts !== undefined) {
        await queryRunner.manager.delete(RepairUsedPart, {
          repairDate: parseDateStart(repairDate)!,
          seq,
          company,
          plant,
        });
        if (usedParts?.length) {
          const parts = usedParts.map((p) =>
            queryRunner.manager.create(RepairUsedPart, {
              repairDate: parseDateStart(repairDate)!,
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

      return { repairDate, seq };
    });
  }

  /** 수리 삭제 */
  async remove(
    repairDate: string,
    seq: number,
    company: string,
    plant: string,
  ) {
    await this.tx.run(async (queryRunner) => {
      const existing = await queryRunner.manager.findOne(RepairOrder, {
        where: { repairDate: parseDateStart(repairDate)!, seq, company, plant },
      });
      if (!existing) {
        throw new NotFoundException(
          `수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`,
        );
      }
      if (existing.status !== 'RECEIVED') {
        throw new BadRequestException(
          `수리오더는 RECEIVED 상태에서만 삭제할 수 있습니다. 현재 상태: ${existing.status}`,
        );
      }

      await queryRunner.manager.delete(RepairUsedPart, {
        repairDate: parseDateStart(repairDate)!,
        seq,
        company,
        plant,
      });
      await queryRunner.manager.delete(RepairOrder, {
        repairDate: parseDateStart(repairDate)!,
        seq,
        company,
        plant,
      });
    });
  }

  /** 수리실 현재고 조회 */
  async getInventory(company: string, plant: string) {
    return this.repairOrderRepo.find({
      where: { company, plant, status: In(['RECEIVED', 'IN_REPAIR']) },
      order: { receivedAt: 'ASC' },
    });
  }
}
