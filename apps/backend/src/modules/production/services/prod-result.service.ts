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
import { Repository, Between, ILike, Not, In, DataSource } from 'typeorm';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import {
  CreateProdResultDto,
  UpdateProdResultDto,
  ProdResultQueryDto,
  CompleteProdResultDto,
} from '../dto/prod-result.dto';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { FgLabel } from '../../../entities/fg-label.entity';
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
    private readonly dataSource: DataSource,
    private readonly autoIssueService: AutoIssueService,
    private readonly productInventoryService: ProductInventoryService,
    private readonly numRuleService: NumRuleService,
    private readonly seqGenerator: SeqGeneratorService,
    private readonly sysConfigService: SysConfigService,
    @InjectRepository(ShiftPattern)
    private readonly shiftPatternRepo: Repository<ShiftPattern>,
  ) {
    this.shiftResolver = new ShiftResolver(this.shiftPatternRepo);
  }

  /**
   * 생산실적 목록 조회
   */
  async findAll(query: ProdResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
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

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(orderNo && { orderNo }),
      ...(equipCode && { equipCode }),
      ...(workerId && { workerId }),
      ...(prdUid && { prdUid: ILike(`%${prdUid}%`) }),
      ...(processCode && { processCode }),
      ...(status && { status }),
      ...(shiftCode && { shiftCode }),
      ...(startTimeFrom || startTimeTo
        ? {
            startAt: Between(
              startTimeFrom ? new Date(startTimeFrom) : new Date('1900-01-01'),
              startTimeTo ? new Date(startTimeTo) : new Date('2099-12-31'),
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prodResultRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
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
      }),
      this.prodResultRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 생산실적 단건 조회 (resultNo)
   */
  async findById(resultNo: string) {
    const prodResult = await this.prodResultRepository.findOne({
      where: { resultNo },
      relations: ['jobOrder', 'jobOrder.part', 'equip', 'worker', 'inspectResults', 'defectLogs'],
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${resultNo}`);
    }

    // Filter inspectResults (only passYn = 'N') and limit to 10
    if (prodResult.inspectResults) {
      prodResult.inspectResults = prodResult.inspectResults
        .filter((r: any) => r.passYn === 'N')
        .slice(0, 10);
    }

    // Limit defectLogs to 10
    if (prodResult.defectLogs) {
      prodResult.defectLogs = prodResult.defectLogs.slice(0, 10);
    }

    // 자재 투입 이력 조회
    const matIssues = await this.findMatIssues(prodResult.resultNo);
    (prodResult as any).matIssues = matIssues;

    return prodResult;
  }

  /**
   * 생산실적의 자재 투입 이력 조회
   */
  async findMatIssues(resultNo: string) {
    const issues = await this.matIssueRepository.find({
      where: { prodResult: { resultNo }, status: 'DONE' },
      order: { issueDate: 'DESC' },
    });

    // LOT 및 품목 정보 추가
    const matUids = issues.map(i => i.matUid).filter(Boolean);
    const lots = matUids.length > 0
      ? await this.dataSource.getRepository('MatLot').find({ where: { matUid: In(matUids) } })
      : [];
    const lotMap = new Map(lots.map((l: any) => [l.matUid, l]));

    const itemCodes = lots.map((l: any) => l.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    return issues.map(issue => {
      const lot = lotMap.get(issue.matUid);
      const part = lot ? partMap.get(lot.itemCode) : null;
      return {
        ...issue,
        matUid: lot?.matUid,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
      };
    });
  }

  /**
   * 작업지시별 생산실적 목록 조회
   */
  async findByJobOrderId(orderNo: string) {
    return this.prodResultRepository.find({
      where: { orderNo },
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
  private async checkEquipBomInterlock(equipCode: string | null | undefined, orderNo: string): Promise<void> {
    if (!equipCode) return; // 설비 미지정 시 체크 불필요

    // 작업지시 품목 조회
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: orderNo },
      relations: ['part'],
    });
    if (!jobOrder?.part) return; // 품목 정보 없으면 체크 불필요

    const jobPartCode = jobOrder.part.itemCode;

    // 설비에 장착된 BOM 부품 조회
    const equipBomRels = await this.equipBomRelRepository.find({
      where: { equipCode, useYn: 'Y' },
    });
    if (equipBomRels.length === 0) return; // 설비 BOM 미설정 시 체크 불필요

    const bomItemCodes = equipBomRels.map(rel => rel.bomItemCode);
    const bomItems = await this.equipBomItemRepository.find({
      where: { bomItemCode: In(bomItemCodes), useYn: 'Y' },
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
  private async checkJobOrderQtyLimit(orderNo: string, newGoodQty: number, newDefectQty: number): Promise<void> {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: orderNo },
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
  async create(dto: CreateProdResultDto) {
    // 작업지시 존재 및 상태 확인
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
    }

    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시에는 실적을 등록할 수 없습니다.`);
    }
    if (jobOrder.status === 'HOLD') {
      throw new BadRequestException(`홀딩된 작업지시에는 실적을 등록할 수 없습니다.`);
    }

    // 작업지시 수량 초과 체크
    await this.checkJobOrderQtyLimit(dto.orderNo, dto.goodQty ?? 0, dto.defectQty ?? 0);

    // 설비부품 인터락 체크
    await this.checkEquipBomInterlock(dto.equipCode, dto.orderNo);

    // 설비 존재 확인 (옵션)
    if (dto.equipCode) {
      const equip = await this.equipMasterRepository.findOne({
        where: { equipCode: dto.equipCode },
      });
      if (!equip) {
        throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);
      }
    }

    // 작업자 존재 확인 (옵션) — workerId로 User 테이블 조회
    if (dto.workerId) {
      const worker = await this.userRepository.findOne({
        where: { email: dto.workerId },
      });
      if (!worker) {
        throw new NotFoundException(`작업자를 찾을 수 없습니다: ${dto.workerId}`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedResultNo: string;
    try {
      const resultNo = await this.seqGenerator.getNo('PROD_RESULT', queryRunner);
      const prodResult = queryRunner.manager.create(ProdResult, {
        resultNo,
        orderNo: dto.orderNo,
        equipCode: dto.equipCode,
        workerId: dto.workerId ?? null,
        prdUid: dto.prdUid,
        processCode: dto.processCode,
        goodQty: dto.goodQty ?? 0,
        defectQty: dto.defectQty ?? 0,
        startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        cycleTime: dto.cycleTime,
        status: 'RUNNING',
        remark: dto.remark,
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

      // FG 바코드 사전 발행 (ON_PRODUCTION 모드)
      const fgTiming = await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING');
      if (fgTiming === 'ON_PRODUCTION') {
        const fgJobOrder = await queryRunner.manager.findOne(JobOrder, { where: { orderNo: dto.orderNo } });
        if (fgJobOrder) {
          const fgBarcode = await this.seqGenerator.nextFgBarcode(queryRunner);
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
          await queryRunner.manager.update(ProdResult, savedResultNo, { prdUid: fgBarcode });
        }
      }

      // BOM 기반 자재 자동차감 (ON_CREATE)
      const totalQty = (dto.goodQty ?? 0) + (dto.defectQty ?? 0);
      if (totalQty > 0) {
        const autoResult = await this.autoIssueService.execute(
          'ON_CREATE', saved.resultNo, dto.orderNo, totalQty, queryRunner,
        );
        if (autoResult.warnings.length > 0) {
          this.logger.warn(`자동차감 경고: ${autoResult.warnings.join(', ')}`);
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.prodResultRepository.findOne({
      where: { resultNo: savedResultNo },
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
  async update(resultNo: string, dto: UpdateProdResultDto) {
    const prodResult = await this.findById(resultNo);

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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updateData: any = {};
      if (dto.equipCode !== undefined) updateData.equipCode = dto.equipCode;
      if (dto.workerId !== undefined) updateData.workerId = dto.workerId ?? null;
      if (dto.prdUid !== undefined) updateData.prdUid = dto.prdUid;
      if (dto.processCode !== undefined) updateData.processCode = dto.processCode;
      if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
      if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
      if (dto.startAt !== undefined) updateData.startAt = new Date(dto.startAt);
      if (dto.endAt !== undefined) updateData.endAt = new Date(dto.endAt);
      if (dto.cycleTime !== undefined) updateData.cycleTime = dto.cycleTime;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.remark !== undefined) updateData.remark = dto.remark;

      await queryRunner.manager.update(ProdResult, prodResult.resultNo, updateData);

      // 수량 변경 시 자재 자동차감 재계산 (역분개 → 재차감)
      if (qtyChanged && prodResult.status !== 'DONE') {
        await this.reverseAutoIssue(queryRunner, resultNo);
        if (newTotalQty > 0) {
          await this.autoIssueService.execute(
            'ON_CREATE', resultNo, prodResult.orderNo, newTotalQty, queryRunner,
          );
        }
        this.logger.log(
          `실적 수량 변경 자동차감 재계산: ${resultNo} (${oldTotalQty} → ${newTotalQty})`,
        );
      }

      await queryRunner.commitTransaction();
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.prodResultRepository.findOne({
      where: { resultNo },
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
  async delete(resultNo: string) {
    await this.findById(resultNo); // 존재 확인

    await this.prodResultRepository.delete(resultNo);

    return { resultNo };
  }

  /**
   * 생산실적 완료 (트랜잭션: 실적 완료 + 금형 타수 + 설비 해제 원자성 보장)
   */
  async complete(resultNo: string, dto: CompleteProdResultDto) {
    const prodResult = await this.findById(resultNo);

    if (prodResult.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${prodResult.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 실적 상태 → DONE
      const updateData: any = {
        status: 'DONE',
        endAt: dto.endAt ? new Date(dto.endAt) : new Date(),
      };
      if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
      if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
      if (dto.remark) updateData.remark = dto.remark;

      await queryRunner.manager.update(ProdResult, prodResult.resultNo, updateData);

      // 2. 금형 타수 자동 증가 (트랜잭션 내 — 실패 시 전체 롤백)
      if (prodResult.equipCode) {
        const totalQty = (dto.goodQty ?? prodResult.goodQty) + (dto.defectQty ?? prodResult.defectQty);
        if (totalQty > 0) {
          const mountedMolds = await queryRunner.manager.find(ConsumableMaster, {
            where: {
              mountedEquipCode: prodResult.equipCode,
              category: 'MOLD',
              operStatus: 'MOUNTED',
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

            await queryRunner.manager.update(ConsumableMaster, { consumableCode: mold.consumableCode }, {
              currentCount: newCount,
              status: newStatus,
            });

            this.logger.log(
              `금형 타수 자동 증가: ${mold.consumableCode} (${mold.currentCount} → ${newCount})`,
            );
          }
        }

        // 3. 설비의 현재 작업지시번호 해제
        await queryRunner.manager.update(EquipMaster, { equipCode: prodResult.equipCode }, {
          currentJobOrderId: null,
        });
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

      // 5. 공정창고(WIP_MAIN) 자동 적재 — 양품만 재고화
      const goodQty = dto.goodQty ?? prodResult.goodQty;
      if (goodQty > 0) {
        const jobOrder = await queryRunner.manager.findOne(JobOrder, {
          where: { orderNo: prodResult.orderNo },
          relations: ['part'],
        });

        if (jobOrder?.itemCode) {
          const itemType = jobOrder.part?.itemType === 'FG' ? 'FG' : 'WIP';
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
          });
          this.logger.log(
            `공정재고 자동 적재: ${jobOrder.itemCode} × ${goodQty} → WIP_MAIN (실적 #${prodResult.resultNo})`,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.prodResultRepository.findOne({
      where: { resultNo },
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
  async cancel(resultNo: string, remark?: string) {
    const prodResult = await this.findById(resultNo);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException(`이미 취소된 실적입니다.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updateData: any = { status: 'CANCELED' };
      if (remark) updateData.remark = remark;

      await queryRunner.manager.update(ProdResult, prodResult.resultNo, updateData);

      // 설비의 현재 작업지시번호 해제
      if (prodResult.equipCode) {
        await queryRunner.manager.update(EquipMaster, { equipCode: prodResult.equipCode }, {
          currentJobOrderId: null,
        });
        this.logger.log(`설비 작업지시 해제 (취소): ${prodResult.equipCode}`);
      }

      // PROD_AUTO 자동차감 역분개
      await this.reverseAutoIssue(queryRunner, prodResult.resultNo);

      // 공정재고 자동 적재 역분개 — PROD_RESULT 참조 트랜잭션 찾아서 취소
      await this.reverseProductStock(queryRunner, prodResult.resultNo);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.prodResultRepository.findOne({
      where: { resultNo },
    });
  }

  /**
   * PROD_AUTO 자동차감 역분개
   * - 해당 실적의 PROD_AUTO MatIssue를 모두 찾아 CANCELED 처리
   * - MatStock.qty 복원, 역방향 StockTransaction 생성
   */
  private async reverseAutoIssue(
    qr: import('typeorm').QueryRunner,
    resultNo: string,
  ): Promise<void> {
    const issues = await qr.manager.find(MatIssue, {
      where: { prodResult: { resultNo }, issueType: 'PROD_AUTO', status: 'DONE' },
    });

    if (issues.length === 0) return;

    for (const issue of issues) {
      // (a) MatIssue → CANCELED
      await qr.manager.update(MatIssue, { issueNo: issue.issueNo, seq: issue.seq }, {
        status: 'CANCELED',
      });

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리
      if (issue.matUid && issue.issueQty > 0) {
        const lot = await qr.manager.findOne(MatLot, {
          where: { matUid: issue.matUid },
        });

        // (c) MatStock 복원
        const stocks = await qr.manager.find(MatStock, {
          where: { matUid: issue.matUid },
          lock: { mode: 'pessimistic_write' },
        });
        if (stocks.length > 0) {
          // 첫 번째 재고 레코드에 복원 (단순화)
          const stock = stocks[0];
          await qr.manager.update(
            MatStock,
            { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
            {
              qty: stock.qty + issue.issueQty,
              availableQty: stock.availableQty + issue.issueQty,
            },
          );
        }

        // (d) 역방향 StockTransaction 생성
        const reverseTransNo = await this.numRuleService.nextNumberInTx(qr, 'STOCK_TX');
        const reverseTx = qr.manager.create(StockTransaction, {
          transNo: reverseTransNo,
          transType: 'MAT_IN',
          itemCode: lot?.itemCode ?? '',
          matUid: issue.matUid,
          qty: issue.issueQty,
          refType: 'MAT_ISSUE_CANCEL',
          refId: issue.issueNo,
          status: 'DONE',
          company: lot?.company || issue.company,
          plant: lot?.plant || issue.plant,
        });
        await qr.manager.save(StockTransaction, reverseTx);
      }
    }

    this.logger.log(`자동차감 역분개 완료 — resultNo: ${resultNo}, ${issues.length}건`);
  }

  /**
   * 공정재고 자동 적재 역분개
   * - 해당 실적의 PROD_RESULT 참조 ProductTransaction(WIP_IN)을 찾아 취소
   * - ProductStock(WIP_MAIN) 재고 복원
   */
  private async reverseProductStock(
    qr: import('typeorm').QueryRunner,
    resultNo: string,
  ): Promise<void> {
    const { ProductTransaction } = await import('../../../entities/product-transaction.entity');
    const { ProductStock } = await import('../../../entities/product-stock.entity');

    const transactions = await qr.manager.find(ProductTransaction, {
      where: { refType: 'PROD_RESULT', refId: resultNo, status: 'DONE' },
    });

    if (transactions.length === 0) return;

    for (const tx of transactions) {
      // (a) 원본 트랜잭션 → CANCELED
      await qr.manager.update(ProductTransaction, { transNo: tx.transNo }, { status: 'CANCELED' });

      // (b) 재고 차감 (입고 취소이므로 toWarehouseId에서 감소)
      if (tx.toWarehouseId && tx.qty > 0) {
        const stock = await qr.manager.findOne(ProductStock, {
          where: { warehouseCode: tx.toWarehouseId, itemCode: tx.itemCode },
          lock: { mode: 'pessimistic_write' },
        });

        if (stock) {
          const newQty = Math.max(stock.qty - tx.qty, 0);
          await qr.manager.update(ProductStock,
            { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, prdUid: stock.prdUid },
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
  async getSummaryByJobOrder(orderNo: string) {
    const summary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere('pr.status != :status', { status: 'CANCELED' })
      .getRawOne();

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
  async getSummaryByEquip(equipCode: string, dateFrom?: string, dateTo?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.equipCode = :equipCode', { equipCode })
      .andWhere('pr.status != :status', { status: 'CANCELED' });

    if (dateFrom || dateTo) {
      queryBuilder.andWhere('pr.startAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
        dateTo: dateTo ? new Date(dateTo) : new Date('2099-12-31'),
      });
    }

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
  async getSummaryByWorker(workerId: string, dateFrom?: string, dateTo?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.workerId = :workerId', { workerId })
      .andWhere('pr.status != :status', { status: 'CANCELED' });

    if (dateFrom || dateTo) {
      queryBuilder.andWhere('pr.startAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
        dateTo: dateTo ? new Date(dateTo) : new Date('2099-12-31'),
      });
    }

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
  async getDailySummary(dateFrom: string, dateTo: string) {
    const results = await this.prodResultRepository.find({
      where: {
        status: Not('CANCELED'),
        startAt: Between(new Date(dateFrom), new Date(dateTo)),
      },
      select: {
        startAt: true,
        goodQty: true,
        defectQty: true,
      },
    });

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
  async getSummaryByProduct(dateFrom?: string, dateTo?: string, search?: string) {
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
        'COUNT(pr."RESULT_NO") AS "resultCount"',
      ])
      .where('pr.status != :status', { status: 'CANCELED' })
      .groupBy('p.itemCode')
      .addGroupBy('p.itemName')
      .addGroupBy('p.itemType')
      .orderBy('"totalGoodQty"', 'DESC');

    if (dateFrom) {
      qb.andWhere('pr.startAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      qb.andWhere('pr.startAt <= :dateTo', { dateTo: new Date(dateTo) });
    }
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
