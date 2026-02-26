/**
 * @file src/modules/quality/services/oqc.service.ts
 * @description OQC(출하검사) 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **createRequest**: 의뢰 생성 + 박스 연결 + 박스 oqcStatus 변경
 * 2. **executeInspection**: 검사 판정(PASS/FAIL) + 박스 oqcStatus 일괄 업데이트
 * 3. **getAvailableBoxes**: CLOSED 상태 + oqcStatus IS NULL인 박스 조회
 * 4. **getStats**: 상태별 통계 (총/대기/합격/불합격)
 *
 * 프로세스 흐름:
 * CLOSED 박스 → OQC 의뢰(PENDING) → 검사 실행 → 판정(PASS/FAIL)
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { OqcRequest } from '../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../entities/oqc-request-box.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreateOqcRequestDto,
  ExecuteOqcInspectionDto,
  UpdateOqcResultDto,
  OqcRequestQueryDto,
} from '../dto/oqc.dto';

@Injectable()
export class OqcService {
  private readonly logger = new Logger(OqcService.name);

  constructor(
    @InjectRepository(OqcRequest)
    private readonly oqcRequestRepo: Repository<OqcRequest>,
    @InjectRepository(OqcRequestBox)
    private readonly oqcRequestBoxRepo: Repository<OqcRequestBox>,
    @InjectRepository(BoxMaster)
    private readonly boxRepo: Repository<BoxMaster>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 목록 조회 (QueryBuilder + PartMaster 조인) */
  async findAll(query: OqcRequestQueryDto, company?: string) {
    const { page = 1, limit = 50, search, status, customer, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.oqcRequestRepo
      .createQueryBuilder('oqc')
      .leftJoinAndMapOne('oqc.part', PartMaster, 'part', 'oqc.itemCode = part.itemCode')

    if (company) qb.andWhere('oqc.company = :company', { company });
    if (status) qb.andWhere('oqc.status = :status', { status });
    if (customer) qb.andWhere('oqc.customer LIKE :customer', { customer: `%${customer}%` });
    if (fromDate) qb.andWhere('oqc.requestDate >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('oqc.requestDate <= :toDate', { toDate });
    if (search) {
      qb.andWhere(
        '(oqc.requestNo LIKE :search OR part.itemCode LIKE :search OR part.itemName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('oqc.requestDate', 'DESC')
      .addOrderBy('oqc.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /** 상세 조회 (의뢰 + 연결 박스 목록) */
  async findById(id: string) {
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC 의뢰를 찾을 수 없습니다: ${id}`);
    }

    // 품목 정보 조인
    const part = await this.partRepo.findOne({ where: { itemCode: oqcRequest.itemCode } });

    return { ...oqcRequest, part };
  }

  /** 의뢰 생성 — requestNo 자동채번, 박스 유효성 검사, oqcStatus=PENDING */
  async createRequest(dto: CreateOqcRequestDto, company?: string, createdBy?: string) {
    const { itemCode, boxIds, customer, requestDate, sampleSize } = dto;

    // 1. 박스 유효성: status=CLOSED + oqcStatus IS NULL
    const boxes = await this.boxRepo.find({
      where: { boxNo: In(boxIds) },
    });

    if (boxes.length !== boxIds.length) {
      throw new BadRequestException('일부 박스를 찾을 수 없습니다.');
    }

    const invalidBoxes = boxes.filter(b => b.status !== 'CLOSED' || b.oqcStatus !== null);
    if (invalidBoxes.length > 0) {
      throw new BadRequestException(
        `검사 불가 박스: ${invalidBoxes.map(b => b.boxNo).join(', ')} (CLOSED 상태 + OQC 미의뢰 박스만 가능)`,
      );
    }

    // 2. requestNo 자동채번: OQC-YYYYMMDD-NNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `OQC-${dateStr}`;

    const lastReq = await this.oqcRequestRepo
      .createQueryBuilder('oqc')
      .where('oqc.requestNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('oqc.requestNo', 'DESC')
      .getOne();

    let seq = 1;
    if (lastReq) {
      const lastSeq = parseInt(lastReq.requestNo.split('-').pop() || '0', 10);
      seq = lastSeq + 1;
    }
    const requestNo = `${prefix}-${String(seq).padStart(3, '0')}`;

    const totalQty = boxes.reduce((sum, b) => sum + b.qty, 0);

    // 3. 트랜잭션으로 의뢰 + 박스 연결 + 박스 상태 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oqcRequest = queryRunner.manager.create(OqcRequest, {
        requestNo,
        itemCode,
        customer: customer || null,
        requestDate: requestDate ? new Date(requestDate) : today,
        totalBoxCount: boxes.length,
        totalQty,
        sampleSize: sampleSize || null,
        status: 'PENDING',
        company: company || null,
        createdBy: createdBy || null,
      });
      const saved = await queryRunner.manager.save(OqcRequest, oqcRequest);

      // OqcRequestBox 레코드 생성
      const requestBoxes = boxes.map(box =>
        queryRunner.manager.create(OqcRequestBox, {
          requestNo: saved.requestNo,
          boxNo: box.boxNo,
          qty: box.qty,
          isSample: 'N',
        }),
      );
      await queryRunner.manager.save(OqcRequestBox, requestBoxes);

      // 박스 oqcStatus 업데이트
      await queryRunner.manager.update(
        BoxMaster,
        { boxNo: In(boxIds) },
        { oqcStatus: 'PENDING' },
      );

      await queryRunner.commitTransaction();
      return this.findById(saved.requestNo);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 검사 실행 — 판정(PASS/FAIL), 샘플 표시, oqcStatus 일괄 업데이트 */
  async executeInspection(id: string, dto: ExecuteOqcInspectionDto, updatedBy?: string) {
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC 의뢰를 찾을 수 없습니다: ${id}`);
    }

    if (oqcRequest.status !== 'PENDING' && oqcRequest.status !== 'IN_PROGRESS') {
      throw new BadRequestException('대기/진행 상태의 의뢰만 검사 실행이 가능합니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 샘플 박스 표시
      if (dto.sampleBoxIds && dto.sampleBoxIds.length > 0) {
        await queryRunner.manager.update(
          OqcRequestBox,
          { requestNo: id, boxNo: In(dto.sampleBoxIds) },
          { isSample: 'Y' },
        );
      }

      // 2. 의뢰 결과 업데이트
      await queryRunner.manager.update(OqcRequest, { requestNo: id }, {
        status: dto.result,
        result: dto.result,
        details: dto.details || null,
        inspectorName: dto.inspectorName || null,
        inspectDate: new Date(),
        updatedBy: updatedBy || null,
      });

      // 3. 연결된 박스 oqcStatus 일괄 업데이트
      const boxNos = oqcRequest.boxes.map(b => b.boxNo);
      if (boxNos.length > 0) {
        await queryRunner.manager.update(
          BoxMaster,
          { boxNo: In(boxNos) },
          { oqcStatus: dto.result },
        );
      }

      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 결과 수정 (판정 후 보정) */
  async updateResult(id: string, dto: UpdateOqcResultDto, updatedBy?: string) {
    const oqcRequest = await this.oqcRequestRepo.findOne({
      where: { requestNo: id },
      relations: ['boxes'],
    });

    if (!oqcRequest) {
      throw new NotFoundException(`OQC 의뢰를 찾을 수 없습니다: ${id}`);
    }

    const updateData: Partial<OqcRequest> = { updatedBy: updatedBy || null };
    if (dto.result) updateData.result = dto.result;
    if (dto.result) updateData.status = dto.result;
    if (dto.details !== undefined) updateData.details = dto.details;
    if (dto.inspectorName !== undefined) updateData.inspectorName = dto.inspectorName;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(OqcRequest, { requestNo: id }, updateData);

      // 결과 변경 시 박스 oqcStatus도 동기화
      if (dto.result) {
        const boxNos = oqcRequest.boxes.map(b => b.boxNo);
        if (boxNos.length > 0) {
          await queryRunner.manager.update(
            BoxMaster,
            { boxNo: In(boxNos) },
            { oqcStatus: dto.result },
          );
        }
      }

      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 검사 가능 박스 목록 (CLOSED + oqcStatus IS NULL) */
  async getAvailableBoxes(itemCode?: string, company?: string) {
    const qb = this.boxRepo
      .createQueryBuilder('box')
      .leftJoinAndMapOne('box.part', PartMaster, 'part', 'box.itemCode = part.itemCode')
      .where('box.status = :status', { status: 'CLOSED' })
      .andWhere('box.oqcStatus IS NULL')

    if (itemCode) qb.andWhere('box.itemCode = :itemCode', { itemCode });
    if (company) qb.andWhere('box.company = :company', { company });

    qb.orderBy('box.boxNo', 'ASC');

    return qb.getMany();
  }

  /** 통계 (총/대기/합격/불합격) */
  async getStats(company?: string) {
    const qb = this.oqcRequestRepo
      .createQueryBuilder('oqc')

    if (company) qb.andWhere('oqc.company = :company', { company });

    const all = await qb.getMany();

    return {
      total: all.length,
      pending: all.filter(r => r.status === 'PENDING').length,
      pass: all.filter(r => r.status === 'PASS' || r.result === 'PASS').length,
      fail: all.filter(r => r.status === 'FAIL' || r.result === 'FAIL').length,
    };
  }
}
