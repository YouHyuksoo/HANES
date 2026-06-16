/**
 * @file src/modules/production/services/prod-result.service.ts
 * @description 생산실적 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **실적 집계**: 작업지시별, 설비별, 작업자별 실적 집계
 * 3. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 * 4. **PK**: resultNo(채번 문자열)
 *
 * 실제 DB 스키마 (PROD_RESULTS 테이블):
 * - RESULT_NO: PK (SeqGenerator 채번)
 * - ORDER_NO: 작업지시 참조
 * - status: RUNNING, DONE, CANCELED
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, In, DataSource } from 'typeorm';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableUsageMap } from '../../../entities/consumable-usage-map.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import {
  CreateProdResultDto,
  UpdateProdResultDto,
  ProdResultQueryDto,
  CompleteProdResultDto,
} from '../dto/prod-result.dto';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { FgLabel } from '../../../entities/fg-label.entity';
import { DefectLog } from '../../../entities/defect-log.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { ShiftResolver } from '../../../utils/shift-resolver';

@Injectable()
export class ProdResultService {
  private readonly logger = new Logger(ProdResultService.name);
  private shiftResolver: ShiftResolver;

  constructor(
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
    @InjectRepository(EquipBomRel)
    private readonly equipBomRelRepository: Repository<EquipBomRel>,
    @InjectRepository(EquipBomItem)
    private readonly equipBomItemRepository: Repository<EquipBomItem>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(ConsumableMaster)
    private readonly consumableMasterRepository: Repository<ConsumableMaster>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkerMaster)
    private readonly workerMasterRepository: Repository<WorkerMaster>,
    private readonly dataSource: DataSource,
    private readonly autoIssueService: AutoIssueService,
    private readonly productInventoryService: ProductInventoryService,
    private readonly wipMatStockService: WipMatStockService,
    private readonly numbering: NumberingService,
    private readonly sysConfigService: SysConfigService,
    @InjectRepository(ShiftPattern)
    private readonly shiftPatternRepo: Repository<ShiftPattern>,
    private readonly tx: TransactionService,
  ) {
    this.shiftResolver = new ShiftResolver(this.shiftPatternRepo);
  }

  private buildProdResultUpdate(
    dto: Omit<UpdateProdResultDto, 'status' | 'orderNo'>,
  ): Partial<Pick<ProdResult,
    | 'equipCode'
    | 'workerId'
    | 'prdUid'
    | 'processCode'
    | 'goodQty'
    | 'defectQty'
    | 'startAt'
    | 'endAt'
    | 'cycleTime'
    | 'remark'
    | 'shiftCode'
  >> {
    return {
      ...(dto.equipCode !== undefined ? { equipCode: dto.equipCode } : {}),
      ...(dto.workerId !== undefined ? { workerId: dto.workerId ?? null } : {}),
      ...(dto.prdUid !== undefined ? { prdUid: dto.prdUid } : {}),
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(dto.goodQty !== undefined ? { goodQty: dto.goodQty } : {}),
      ...(dto.defectQty !== undefined ? { defectQty: dto.defectQty } : {}),
      ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt) } : {}),
      ...(dto.endAt !== undefined ? { endAt: new Date(dto.endAt) } : {}),
      ...(dto.cycleTime !== undefined ? { cycleTime: dto.cycleTime } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.shiftCode !== undefined ? { shiftCode: dto.shiftCode } : {}),
    };
  }

  /**
   * 생산실적 목록 조회
   */
  async findAll(query: ProdResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      search,
      orderNo,
      equipCode,
      workerId,
      prdUid,
      processCode,
      status,
      shiftCode,
      startTimeFrom,
      startTimeTo,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.jobOrder', 'jobOrder')
      .leftJoinAndSelect('pr.equip', 'equip')
      .leftJoinAndSelect('pr.worker', 'worker');

    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });
    if (search) {
      const upperSearch = `%${search.toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(pr.resultNo) LIKE :search OR UPPER(pr.orderNo) LIKE :search OR UPPER(pr.prdUid) LIKE :search)',
        { search: upperSearch },
      );
    }
    if (orderNo) qb.andWhere('pr.orderNo = :orderNo', { orderNo });
    if (equipCode) qb.andWhere('pr.equipCode = :equipCode', { equipCode });
    if (workerId) qb.andWhere('pr.workerId = :workerId', { workerId });
    if (prdUid) qb.andWhere('pr.prdUid LIKE :prdUid', { prdUid: `%${prdUid}%` });
    if (processCode) qb.andWhere('pr.processCode = :processCode', { processCode });
    if (status) qb.andWhere('pr.status = :status', { status });
    if (shiftCode) qb.andWhere('pr.shiftCode = :shiftCode', { shiftCode });
    if (startTimeFrom) qb.andWhere("pr.startAt >= TO_DATE(:startTimeFrom, 'YYYY-MM-DD')", { startTimeFrom });
    if (startTimeTo) qb.andWhere("pr.startAt < TO_DATE(:startTimeTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { startTimeTo });

    qb.orderBy('pr.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await Promise.all([
      qb.getMany(),
      qb.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 생산실적 단건 조회 (resultNo)
   */
  async findById(resultNo: string, company?: string, plant?: string) {
    const prodResult = await this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'jobOrder.part', 'equip', 'worker', 'inspectResults', 'defectLogs'],
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${resultNo}`);
    }

    // Filter inspectResults (only passYn = 'N') and limit to 10
    if (prodResult.inspectResults) {
      prodResult.inspectResults = prodResult.inspectResults
        .filter((r) => r.passYn === 'N')
        .slice(0, 10);
    }

    // Limit defectLogs to 10
    if (prodResult.defectLogs) {
      prodResult.defectLogs = prodResult.defectLogs.slice(0, 10);
    }

    // 자재 투입 이력 조회
    const matIssues = await this.findMatIssues(prodResult.resultNo, company, plant);

    return { ...prodResult, matIssues };
  }

  /**
   * 생산실적의 자재 투입 이력 조회
   */
  async findMatIssues(resultNo: string, company?: string, plant?: string) {
    const issues = await this.matIssueRepository.find({
      where: {
        prodResultNo: resultNo,
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { issueDate: 'DESC' },
    });

    // LOT 및 품목 정보 추가
    const matUids = issues.map(i => i.matUid).filter(Boolean);
    const lots = matUids.length > 0
      ? await this.dataSource.getRepository(MatLot).find({
          where: {
            matUid: In(matUids),
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : [];
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    const itemCodes = lots.map((l) => l.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({
          where: { itemCode: In(itemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    return issues.map(issue => {
      const lot = lotMap.get(issue.matUid);
      const part = lot ? partMap.get(lot.itemCode) : null;
      return {
        ...issue,
        matUid: issue.matUid,
        itemCode: lot?.itemCode ?? null,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
      };
    });
  }

  /**
   * 작업지시별 생산실적 목록 조회
   */
  async findByJobOrderId(orderNo: string, company?: string, plant?: string) {
    return this.prodResultRepository.find({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      order: { createdAt: 'DESC' },
      relations: ['equip', 'worker'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 설비부품 인터락 체크
   * - 작업지시 품목과 설비에 장착된 부품이 일치하는지 확인
   * - 불일치 시 BadRequestException 발생
   */
  private async checkEquipBomInterlock(
    equipCode: string | null | undefined,
    orderNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    if (!equipCode) return; // 설비 미지정 시 체크 불필요

    // 작업지시 품목 조회
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
    if (!jobOrder?.part) return; // 품목 정보 없으면 체크 불필요

    const jobPartCode = jobOrder.part.itemCode;

    // 설비에 장착된 BOM 부품 조회
    const equipBomRels = await this.equipBomRelRepository.find({
      where: { equipCode, useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (equipBomRels.length === 0) return; // 설비 BOM 미설정 시 체크 불필요

    const bomItemCodes = equipBomRels.map(rel => rel.bomItemCode);
    const bomItems = await this.equipBomItemRepository.find({
      where: { bomItemCode: In(bomItemCodes), useYn: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    // 설비 BOM 품목 코드 목록
    const equipPartCodes = bomItems.map(item => item.bomItemCode);

    // 품목 코드 일치 여부 확인
    // - 작업지시 품번이 설비 BOM에 포함되거나
    // - 또는 작업지시 품번과 설비 BOM 품번이 일치하는지 확인
    const isMatched = equipPartCodes.some(code => 
      code === jobPartCode || 
      jobPartCode.includes(code) || 
      code.includes(jobPartCode)
    );

    if (!isMatched) {
      throw new BadRequestException(
        `설비부품 인터락 오류: 작업지시 품목(${jobPartCode})이 ` +
        `설비(${equipCode})의 장착부품(${equipPartCodes.join(', ')})과 일치하지 않습니다. ` +
        `설비부품을 교체하거나 작업지시를 확인하세요.`
      );
    }
  }

  /**
   * 작업지시 수량 초과 체크
   * - 기등록 실적 + 새 실적의 합이 planQty를 초과하는지 확인
   */
  private async checkJobOrderQtyLimit(
    orderNo: string,
    newGoodQty: number,
    newDefectQty: number,
    company?: string,
    plant?: string,
  ): Promise<void> {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['orderNo', 'planQty'],
    });
    
    if (!jobOrder) return; // 작업지시 없으면 체크 불필요
    if (!jobOrder.planQty || jobOrder.planQty <= 0) return; // planQty 미설정 시 체크 불필요

    // 기등록 실적 집계
    const existingSummary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGood')
      .addSelect('SUM(pr.defectQty)', 'totalDefect')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere(company ? 'pr.company = :company' : '1=1', company ? { company } : {})
      .andWhere(plant ? 'pr.plant = :plant' : '1=1', plant ? { plant } : {})
      .andWhere('pr.status != :canceled', { canceled: 'CANCELED' })
      .getRawOne();

    const existingGood = parseInt(existingSummary?.totalGood) || 0;
    const existingDefect = parseInt(existingSummary?.totalDefect) || 0;
    const existingTotal = existingGood + existingDefect;

    const willBeTotal = existingTotal + newGoodQty + newDefectQty;

    // 수량 초과 체크
    if (willBeTotal > jobOrder.planQty) {
      throw new BadRequestException(
        `작업지시(${jobOrder.orderNo}) 수량 초과: ` +
        `계획수량 ${jobOrder.planQty}, ` +
        `기등록 ${existingTotal} (양품${existingGood}/불량${existingDefect}), ` +
        `이번입력 ${newGoodQty + newDefectQty} (양품${newGoodQty}/불량${newDefectQty})`
      );
    }
  }

  /**
   * 생산실적 생성
   */
  async create(dto: CreateProdResultDto, company?: string, plant?: string) {
    // 작업지시 존재 및 상태 확인
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
    }
    this.assertTenantConsistency('생산실적 작업지시', {
      expected: { company, plant },
      sources: [{ label: 'jobOrder', company: jobOrder.company, plant: jobOrder.plant }],
    });

    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시에는 실적을 등록할 수 없습니다.`);
    }
    if (jobOrder.status === 'HOLD') {
      throw new BadRequestException(`홀딩된 작업지시에는 실적을 등록할 수 없습니다.`);
    }

    // 불량 상세가 오면 합계로 defectQty를 산정한다(상세=권위). 이중 카운트 방지를 위해
    // DefectLog는 본 트랜잭션에서 직접 저장하고 별도 증가 로직(defect-log.service)을 거치지 않는다.
    const defectDetails = dto.defects ?? [];
    const defectsTotal = defectDetails.reduce((sum, d) => sum + (d.qty ?? 1), 0);
    const effectiveDefectQty = defectDetails.length > 0 ? defectsTotal : (dto.defectQty ?? 0);

    // 작업지시 수량 초과 체크
    await this.checkJobOrderQtyLimit(dto.orderNo, dto.goodQty ?? 0, effectiveDefectQty, company, plant);

    // 설비부품 인터락 체크
    await this.checkEquipBomInterlock(dto.equipCode, dto.orderNo, company, plant);

    // 설비 존재 확인 (옵션)
    if (dto.equipCode) {
      const equip = await this.equipMasterRepository.findOne({
        where: { equipCode: dto.equipCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });
      if (!equip) {
        throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);
      }
      this.assertTenantConsistency('생산실적 설비', {
        expected: { company, plant },
        sources: [{ label: 'equip', company: equip.company, plant: equip.plant }],
      });
    }

    // 작업자 존재 확인 (옵션)
    // PROD_RESULTS.worker 관계는 WORKER_MASTERS.workerCode를 참조하므로 작업자마스터를 우선 조회한다.
    // (입력 화면들은 workerCode를 workerId로 전송). 과거 데이터 호환을 위해 USERS.email 폴백도 허용한다.
    if (dto.workerId) {
      const tenantWhere = {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      };
      const worker = await this.workerMasterRepository.findOne({
        where: { workerCode: dto.workerId, ...tenantWhere },
      });
      const legacyUser = worker
        ? null
        : await this.userRepository.findOne({
            where: { email: dto.workerId, ...tenantWhere },
          });
      if (!worker && !legacyUser) {
        throw new NotFoundException(`작업자를 찾을 수 없습니다: ${dto.workerId}`);
      }
    }

    let savedResultNo!: string;
    await this.tx.run(async (queryRunner) => {
      const resultNo = await this.numbering.next('PROD_RESULT', queryRunner);
      const prodResult = queryRunner.manager.create(ProdResult, {
        resultNo,
        orderNo: dto.orderNo,
        equipCode: dto.equipCode,
        workerId: dto.workerId ?? null,
        prdUid: dto.prdUid,
        processCode: dto.processCode,
        goodQty: dto.goodQty ?? 0,
        defectQty: effectiveDefectQty,
        startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        cycleTime: dto.cycleTime,
        status: 'RUNNING',
        remark: dto.remark,
        company: jobOrder.company,
        plant: jobOrder.plant,
      });

      // 교대 자동판별
      if (dto.shiftCode) {
        prodResult.shiftCode = dto.shiftCode;
      } else if (prodResult.startAt && jobOrder.company && jobOrder.plant) {
        prodResult.shiftCode = await this.shiftResolver.resolve(
          new Date(prodResult.startAt), jobOrder.company, jobOrder.plant,
        );
      }

      const saved = await queryRunner.manager.save(ProdResult, prodResult);
      savedResultNo = saved.resultNo;

      // 실적이 최초 등록되면 작업지시를 RUNNING으로 승격한다.
      if (jobOrder.status === 'WAITING') {
        await queryRunner.manager.update(
          JobOrder,
          { orderNo: dto.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          { status: 'RUNNING', startAt: new Date() },
        );
      }

      // FG 바코드 사전 발행 (ON_PRODUCTION 모드)
      const fgTiming = await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING');
      if (fgTiming === 'ON_PRODUCTION') {
        const fgJobOrder = await queryRunner.manager.findOne(JobOrder, {
          where: { orderNo: dto.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        });
        if (fgJobOrder) {
          this.assertTenantConsistency('생산실적 FG 라벨 작업지시', {
            expected: { company, plant },
            sources: [{ label: 'fgJobOrder', company: fgJobOrder.company, plant: fgJobOrder.plant }],
          });
          const fgBarcode = await this.numbering.nextFgBarcode(queryRunner);
          await queryRunner.manager.save(FgLabel, {
            fgBarcode,
            itemCode: fgJobOrder.itemCode,
            orderNo: dto.orderNo,
            status: 'PENDING',
            inspectPassYn: null,
            company: fgJobOrder.company,
            plant: fgJobOrder.plant,
          });
          // prdUid에 FG 바코드 연결
          await queryRunner.manager.update(
            ProdResult,
            {
              resultNo: savedResultNo,
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
            { prdUid: fgBarcode },
          );
        }
      }

      // 불량 상세 로그 저장 (불량입력 모달에서 등록된 유형별 불량)
      // 같은 occurAt에 seq 1..N으로 복합 PK 충돌을 방지하고, defectQty는 위에서 이미 산정했으므로 재증가하지 않는다.
      if (defectDetails.length > 0) {
        const occurAt = new Date();
        for (let i = 0; i < defectDetails.length; i++) {
          const d = defectDetails[i];
          await queryRunner.manager.save(DefectLog, {
            occurAt,
            seq: i + 1,
            prodResultNo: savedResultNo,
            defectCode: d.defectCode,
            defectName: d.defectName ?? null,
            qty: d.qty ?? 1,
            status: 'WAIT',
            company: jobOrder.company,
            plant: jobOrder.plant,
          });
        }
      }

      // BOM 기반 자재 자동차감 (ON_CREATE)
      const totalQty = (dto.goodQty ?? 0) + effectiveDefectQty;
      if (totalQty > 0) {
        const autoResult = await this.autoIssueService.execute(
          'ON_CREATE', saved.resultNo, dto.orderNo, totalQty, queryRunner,
        );
        if (autoResult.warnings.length > 0) {
          this.logger.warn(`자동차감 경고: ${autoResult.warnings.join(', ')}`);
        }
      }
    });

    return this.prodResultRepository.findOne({
      where: { resultNo: savedResultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'equip', 'worker'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 수정
   * - 수량(goodQty/defectQty) 변경 시 자재 자동차감 재계산 (역분개 후 재차감)
   */
  async update(resultNo: string, dto: UpdateProdResultDto, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    // DONE 상태에서는 일부 필드만 수정 가능
    if (prodResult.status === 'DONE') {
      if (dto.orderNo || dto.equipCode || dto.workerId || dto.startAt) {
        throw new BadRequestException(`완료된 실적의 핵심 정보는 수정할 수 없습니다.`);
      }
    }

    // 수량 변경 여부 판단
    const oldTotalQty = prodResult.goodQty + prodResult.defectQty;
    const newGoodQty = dto.goodQty ?? prodResult.goodQty;
    const newDefectQty = dto.defectQty ?? prodResult.defectQty;
    const newTotalQty = newGoodQty + newDefectQty;
    const qtyChanged = (dto.goodQty !== undefined || dto.defectQty !== undefined) && oldTotalQty !== newTotalQty;

    await this.tx.run(async (queryRunner) => {
      if (dto.status !== undefined) {
        throw new BadRequestException(
          '???? ??? ?? ???? ??? ? ????. ?? ?? ?? ?? API? ??? ???.',
        );
      }
      if (dto.orderNo !== undefined && dto.orderNo !== prodResult.orderNo) {
        throw new BadRequestException('생산실적의 작업지시 번호는 수정할 수 없습니다.');
      }
      const { status: _ignoredStatus, orderNo: _ignoredOrderNo, ...resultData } = dto;
      const updateData = this.buildProdResultUpdate(resultData);

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(
          ProdResult,
          {
            resultNo: prodResult.resultNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          updateData,
        );
      }

      // 수량 변경 시 자재 자동차감 재계산 (역분개 → 재차감)
      if (qtyChanged && prodResult.status !== 'DONE') {
        await this.reverseAutoIssue(
          queryRunner,
          resultNo,
          company ?? prodResult.company,
          plant ?? prodResult.plant,
        );
        if (newTotalQty > 0) {
          await this.autoIssueService.execute(
            'ON_CREATE', resultNo, prodResult.orderNo, newTotalQty, queryRunner,
          );
        }
        this.logger.log(
          `실적 수량 변경 자동차감 재계산: ${resultNo} (${oldTotalQty} → ${newTotalQty})`,
        );
      }
    });

    return this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'equip', 'worker'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 삭제
   */
  async delete(resultNo: string, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status !== 'CANCELED') {
      throw new BadRequestException(
        `????? ?? ??? ??? ? ????. ?? ?? ??? ???. ?? ??: ${prodResult.status}`,
      );
    }

    await this.prodResultRepository.delete({
      resultNo,
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    });

    return { resultNo };
  }

  /**
   * 생산실적 완료 (트랜잭션: 실적 완료 + 금형 타수 + 설비 해제 원자성 보장)
   */
  async complete(resultNo: string, dto: CompleteProdResultDto, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${prodResult.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    await this.tx.run(async (queryRunner) => {
      // 1. 실적 상태 → DONE
      const updateData: Partial<Pick<ProdResult, 'status' | 'endAt' | 'goodQty' | 'defectQty' | 'remark'>> = {
        status: 'DONE',
        endAt: dto.endAt ? new Date(dto.endAt) : new Date(),
      };
      if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
      if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
      if (dto.remark) updateData.remark = dto.remark;

      await queryRunner.manager.update(
        ProdResult,
        {
          resultNo: prodResult.resultNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        updateData,
      );

      // 2. 금형 타수 자동 증가 (트랜잭션 내 — 실패 시 전체 롤백)
      if (prodResult.equipCode) {
        const totalQty = (dto.goodQty ?? prodResult.goodQty) + (dto.defectQty ?? prodResult.defectQty);
        if (totalQty > 0) {
          const mountedMolds = await queryRunner.manager.find(ConsumableMaster, {
            where: {
              mountedEquipCode: prodResult.equipCode,
              category: 'MOLD',
              operStatus: 'MOUNTED',
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });

          for (const mold of mountedMolds) {
            const newCount = mold.currentCount + totalQty;
            let newStatus = mold.status;

            if (mold.expectedLife && newCount >= mold.expectedLife) {
              newStatus = 'REPLACE';
            } else if (mold.warningCount && newCount >= mold.warningCount) {
              newStatus = 'WARNING';
            }

            await queryRunner.manager.update(
              ConsumableMaster,
              {
                consumableCode: mold.consumableCode,
                ...(company ? { company } : {}),
                ...(plant ? { plant } : {}),
              },
              {
                currentCount: newCount,
                status: newStatus,
              },
            );

            this.logger.log(
              `금형 타수 자동 증가: ${mold.consumableCode} (${mold.currentCount} → ${newCount})`,
            );
          }
        }

        // 3. 설비의 현재 작업지시번호 해제
        await queryRunner.manager.update(
          EquipMaster,
          {
            equipCode: prodResult.equipCode,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          { currentJobOrderId: null },
        );
        this.logger.log(`설비 작업지시 해제: ${prodResult.equipCode}`);
      }

      // 4. BOM 기반 자재 자동차감 (ON_COMPLETE)
      const autoTotalQty = (dto.goodQty ?? prodResult.goodQty) + (dto.defectQty ?? prodResult.defectQty);
      if (autoTotalQty > 0) {
        const autoResult = await this.autoIssueService.execute(
          'ON_COMPLETE', prodResult.resultNo, prodResult.orderNo, autoTotalQty, queryRunner,
        );
        if (autoResult.warnings.length > 0) {
          this.logger.warn(`자동차감 경고: ${autoResult.warnings.join(', ')}`);
        }
      }

      // 4-2. 매핑 소모품 롯트 사용횟수 누적 (재고 차감/수불 없음 — 수명 관리용)
      //      모델(작업지시 품목)+설비 매핑(CONSUMABLE_USAGE_MAP)으로 대상 소모품을 찾고,
      //      그 설비에 장착(MOUNTED)된 롯트(conUid)의 CURRENT_COUNT를 USAGE_PER_UNIT × 생산수량만큼 누적.
      if (prodResult.equipCode && autoTotalQty > 0) {
        const consumJobOrder = await queryRunner.manager.findOne(JobOrder, {
          where: {
            orderNo: prodResult.orderNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });
        if (consumJobOrder?.itemCode) {
          const consumMaps = await queryRunner.manager.find(ConsumableUsageMap, {
            where: {
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
              productItemCode: consumJobOrder.itemCode,
              equipCode: prodResult.equipCode,
              useYn: 'Y',
            },
          });
          for (const cmap of consumMaps) {
            const lots = await queryRunner.manager.find(ConsumableStock, {
              where: {
                consumableCode: cmap.consumableCode,
                mountedEquipCode: prodResult.equipCode,
                status: 'MOUNTED',
                ...(company ? { company } : {}),
                ...(plant ? { plantCd: plant } : {}),
              },
            });
            for (const lot of lots) {
              const newCount = lot.currentCount + cmap.usagePerUnit * autoTotalQty;
              await queryRunner.manager.update(
                ConsumableStock,
                { conUid: lot.conUid },
                { currentCount: newCount },
              );
              this.logger.log(
                `소모품 롯트 사용횟수 누적: ${lot.conUid} (${lot.currentCount} → ${newCount})`,
              );
            }
          }
        }
      }

      // 5. 공정창고(WIP_MAIN) 자동 적재 — 양품만 재고화
      const goodQty = dto.goodQty ?? prodResult.goodQty;
      if (goodQty > 0) {
        const jobOrder = await queryRunner.manager.findOne(JobOrder, {
          where: {
            orderNo: prodResult.orderNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          relations: ['part'],
        });

        if (jobOrder?.itemCode) {
          const itemType = jobOrder.part?.itemType === 'FINISHED' ? 'FINISHED' : 'SEMI_PRODUCT';
          await this.productInventoryService.receiveStockInTx(queryRunner, {
            warehouseId: 'WIP_MAIN',
            itemCode: jobOrder.itemCode,
            itemType,
            prdUid: prodResult.prdUid || undefined,
            qty: goodQty,
            transType: 'WIP_IN',
            orderNo: prodResult.orderNo,
            processCode: prodResult.processCode || undefined,
            refType: 'PROD_RESULT',
            refId: prodResult.resultNo,
            remark: `생산실적 완료 자동 적재`,
            company: jobOrder.company,
            plant: jobOrder.plant,
          });
          this.logger.log(
            `공정재고 자동 적재: ${jobOrder.itemCode} × ${goodQty} → WIP_MAIN (실적 #${prodResult.resultNo})`,
          );
        }
      }

      // 6. 작업지시 자동 완료 체크
      // 해당 작업지시의 모든 실적이 DONE이고 계획수량 달성 시 자동 완료
      const autoCompleteJobOrder = await queryRunner.manager.findOne(JobOrder, {
        where: {
          orderNo: prodResult.orderNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (autoCompleteJobOrder && !['DONE', 'CANCELED'].includes(autoCompleteJobOrder.status)) {
        const pendingResults = await queryRunner.manager.count(ProdResult, {
          where: {
            orderNo: prodResult.orderNo,
            status: In(['RUNNING', 'WAITING']),
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });

        if (pendingResults === 0) {
          const summaryQb = queryRunner.manager
            .createQueryBuilder(ProdResult, 'pr')
            .select('SUM(pr.goodQty)', 'totalGoodQty')
            .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
            .where('pr.orderNo = :orderNo AND pr.status = :status', {
              orderNo: prodResult.orderNo,
              status: 'DONE',
            });
          if (company) {
            summaryQb.andWhere('pr.company = :company', { company });
          }
          if (plant) {
            summaryQb.andWhere('pr.plant = :plant', { plant });
          }
          const summary = await summaryQb.getRawOne();

          const totalGood = parseInt(summary?.totalGoodQty) || 0;
          const totalDefect = parseInt(summary?.totalDefectQty) || 0;

          if (totalGood >= autoCompleteJobOrder.planQty) {
            await queryRunner.manager.update(
              JobOrder,
              {
                orderNo: prodResult.orderNo,
                ...(company ? { company } : {}),
                ...(plant ? { plant } : {}),
              },
              {
                status: 'DONE',
                endAt: new Date(),
                goodQty: totalGood,
                defectQty: totalDefect,
              },
            );
            this.logger.log(`작업지시 자동 완료: ${prodResult.orderNo} (양품 ${totalGood} >= 계획 ${autoCompleteJobOrder.planQty})`);
          }
        }
      }
    });

    return this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder'],
      select: {
        resultNo: true,
        orderNo: true,
        equipCode: true,
        workerId: true,
        prdUid: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 취소 (트랜잭션: 실적 취소 + 설비 해제 원자성 보장)
   */
  async cancel(resultNo: string, remark?: string, company?: string, plant?: string) {
    const prodResult = await this.findById(resultNo, company, plant);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException(`이미 취소된 실적입니다.`);
    }

    await this.ensureNoDownstreamProgress(prodResult, company, plant);

    await this.tx.run(async (queryRunner) => {
      const updateData: Partial<Pick<ProdResult, 'status' | 'remark'>> = { status: 'CANCELED' };
      if (remark) updateData.remark = remark;

      await queryRunner.manager.update(
        ProdResult,
        { resultNo: prodResult.resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        updateData,
      );

      // 설비의 현재 작업지시번호 해제
      if (prodResult.equipCode) {
        await queryRunner.manager.update(
          EquipMaster,
          { equipCode: prodResult.equipCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
          { currentJobOrderId: null },
        );
        this.logger.log(`설비 작업지시 해제 (취소): ${prodResult.equipCode}`);
      }

      // PROD_AUTO 자동차감 역분개
      await this.reverseAutoIssue(queryRunner, prodResult.resultNo, company, plant);

      // 공정재고 자동 적재 역분개 — PROD_RESULT 참조 트랜잭션 찾아서 취소
      await this.reverseProductStock(queryRunner, prodResult.resultNo, company, plant);
    });

    return this.prodResultRepository.findOne({
      where: { resultNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
  }

  /**
   * PROD_AUTO 자동차감 역분개
   * - 해당 실적의 PROD_AUTO MatIssue를 모두 찾아 CANCELED 처리
   * - MatStock.qty 복원, 역방향 StockTransaction 생성
   */
  /**
   * ???? ??? ????? ?? ???? ??, ? ???? ????? ????.
   */
  private async ensureNoDownstreamProgress(prodResult: ProdResult, company?: string, plant?: string): Promise<void> {
    if (!prodResult.prdUid) return;

    const { FgLabel } = await import('../../../entities/fg-label.entity');
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);
    const fgLabel = await fgLabelRepo.findOne({
      where: {
        fgBarcode: prodResult.prdUid,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });

    if (!fgLabel || !['PACKED', 'SHIPPED'].includes(fgLabel.status)) {
      return;
    }

    const { BoxMaster } = await import('../../../entities/box-master.entity');
    const { PalletMaster } = await import('../../../entities/pallet-master.entity');
    const { ShipmentLog } = await import('../../../entities/shipment-log.entity');

    const boxRepo = this.dataSource.getRepository(BoxMaster);
    const palletRepo = this.dataSource.getRepository(PalletMaster);
    const shipmentRepo = this.dataSource.getRepository(ShipmentLog);

    const box = await boxRepo
      .createQueryBuilder('box')
      .where('box.serialList LIKE :serial', { serial: `%${prodResult.prdUid}%` })
      .andWhere(company ? 'box.company = :company' : '1=1', { company })
      .andWhere(plant ? 'box.plant = :plant' : '1=1', { plant })
      .orderBy('box.createdAt', 'DESC')
      .getOne();

    const pallet = box?.palletNo
      ? await palletRepo.findOne({
          where: {
            palletNo: box.palletNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : null;

    const shipment = pallet?.shipmentId
      ? await shipmentRepo.findOne({
          where: {
            shipNo: pallet.shipmentId,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : null;

    const details = [
      `FG 라벨: ${prodResult.prdUid}`,
      box ? `박스: ${box.boxNo}` : null,
      box?.oqcStatus ? `OQC: ${box.oqcStatus}` : null,
      pallet ? `팔레트: ${pallet.palletNo}` : null,
      shipment ? `출하: ${shipment.shipNo}` : null,
    ].filter(Boolean).join(', ');

    throw new BadRequestException(
      `이미 후공정이 진행된 생산실적입니다. ${details}. 출하 -> 팔레트 -> 박스/OQC -> FG 라벨 순서로 역처리 후 다시 취소해 주세요.`,
    );
  }

  private async reverseAutoIssue(
    qr: import('typeorm').QueryRunner,
    resultNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    /* ── 경로 ① 공정소비(R5) 역분개 ─────────────────────────────
     * equipCode 작업지시는 공정재고(WIP_MAT_STOCKS)에서 PROD_CONSUME으로 소비됐고
     * 그 기록은 WIP_MAT_TRANSACTIONS에만 존재한다(MatIssue 없음).
     * restoreInTx가 (PROD_RESULT, resultNo, PROD_CONSUME, DONE) 원본을 찾아
     * WIP_MAT_STOCKS 가산 + PROD_CONSUME_CANCEL 기록. 원본이 없으면 no-op.
     * WIP 재고는 (company,plant) 스코프가 필수이므로 둘 다 있을 때만 복원한다. */
    if (company && plant) {
      await this.wipMatStockService.restoreInTx(qr, {
        mode: 'ADD_BACK',
        refType: 'PROD_RESULT',
        refId: resultNo,
        cancelTransType: 'PROD_CONSUME_CANCEL',
        originTransType: 'PROD_CONSUME',
        company,
        plant,
      });
    } else {
      this.logger.warn(
        `공정소비 역분개 생략 — company/plant 미지정: resultNo=${resultNo}`,
      );
    }

    /* ── 경로 ② 설비 미배정 fallback 단순소비 역분개 ────────────────
     * MatIssue(PROD_AUTO) + STOCK_TRANSACTIONS(MAT_OUT)로 소비된 건만 처리.
     * equipCode 경로는 MatIssue가 없으므로 여기서 발견되지 않아 서로 간섭 없음. */
    const issues = await qr.manager.find(MatIssue, {
      where: {
        prodResultNo: resultNo,
        issueType: 'PROD_AUTO',
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });

    if (issues.length === 0) return;

    for (const issue of issues) {
      await qr.manager.update(
        MatIssue,
        { issueNo: issue.issueNo, seq: issue.seq, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { status: 'CANCELED' },
      );

      if (!issue.matUid || issue.issueQty <= 0) {
        continue;
      }

      const lot = await qr.manager.findOne(MatLot, {
        where: { matUid: issue.matUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });

      const originalTransactions = await qr.manager.find(StockTransaction, {
        where: {
          refType: 'MAT_ISSUE',
          refId: `${issue.issueNo}-${issue.seq}`,
          status: 'DONE',
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (originalTransactions.length > 0) {
        for (const originalTx of originalTransactions) {
          const restoreQty = Math.abs(Number(originalTx.qty) || 0);
          if (restoreQty <= 0 || !originalTx.fromWarehouseId) continue;
          this.assertTenantConsistency('자재 자동투입 역분개', {
            expected: { company, plant },
            sources: [
              { label: 'issue', company: issue.company, plant: issue.plant },
              { label: 'lot', company: lot?.company, plant: lot?.plant },
              { label: 'originalTx', company: originalTx.company, plant: originalTx.plant },
            ],
          });

          const stock = await qr.manager.findOne(MatStock, {
            where: {
              warehouseCode: originalTx.fromWarehouseId,
              itemCode: originalTx.itemCode,
              matUid: issue.matUid,
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });

          if (stock) {
            await qr.manager.update(
              MatStock,
              {
                warehouseCode: stock.warehouseCode,
                itemCode: stock.itemCode,
                matUid: stock.matUid,
                ...(company ? { company } : {}),
                ...(plant ? { plant } : {}),
              },
              {
                qty: stock.qty + restoreQty,
                availableQty: stock.availableQty + restoreQty,
              },
            );
          }

          await qr.manager.update(
            StockTransaction,
            { transNo: originalTx.transNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
            { status: 'CANCELED' },
          );

          /* 역분개 거래유형은 원본 소비 거래유형 기준으로 분기한다.
           * - PROD_CONSUME(공정 소비)  → PROD_CONSUME_CANCEL (공정창고 복원)
           * - MAT_OUT(설비 미배정 fallback 소비) → MAT_IN (원자재창고 복원)
           * 복원 대상 창고는 두 경우 모두 원본 fromWarehouseId(소비 창고)이다. */
          const reverseTransType =
            originalTx.transType === 'PROD_CONSUME' ? 'PROD_CONSUME_CANCEL' : 'MAT_IN';

          const reverseTransNo = await this.numbering.nextInTx(qr, 'STOCK_TX');
          const reverseTx = qr.manager.create(StockTransaction, {
            transNo: reverseTransNo,
            transType: reverseTransType,
            transDate: new Date(),
            toWarehouseId: originalTx.fromWarehouseId,
            itemCode: originalTx.itemCode || lot?.itemCode || '',
            matUid: issue.matUid,
            qty: restoreQty,
            refType: 'MAT_ISSUE_CANCEL',
            refId: `${issue.issueNo}-${issue.seq}`,
            cancelRefId: originalTx.transNo,
            status: 'DONE',
            company: originalTx.company ?? lot?.company ?? issue.company,
            plant: originalTx.plant ?? lot?.plant ?? issue.plant,
          });
          await qr.manager.save(StockTransaction, reverseTx);
        }

        continue;
      }

      this.assertTenantConsistency('자재 자동투입 역분개', {
        expected: { company, plant },
        sources: [
          { label: 'issue', company: issue.company, plant: issue.plant },
          { label: 'lot', company: lot?.company, plant: lot?.plant },
        ],
      });

      const fallbackStock = await qr.manager.findOne(MatStock, {
        where: { matUid: issue.matUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });

      if (fallbackStock) {
        await qr.manager.update(
          MatStock,
          {
            warehouseCode: fallbackStock.warehouseCode,
            itemCode: fallbackStock.itemCode,
            matUid: fallbackStock.matUid,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          {
            qty: fallbackStock.qty + issue.issueQty,
            availableQty: fallbackStock.availableQty + issue.issueQty,
          },
        );
      }

      const reverseTransNo = await this.numbering.nextInTx(qr, 'STOCK_TX');
      const reverseTx = qr.manager.create(StockTransaction, {
        transNo: reverseTransNo,
        transType: 'MAT_IN',
        transDate: new Date(),
        toWarehouseId: fallbackStock?.warehouseCode,
        itemCode: lot?.itemCode ?? fallbackStock?.itemCode ?? '',
        matUid: issue.matUid,
        qty: issue.issueQty,
        refType: 'MAT_ISSUE_CANCEL',
        refId: `${issue.issueNo}-${issue.seq}`,
        status: 'DONE',
        company: lot?.company ?? issue.company,
        plant: lot?.plant ?? issue.plant,
      });
      await qr.manager.save(StockTransaction, reverseTx);
    }

    this.logger.log(`???? ??? ?? - resultNo: ${resultNo}, ${issues.length}?`);
  }

  private assertTenantConsistency(
    context: string,
    data: {
      expected?: { company?: string; plant?: string };
      sources: { label: string; company?: string | null; plant?: string | null }[];
    },
  ): void {
    this.assertSameTenantValue(context, 'company', data.expected?.company, data.sources);
    this.assertSameTenantValue(context, 'plant', data.expected?.plant, data.sources);
  }

  private assertSameTenantValue(
    context: string,
    field: 'company' | 'plant',
    expected: string | undefined,
    sources: { label: string; company?: string | null; plant?: string | null }[],
  ): void {
    if (expected) {
      const mismatch = sources.find((source) => source[field] !== expected);
      if (mismatch) {
        const details = sources.map((source) => `${source.label}=${source[field] ?? '-'}`).join(', ');
        throw new BadRequestException(
          `${context} ${field} 값이 일치하지 않습니다. expected=${expected}, ${details}`,
        );
      }
      return;
    }

    const values = sources
      .map((source) => ({ label: source.label, value: source[field] }))
      .filter((source): source is { label: string; value: string } => Boolean(source.value));
    const baseline = expected ?? values[0]?.value;
    const mismatch = values.find((source) => baseline && source.value !== baseline);

    if (mismatch) {
      const details = values.map((source) => `${source.label}=${source.value}`).join(', ');
      throw new BadRequestException(
        `${context} ${field} 값이 일치하지 않습니다. expected=${baseline ?? '-'}, ${details}`,
      );
    }
  }

  private async reverseProductStock(
    qr: import('typeorm').QueryRunner,
    resultNo: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    const { ProductTransaction } = await import('../../../entities/product-transaction.entity');
    const { ProductStock } = await import('../../../entities/product-stock.entity');

    const transactions = await qr.manager.find(ProductTransaction, {
      where: {
        refType: 'PROD_RESULT',
        refId: resultNo,
        status: 'DONE',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });

    if (transactions.length === 0) return;

    for (const tx of transactions) {
      this.assertTenantConsistency('제품 재고 역분개', {
        expected: { company, plant },
        sources: [
          { label: 'productTx', company: tx.company, plant: tx.plant },
        ],
      });

      // (a) 원본 트랜잭션 → CANCELED
      await qr.manager.update(
        ProductTransaction,
        { transNo: tx.transNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { status: 'CANCELED' },
      );

      // (b) 재고 차감 (입고 취소이므로 toWarehouseId에서 감소)
      if (tx.toWarehouseId && tx.qty > 0) {
        const stock = await qr.manager.findOne(ProductStock, {
          where: {
            warehouseCode: tx.toWarehouseId,
            itemCode: tx.itemCode,
            ...(tx.prdUid ? { prdUid: tx.prdUid } : {}),
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });

        if (stock) {
          this.assertTenantConsistency('제품 재고 역분개', {
            expected: { company, plant },
            sources: [
              { label: 'productTx', company: tx.company, plant: tx.plant },
              { label: 'productStock', company: stock.company, plant: stock.plant },
            ],
          });
          const newQty = Math.max(stock.qty - tx.qty, 0);
          await qr.manager.update(ProductStock,
            {
              warehouseCode: stock.warehouseCode,
              itemCode: stock.itemCode,
              prdUid: stock.prdUid,
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
            { qty: newQty, availableQty: Math.max(newQty - stock.reservedQty, 0) },
          );
        }
      }

      // (c) 취소 트랜잭션 생성 (역분개)
      const cancelTx = qr.manager.create(ProductTransaction, {
        transNo: `${tx.transNo}_C`,
        transType: 'WIP_IN_CANCEL',
        transDate: new Date(),
        fromWarehouseId: tx.toWarehouseId,
        itemCode: tx.itemCode,
        itemType: tx.itemType,
        prdUid: tx.prdUid,
        orderNo: tx.orderNo,
        processCode: tx.processCode,
        qty: -tx.qty,
        refType: 'PROD_RESULT_CANCEL',
        refId: resultNo,
        cancelRefId: tx.transNo,
        remark: `생산실적 취소 역분개`,
        status: 'DONE',
        company: tx.company,
        plant: tx.plant,
      });
      await qr.manager.save(ProductTransaction, cancelTx);
    }

    this.logger.log(`공정재고 역분개 완료 — resultNo: ${resultNo}, ${transactions.length}건`);
  }

  // ===== 실적 집계 =====

  /**
   * 작업지시별 실적 집계
   */
  async getSummaryByJobOrder(orderNo: string, company?: string, plant?: string) {
    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere('pr.status != :status', { status: 'CANCELED' });
    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });
    const summary = await qb.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      orderNo,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 설비별 실적 집계
   */
  async getSummaryByEquip(equipCode: string, dateFrom?: string, dateTo?: string, company?: string, plant?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.equipCode = :equipCode', { equipCode })
      .andWhere('pr.status != :status', { status: 'CANCELED' });
    if (company) queryBuilder.andWhere('pr.company = :company', { company });
    if (plant) queryBuilder.andWhere('pr.plant = :plant', { plant });

    if (dateFrom) queryBuilder.andWhere("pr.startAt >= TO_DATE(:dateFrom, 'YYYY-MM-DD')", { dateFrom });
    if (dateTo) queryBuilder.andWhere("pr.startAt < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { dateTo });

    const summary = await queryBuilder.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      equipCode,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 작업자별 실적 집계
   */
  async getSummaryByWorker(workerId: string, dateFrom?: string, dateTo?: string, company?: string, plant?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.workerId = :workerId', { workerId })
      .andWhere('pr.status != :status', { status: 'CANCELED' });
    if (company) queryBuilder.andWhere('pr.company = :company', { company });
    if (plant) queryBuilder.andWhere('pr.plant = :plant', { plant });

    if (dateFrom) queryBuilder.andWhere("pr.startAt >= TO_DATE(:dateFrom, 'YYYY-MM-DD')", { dateFrom });
    if (dateTo) queryBuilder.andWhere("pr.startAt < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { dateTo });

    const summary = await queryBuilder.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      workerId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 일자별 실적 집계 (대시보드용)
   */
  async getDailySummary(dateFrom: string, dateTo: string, company?: string, plant?: string) {
    const dailyQb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select(['pr.startAt', 'pr.goodQty', 'pr.defectQty'])
      .where('pr.status != :canceled', { canceled: 'CANCELED' })
      .andWhere("pr.startAt >= TO_DATE(:dateFrom, 'YYYY-MM-DD')", { dateFrom })
      .andWhere("pr.startAt < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { dateTo });
    if (company) dailyQb.andWhere('pr.company = :company', { company });
    if (plant) dailyQb.andWhere('pr.plant = :plant', { plant });
    const results = await dailyQb.getMany();

    // 일자별 그룹핑
    const dailyMap = new Map<string, { goodQty: number; defectQty: number; count: number }>();

    results.forEach((r) => {
      if (r.startAt) {
        const dateKey = r.startAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { goodQty: 0, defectQty: 0, count: 0 };
        current.goodQty += r.goodQty;
        current.defectQty += r.defectQty;
        current.count += 1;
        dailyMap.set(dateKey, current);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        goodQty: data.goodQty,
        defectQty: data.defectQty,
        totalQty: data.goodQty + data.defectQty,
        defectRate:
          data.goodQty + data.defectQty > 0
            ? (data.defectQty / (data.goodQty + data.defectQty)) * 100
            : 0,
        resultCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 완제품 기준 생산실적 통합 조회
   * - 품목별로 계획수량, 양품, 불량, 양품률을 집계
   */
  async getSummaryByProduct(dateFrom?: string, dateTo?: string, search?: string, company?: string, plant?: string) {
    // 날짜 범위가 없으면 당일 기준 (전량 집계 방지)
    const effectiveDateFrom = dateFrom || new Date().toISOString().substring(0, 10);
    const effectiveDateTo = dateTo || effectiveDateFrom;

    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .leftJoin('pr.jobOrder', 'jo')
      .leftJoin('jo.part', 'p')
      .select([
        'p.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'p.itemType AS "itemType"',
        'SUM(jo.planQty) AS "totalPlanQty"',
        'SUM(pr.goodQty) AS "totalGoodQty"',
        'SUM(pr.defectQty) AS "totalDefectQty"',
        'COUNT(DISTINCT jo.orderNo) AS "orderCount"',
        'COUNT(pr.resultNo) AS "resultCount"',
      ])
      .where('pr.status != :status', { status: 'CANCELED' })
      .andWhere("pr.startAt >= TO_DATE(:dateFrom, 'YYYY-MM-DD')", { dateFrom: effectiveDateFrom })
      .andWhere("pr.startAt < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { dateTo: effectiveDateTo })
      .groupBy('p.itemCode')
      .addGroupBy('p.itemName')
      .addGroupBy('p.itemType')
      .orderBy('"totalGoodQty"', 'DESC');
    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });
    if (search) {
      qb.andWhere(
        '(p.itemCode LIKE :search OR p.itemName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const raw = await qb.getRawMany();

    return raw.map((r) => {
      const totalGoodQty = parseInt(r.totalGoodQty) || 0;
      const totalDefectQty = parseInt(r.totalDefectQty) || 0;
      const totalQty = totalGoodQty + totalDefectQty;
      const totalPlanQty = parseInt(r.totalPlanQty) || 0;
      return {
        itemCode: r.itemCode,
        itemName: r.itemName,
        itemType: r.itemType,
        totalPlanQty,
        totalGoodQty,
        totalDefectQty,
        totalQty,
        defectRate: totalQty > 0 ? Math.round((totalDefectQty / totalQty) * 1000) / 10 : 0,
        yieldRate: totalQty > 0 ? Math.round((totalGoodQty / totalQty) * 1000) / 10 : 0,
        achieveRate: totalPlanQty > 0 ? Math.round((totalGoodQty / totalPlanQty) * 1000) / 10 : 0,
        orderCount: parseInt(r.orderCount) || 0,
        resultCount: parseInt(r.resultCount) || 0,
      };
    });
  }
}
