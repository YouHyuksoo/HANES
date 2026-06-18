/**
 * @file src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts
 * @description 통전검사 서비스 - 검사 결과 등록 + FG_BARCODE 발행
 *
 * 초보자 가이드:
 * 1. 작업지시 선택 → 제품 1개씩 전수검사
 * 2. PASS → InspectResult 등록 + FG_BARCODE 채번 + FG_LABELS 등록
 * 3. FAIL → InspectResult 등록 (불량 기록)
 *
 * 주요 흐름:
 * - findJobOrders: 진행중/대기 작업지시 목록 (품목 정보 포함)
 * - inspect: 검사 등록 + 합격 시 FG_BARCODE 자동 발행 (트랜잭션)
 * - getStats: 작업지시별 검사 통계 (합격률 등)
 * - reprintLabel / voidLabel: 라벨 재인쇄 / 취소
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { EquipProtocol } from '../../../../entities/equip-protocol.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { TransactionService } from '../../../../shared/transaction.service';
import { SysConfigService } from '../../../system/services/sys-config.service';
import {
  ContinuityInspectDto,
  AutoInspectDto,
  CreateEquipProtocolDto,
  PreIssueDto,
  ReInspectDto,
  UpdateEquipProtocolDto,
} from '../dto/continuity-inspect.dto';

@Injectable()
export class ContinuityInspectService {
  private readonly logger = new Logger(ContinuityInspectService.name);

  constructor(
    @InjectRepository(InspectResult)
    private readonly inspectResultRepo: Repository<InspectResult>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepo: Repository<FgLabel>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(EquipProtocol)
    private readonly equipProtocolRepo: Repository<EquipProtocol>,
    @InjectRepository(ProdResult)
    private readonly prodResultRepo: Repository<ProdResult>,
    private readonly seqGenerator: SeqGeneratorService,
    private readonly sysConfigService: SysConfigService,
    private readonly tx: TransactionService,
  ) {}

  private async resolveProdResult(
    orderNo: string,
    prodResultNo?: string,
    fgBarcode?: string,
    company?: string,
    plant?: string,
  ): Promise<ProdResult | null> {
    if (prodResultNo) {
      return this.prodResultRepo.findOne({
        where: {
          resultNo: prodResultNo,
          orderNo,
          status: Not('CANCELED'),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
    }

    if (fgBarcode) {
      const barcodeMatched = await this.prodResultRepo.findOne({
        where: {
          orderNo,
          prdUid: fgBarcode,
          status: Not('CANCELED'),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        order: { createdAt: 'DESC' },
      });
      if (barcodeMatched) {
        return barcodeMatched;
      }
    }

    // 취소된 실적은 후보에서 제외한다 — 취소건이 섞여 후보가 2건이 되면 링크를 포기(null)하던 문제 방지.
    const candidates = await this.prodResultRepo.find({
      where: {
        orderNo,
        status: Not('CANCELED'),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 2,
    });

    return candidates.length === 1 ? candidates[0] : null;
  }

  /**
   * 작업지시 목록 조회 (상태: IN_PROGRESS 또는 WAITING)
   * 품목 정보(part) JOIN 포함
   */
  async findJobOrders(query: {
    company?: string;
    plant?: string;
    lineCode?: string;
    planDate?: string;
  }) {
    const qb = this.jobOrderRepo
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .where('jo.status IN (:...statuses)', {
        statuses: ['RUNNING', 'IN_PROGRESS', 'WAITING'],
      });

    if (query.company) {
      qb.andWhere('jo.company = :company', { company: query.company });
    }
    if (query.plant) {
      qb.andWhere('jo.plant = :plant', { plant: query.plant });
    }
    if (query.lineCode) {
      qb.andWhere('jo.lineCode = :lineCode', { lineCode: query.lineCode });
    }
    if (query.planDate) {
      qb.andWhere("jo.planDate >= TO_DATE(:planDateFrom, 'YYYY-MM-DD') AND jo.planDate < TO_DATE(:planDateTo, 'YYYY-MM-DD') + 1", {
        planDateFrom: query.planDate,
        planDateTo: query.planDate,
      });
    }

    qb.orderBy('jo.priority', 'ASC').addOrderBy('jo.planDate', 'ASC');

    return qb.getMany();
  }

  /**
   * FG_LABELS 전체 이력 조회 (페이지네이션 + 필터)
   */
  async findAllFgLabels(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.fgLabelRepo.createQueryBuilder('fg')
      .orderBy('fg.issuedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      qb.andWhere('(fg.fgBarcode LIKE :s OR fg.itemCode LIKE :s OR fg.orderNo LIKE :s)', { s: `%${query.search}%` });
    }
    if (query.status) {
      qb.andWhere('fg.status = :status', { status: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere("fg.issuedAt >= TO_DATE(:dateFrom, 'YYYY-MM-DD')", { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere("fg.issuedAt < TO_DATE(:dateTo, 'YYYY-MM-DD') + 1", { dateTo: query.dateTo });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * FG 바코드로 라벨 단건 조회 (바코드 스캔 시)
   */
  async findFgLabel(fgBarcode: string, company?: string, plant?: string) {
    const label = await this.fgLabelRepo.findOne({
      where: {
        fgBarcode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!label) {
      throw new NotFoundException(`FG 라벨을 찾을 수 없습니다: ${fgBarcode}`);
    }
    return label;
  }

  /**
   * FG 라벨 상태 변경 (ISSUED → VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED)
   */
  async updateFgLabelStatus(
    fgBarcode: string,
    status: string,
    company?: string,
    plant?: string,
  ) {
    const label = await this.fgLabelRepo.findOne({
      where: {
        fgBarcode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!label) {
      throw new NotFoundException(`FG 라벨을 찾을 수 없습니다: ${fgBarcode}`);
    }
    label.status = status;
    return this.fgLabelRepo.save(label);
  }

  /**
   * 작업지시별 발행된 FG_LABELS 목록 조회
   */
  async findFgLabelsByOrder(
    orderNo: string,
    company?: string,
    plant?: string,
    inspectType = 'CONTINUITY',
  ) {
    const qb = this.fgLabelRepo
      .createQueryBuilder('fg')
      .leftJoin(InspectResult, 'ir', 'ir.resultNo = fg.inspectResultId')
      .where('fg.orderNo = :orderNo', { orderNo })
      .orderBy('fg.issuedAt', 'DESC');

    if (company) {
      qb.andWhere('fg.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('fg.plant = :plant', { plant });
    }
    if (inspectType) {
      qb.andWhere('ir.inspectType = :inspectType', { inspectType });
    }

    const labels = await qb.getMany();

    /** 회로라벨은 INSPECT_RESULTS에 저장되므로 inspectResultId로 단일 조회 후 매핑(N+1 회피) */
    const inspectIds = labels
      .map((l) => l.inspectResultId)
      .filter((v): v is string => !!v);
    if (inspectIds.length === 0) {
      return labels.map((l) => ({ ...l, circuitLabel: null }));
    }
    const inspects = await this.inspectResultRepo.find({
      where: { resultNo: In(inspectIds) },
      select: ['resultNo', 'circuitLabel'],
    });
    const circuitMap = new Map(
      inspects.map((i) => [i.resultNo, i.circuitLabel ?? null]),
    );
    return labels.map((l) => ({
      ...l,
      circuitLabel: l.inspectResultId
        ? circuitMap.get(l.inspectResultId) ?? null
        : null,
    }));
  }

  /**
   * 통전검사 결과 등록 (트랜잭션)
   * - ON_INSPECT 모드: PASS → InspectResult + FG_BARCODE 채번 + FG_LABELS 등록
   * - ON_PRODUCTION/PRE_ISSUE 모드: PASS → dto.fgBarcode로 PENDING 라벨 조회 → ISSUED 전환
 * - FAIL: InspectResult 등록
   */
  async inspect(
    dto: ContinuityInspectDto,
    company?: string,
    plant?: string,
  ): Promise<{ inspectResult: InspectResult; fgBarcode: string | null }> {
    /** 0. 바코드 발행 타이밍 조회 */
    const timing = (await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING')) ?? 'ON_INSPECT';

    const result = await this.tx.run(async (queryRunner) => {
      /** 1. 작업지시 존재 확인 */
      const jobOrder = await queryRunner.manager.findOne(JobOrder, {
        where: {
          orderNo: dto.orderNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
      if (!jobOrder) {
        throw new NotFoundException(
          `작업지시를 찾을 수 없습니다: ${dto.orderNo}`,
        );
      }
      this.assertTenantMatches('통전검사 작업지시', { company, plant }, {
        label: 'jobOrder',
        company: jobOrder.company,
        plant: jobOrder.plant,
      });

      /** 1-2. 스캔 모드 합격 시 회로라벨 필수 + 중복 차단 */
      if (timing !== 'ON_INSPECT' && dto.passYn === 'Y') {
        if (!dto.circuitLabel) {
          throw new BadRequestException('합격 시 회로라벨 스캔이 필요합니다.');
        }
        const dupCount = await queryRunner.manager.count(InspectResult, {
          where: {
            circuitLabel: dto.circuitLabel,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });
        if (dupCount > 0) {
          throw new BadRequestException(
            `이미 사용된 회로라벨입니다: ${dto.circuitLabel}`,
          );
        }
      }

      /** 2. InspectResult 생성 */
      const prodResult = await this.resolveProdResult(
        dto.orderNo,
        dto.prodResultNo,
        dto.fgBarcode,
        company,
        plant,
      );

      const inspectResultNo = await this.seqGenerator.getNo('INSPECT_RESULT', queryRunner);

      const inspectResult = queryRunner.manager.create(InspectResult, {
        resultNo: inspectResultNo,
        prodResultNo: prodResult?.resultNo ?? null,
        inspectType: dto.inspectType ?? 'CONTINUITY',
        inspectScope: 'FULL',
        passYn: dto.passYn,
        errorCode: dto.errorCode ?? null,
        errorDetail: dto.errorDetail ?? null,
        circuitLabel: dto.circuitLabel ?? null,
        inspectorId: dto.workerId ?? null,
        equipCode: dto.equipCode ?? null,
        inspectAt: new Date(),
        company: company ?? jobOrder.company,
        plant: plant ?? jobOrder.plant,
      });
      const savedInspect = await queryRunner.manager.save(
        InspectResult,
        inspectResult,
      );

      let fgBarcode: string | null = null;

      if (dto.passYn === 'Y') {
        if (timing === 'ON_INSPECT') {
          /** ON_INSPECT: 기존 로직 — 합격 시 바코드 채번 + FG_LABELS 신규 등록 */

          /* 과발행 차단: 작업지시에 발행된 FG라벨(미폐기)이 생산 양품수를 넘지 못하게 한다.
           * 생산하지 않은 수량까지 합격·발행되어 실재고보다 많은 완제품 라벨이 생기는 것을 막는다. */
          const producedRow = await queryRunner.manager
            .createQueryBuilder(ProdResult, 'pr')
            .select('COALESCE(SUM(pr.goodQty), 0)', 'sum')
            .where('pr.orderNo = :orderNo', { orderNo: dto.orderNo })
            .andWhere("pr.status != 'CANCELED'")
            .andWhere(company ? 'pr.company = :company' : '1=1', company ? { company } : {})
            .andWhere(plant ? 'pr.plant = :plant' : '1=1', plant ? { plant } : {})
            .getRawOne();
          const producedGoodQty = Number(producedRow?.sum ?? 0);
          const issuedCount = await queryRunner.manager.count(FgLabel, {
            where: {
              orderNo: dto.orderNo,
              status: Not('VOIDED'),
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });
          if (issuedCount >= producedGoodQty) {
            throw new BadRequestException(
              `통전검사 합격 발행수가 생산 양품수를 초과할 수 없습니다. ` +
                `(작업지시 ${dto.orderNo}: 생산 양품 ${producedGoodQty}, 기발행 ${issuedCount})`,
            );
          }

          fgBarcode = await this.seqGenerator.nextFgBarcode(queryRunner);

          savedInspect.fgBarcode = fgBarcode;
          await queryRunner.manager.save(InspectResult, savedInspect);

          const fgLabel = queryRunner.manager.create(FgLabel, {
            fgBarcode,
            itemCode: dto.itemCode,
            orderNo: dto.orderNo,
            equipCode: dto.equipCode ?? null,
            workerId: dto.workerId ?? null,
            lineCode: dto.lineCode ?? null,
            status: 'ISSUED',
            inspectResultId: savedInspect.resultNo,
            inspectPassYn: 'Y',
            company: company ?? jobOrder.company,
            plant: plant ?? jobOrder.plant,
          });
          await queryRunner.manager.save(FgLabel, fgLabel);
        } else {
          /** ON_PRODUCTION / PRE_ISSUE: 스캔한 바코드로 PENDING 라벨 → ISSUED 전환 */
          if (!dto.fgBarcode) {
            throw new BadRequestException(
              `${timing} 모드에서는 fgBarcode(스캔값)가 필수입니다.`,
            );
          }
          fgBarcode = dto.fgBarcode;

          const pendingLabel = await queryRunner.manager.findOne(FgLabel, {
            where: {
              fgBarcode: dto.fgBarcode,
              status: 'PENDING',
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });
          if (!pendingLabel) {
            throw new NotFoundException(
              `PENDING 상태의 FG 라벨을 찾을 수 없습니다: ${dto.fgBarcode}`,
            );
          }

          pendingLabel.status = 'ISSUED';
          pendingLabel.inspectResultId = savedInspect.resultNo;
          pendingLabel.inspectPassYn = 'Y';
          pendingLabel.workerId = dto.workerId ?? pendingLabel.workerId;
          pendingLabel.equipCode = dto.equipCode ?? pendingLabel.equipCode;
          pendingLabel.lineCode = dto.lineCode ?? pendingLabel.lineCode;
          await queryRunner.manager.save(FgLabel, pendingLabel);

          savedInspect.fgBarcode = fgBarcode;
          await queryRunner.manager.save(InspectResult, savedInspect);
        }

        // prod-result.prdUid 는 실적 자신의 시리얼({orderNo}-NNN)로 유지한다(WIP_MAIN 재고 키와 일치).
        // 실적↔FG바코드(1:다)는 InspectResult.prodResultNo 링크로 추적하므로 prdUid 덮어쓰기는 하지 않는다.
        // (ON_PRODUCTION 모드는 create 시점에 prdUid=fgBarcode 로 이미 설정됨 — 별도 처리 불필요)

      } else {
        /** FAIL 처리 */
        if (timing !== 'ON_INSPECT' && dto.fgBarcode) {
          /** ON_PRODUCTION/PRE_ISSUE: 스캔된 PENDING 라벨에 불합격 기록 */
          const pendingLabel = await queryRunner.manager.findOne(FgLabel, {
            where: {
              fgBarcode: dto.fgBarcode,
              status: 'PENDING',
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });
          if (pendingLabel) {
            pendingLabel.inspectResultId = savedInspect.resultNo;
            pendingLabel.inspectPassYn = 'N';
            await queryRunner.manager.save(FgLabel, pendingLabel);
          }
        }

      }
      this.logger.log(
        `통전검사 완료: orderNo=${dto.orderNo}, pass=${dto.passYn}, fgBarcode=${fgBarcode}, timing=${timing}`,
      );

      return { inspectResult: savedInspect, fgBarcode };
    });
    return result;
  }

  private assertTenantMatches(
    context: string,
    expected: { company?: string; plant?: string },
    actual: { label: string; company?: string | null; plant?: string | null },
  ): void {
    if (expected.company && actual.company && expected.company !== actual.company) {
      throw new BadRequestException(
        `${context} 회사가 일치하지 않습니다. request=${expected.company}, ${actual.label}=${actual.company}`,
      );
    }
    if (expected.plant && actual.plant && expected.plant !== actual.plant) {
      throw new BadRequestException(
        `${context} 사업장이 일치하지 않습니다. request=${expected.plant}, ${actual.label}=${actual.plant}`,
      );
    }
  }

  /**
   * FG 바코드 사전발행 (PRE_ISSUE 모드)
   * 작업지시의 planQty에서 기발행수를 뺀 만큼 PENDING 상태 바코드를 생성한다.
   */
  async preIssue(
    dto: PreIssueDto,
    company?: string,
    plant?: string,
  ): Promise<{ issued: number; barcodes: string[] }> {
    const jobOrder = await this.jobOrderRepo.findOne({
      where: {
        orderNo: dto.orderNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
    }
    this.assertTenantMatches('FG 바코드 사전발행 작업지시', { company, plant }, {
      label: 'jobOrder',
      company: jobOrder.company,
      plant: jobOrder.plant,
    });

    const alreadyIssued = await this.fgLabelRepo.count({
      where: {
        orderNo: dto.orderNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const remaining = jobOrder.planQty - alreadyIssued;

    if (remaining <= 0) {
      throw new BadRequestException(
        `발행 가능 수량이 없습니다. (planQty=${jobOrder.planQty}, 기발행=${alreadyIssued})`,
      );
    }

    const qty = dto.qty ? Math.min(dto.qty, remaining) : remaining;

    const result = await this.tx.run(async (queryRunner) => {
      const barcodes: string[] = [];
      for (let i = 0; i < qty; i++) {
        const fgBarcode = await this.seqGenerator.nextFgBarcode(queryRunner);
        const fgLabel = queryRunner.manager.create(FgLabel, {
          fgBarcode,
          itemCode: jobOrder.itemCode,
          orderNo: dto.orderNo,
          status: 'PENDING',
          inspectPassYn: null,
          company: company ?? jobOrder.company,
          plant: plant ?? jobOrder.plant,
        });
        await queryRunner.manager.save(FgLabel, fgLabel);
        barcodes.push(fgBarcode);
      }

      this.logger.log(
        `FG 바코드 사전발행: orderNo=${dto.orderNo}, qty=${qty}`,
      );
      return { issued: qty, barcodes };
    });
    return result;
  }

  /**
   * 작업지시별 PENDING 상태 FG 라벨 목록 조회
   */
  async getPendingLabels(orderNo: string, company?: string, plant?: string) {
    return this.fgLabelRepo.find({
      where: {
        orderNo,
        status: 'PENDING',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { issuedAt: 'ASC' },
    });
  }

  /**
   * 재검사 — FAIL(inspectPassYn='N') 바코드 대상으로 재검사 결과 등록
   * PASS 전환 시 FG 라벨 상태를 복구
   */
  async reInspect(
    fgBarcode: string,
    dto: ReInspectDto,
    company?: string,
    plant?: string,
  ): Promise<{ inspectResult: InspectResult; fgLabel: FgLabel }> {
    const label = await this.fgLabelRepo.findOne({
      where: {
        fgBarcode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!label) {
      throw new NotFoundException(`FG 라벨을 찾을 수 없습니다: ${fgBarcode}`);
    }
    this.assertTenantMatches('통전 재검사 라벨', { company, plant }, {
      label: 'fgLabel',
      company: label.company,
      plant: label.plant,
    });
    if (label.inspectPassYn !== 'N') {
      throw new BadRequestException(
        '불합격(inspectPassYn=N) 바코드만 재검사할 수 있습니다.',
      );
    }

    const result = await this.tx.run(async (queryRunner) => {
      let prodResultNo: string | null = null;

      if (label.inspectResultId) {
        const previousInspect = await queryRunner.manager.findOne(InspectResult, {
          where: { resultNo: label.inspectResultId },
        });
        prodResultNo = previousInspect?.prodResultNo ?? null;
      }

      if (!prodResultNo && label.orderNo) {
        const prodResult = await this.resolveProdResult(
          label.orderNo,
          undefined,
          fgBarcode,
          company,
          plant,
        );
        prodResultNo = prodResult?.resultNo ?? null;
      }

      /** 새 InspectResult 생성 */
      const inspectResultNo = await this.seqGenerator.getNo('INSPECT_RESULT', queryRunner);
      const inspectResult = queryRunner.manager.create(InspectResult, {
        resultNo: inspectResultNo,
        prodResultNo,
        inspectType: 'CONTINUITY',
        inspectScope: 'RE_INSPECT',
        passYn: dto.passYn,
        errorCode: dto.errorCode ?? null,
        errorDetail: dto.remark ?? null,
        fgBarcode,
        inspectAt: new Date(),
        company: company ?? label.company,
        plant: plant ?? label.plant,
      });
      const savedInspect = await queryRunner.manager.save(InspectResult, inspectResult);

      /** FgLabel 업데이트 */
      label.inspectPassYn = dto.passYn;
      label.inspectResultId = savedInspect.resultNo;
      if (dto.passYn === 'Y') {
        label.status = 'ISSUED';
      }
      const savedLabel = await queryRunner.manager.save(FgLabel, label);

      this.logger.log(
        `재검사 완료: fgBarcode=${fgBarcode}, passYn=${dto.passYn}`,
      );
      return { inspectResult: savedInspect, fgLabel: savedLabel };
    });
    return result;
  }

  /**
   * 작업지시별 통전검사 통계
   */
  async getStats(orderNo: string, company?: string, plant?: string, inspectType = 'CONTINUITY') {
    const labelsQb = this.fgLabelRepo
      .createQueryBuilder('fg')
      .leftJoin(InspectResult, 'ir', 'ir.resultNo = fg.inspectResultId')
      .where('fg.orderNo = :orderNo', { orderNo });

    if (company) {
      labelsQb.andWhere('fg.company = :company', { company });
    }
    if (plant) {
      labelsQb.andWhere('fg.plant = :plant', { plant });
    }
    if (inspectType) {
      labelsQb.andWhere('ir.inspectType = :inspectType', { inspectType });
    }

    const labels = await labelsQb.getCount();

    const jobOrder = await this.jobOrderRepo.findOne({
      where: {
        orderNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!jobOrder) {
      throw new NotFoundException(
        `작업지시를 찾을 수 없습니다: ${orderNo}`,
      );
    }

    const qb = this.inspectResultRepo
      .createQueryBuilder('ir')
      .innerJoin('ir.prodResult', 'pr')
      .select('SUM(CASE WHEN ir.passYn = :passYn THEN 1 ELSE 0 END)', 'passed')
      .addSelect('SUM(CASE WHEN ir.passYn = :failYn THEN 1 ELSE 0 END)', 'failed')
      .where('pr.orderNo = :orderNo', { orderNo })
      .andWhere('pr.status != :canceled', { canceled: 'CANCELED' })
      .andWhere('ir.inspectType = :inspectType', { inspectType })
      .setParameters({ passYn: 'Y', failYn: 'N' });

    if (company) {
      qb.andWhere('ir.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('ir.plant = :plant', { plant });
    }

    const summary = await qb.getRawOne();

    const passed = parseInt(summary?.passed) || 0;
    const failed = parseInt(summary?.failed) || 0;
    const total = passed + failed;
    const passRate =
      total > 0 ? Math.round((passed / total) * 10000) / 100 : 0;

    return {
      orderNo,
      planQty: jobOrder.planQty,
      total,
      passed,
      failed,
      passRate,
      labelCount: labels,
    };
  }

  /**
   * 라벨 재인쇄 (reprintCount += 1)
   */
  async reprintLabel(fgBarcode: string, company?: string, plant?: string) {
    const label = await this.fgLabelRepo.findOne({
      where: {
        fgBarcode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!label) {
      throw new NotFoundException(
        `FG 라벨을 찾을 수 없습니다: ${fgBarcode}`,
      );
    }
    if (label.status === 'VOIDED') {
      throw new BadRequestException('취소된 라벨은 재인쇄할 수 없습니다.');
    }

    label.reprintCount += 1;
    await this.fgLabelRepo.save(label);

    return label;
  }

  /**
   * 장비 프로토콜 목록 조회 (관리 페이지용 — 전체)
   */
  async findProtocols(company?: string, plant?: string) {
    return this.equipProtocolRepo.find({
      where: {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { protocolId: 'ASC' },
    });
  }

  /**
   * 프로토콜 등록
   */
  async createProtocol(
    data: CreateEquipProtocolDto & { company?: string; plant?: string },
    company?: string,
    plant?: string,
  ) {
    this.assertTenantMatches('통전 프로토콜', { company, plant }, {
      label: 'body',
      company: data.company,
      plant: data.plant,
    });

    const protocol = this.equipProtocolRepo.create({
      protocolId: data.protocolId,
      equipCode: data.equipCode ?? null,
      protocolName: data.protocolName,
      commType: data.commType ?? 'SERIAL',
      delimiter: data.delimiter ?? ',',
      resultIndex: data.resultIndex ?? 1,
      passValue: data.passValue ?? 'PASS',
      failValue: data.failValue ?? 'FAIL',
      errorIndex: data.errorIndex ?? null,
      dataStartChar: data.dataStartChar ?? null,
      dataEndChar: data.dataEndChar ?? null,
      sampleData: data.sampleData ?? null,
      description: data.description ?? null,
      useYn: data.useYn ?? 'Y',
      company: company ?? null,
      plant: plant ?? null,
    });
    return this.equipProtocolRepo.save(protocol);
  }

  /**
   * 프로토콜 수정
   */
  async updateProtocol(protocolId: string, data: UpdateEquipProtocolDto, company?: string, plant?: string) {
    const protocol = await this.equipProtocolRepo.findOne({
      where: { protocolId, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!protocol)
      throw new NotFoundException(
        `프로토콜을 찾을 수 없습니다: ${protocolId}`,
      );
    Object.assign(protocol, {
      ...(data.equipCode !== undefined ? { equipCode: data.equipCode } : {}),
      ...(data.protocolName !== undefined ? { protocolName: data.protocolName } : {}),
      ...(data.commType !== undefined ? { commType: data.commType } : {}),
      ...(data.delimiter !== undefined ? { delimiter: data.delimiter } : {}),
      ...(data.resultIndex !== undefined ? { resultIndex: data.resultIndex } : {}),
      ...(data.passValue !== undefined ? { passValue: data.passValue } : {}),
      ...(data.failValue !== undefined ? { failValue: data.failValue } : {}),
      ...(data.errorIndex !== undefined ? { errorIndex: data.errorIndex } : {}),
      ...(data.dataStartChar !== undefined ? { dataStartChar: data.dataStartChar } : {}),
      ...(data.dataEndChar !== undefined ? { dataEndChar: data.dataEndChar } : {}),
      ...(data.sampleData !== undefined ? { sampleData: data.sampleData } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.useYn !== undefined ? { useYn: data.useYn } : {}),
    });
    return this.equipProtocolRepo.save(protocol);
  }

  /**
   * 프로토콜 삭제
   */
  async deleteProtocol(protocolId: string, company?: string, plant?: string) {
    const protocol = await this.equipProtocolRepo.findOne({
      where: { protocolId, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!protocol)
      throw new NotFoundException(
        `프로토콜을 찾을 수 없습니다: ${protocolId}`,
      );
    await this.equipProtocolRepo.remove(protocol);
  }

  /**
   * 장비 자동검사 — raw 데이터를 프로토콜 설정에 따라 파싱하여 검사 등록
   */
  async autoInspect(
    dto: AutoInspectDto,
    company?: string,
    plant?: string,
  ) {
    let passYn: string;
    let errorCode: string | null = null;

    if (dto.result) {
      passYn = dto.result === 'PASS' ? 'Y' : 'N';
      errorCode = dto.errorCode ?? null;
    } else if (dto.rawData) {
      const protocol = await this.equipProtocolRepo.findOne({
        where: {
          protocolId: dto.protocolId,
          useYn: 'Y',
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
      if (!protocol) {
        throw new NotFoundException(
          `프로토콜을 찾을 수 없습니다: ${dto.protocolId}`,
        );
      }

      try {
        const parsed = this.parseRawData(dto.rawData, protocol);
        passYn = parsed.passYn;
        errorCode = parsed.errorCode;
      } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        const stack = parseError instanceof Error ? parseError.stack : undefined;
        this.logger.error(`데이터 파싱 실패: rawData="${dto.rawData}", protocol=${dto.protocolId}`, stack);
        throw new BadRequestException(`데이터 파싱 실패: ${message}`);
      }
    } else {
      throw new BadRequestException(
        'rawData 또는 result 중 하나는 필수입니다.',
      );
    }

    return this.inspect(
      {
        orderNo: dto.orderNo,
        itemCode: dto.itemCode,
        equipCode: dto.equipCode,
        workerId: dto.workerId,
        lineCode: dto.lineCode,
        passYn,
        errorCode,
      },
      company,
      plant,
    );
  }

  /**
   * raw 데이터를 프로토콜 설정에 따라 파싱
   */
  private parseRawData(
    rawData: string,
    protocol: EquipProtocol,
  ): { passYn: string; errorCode: string | null } {
    let data = rawData.trim();

    if (protocol.dataStartChar && data.startsWith(protocol.dataStartChar)) {
      data = data.substring(protocol.dataStartChar.length);
    }
    if (protocol.dataEndChar) {
      const endIdx = data.indexOf(protocol.dataEndChar);
      if (endIdx >= 0) data = data.substring(0, endIdx);
    }

    const parts = data.split(protocol.delimiter).map((s) => s.trim());

    const resultValue = parts[protocol.resultIndex] ?? '';
    const passYn =
      resultValue.toUpperCase() === protocol.passValue.toUpperCase()
        ? 'Y'
        : 'N';

    let errorCode: string | null = null;
    if (
      passYn === 'N' &&
      protocol.errorIndex != null &&
      parts[protocol.errorIndex]
    ) {
      errorCode = parts[protocol.errorIndex];
    }

    this.logger.log(
      `파싱 결과: raw="${rawData}" → passYn=${passYn}, errorCode=${errorCode}`,
    );

    return { passYn, errorCode };
  }

  /**
   * 라벨 취소 (status → VOIDED)
   */
  async voidLabel(
    fgBarcode: string,
    reason: string,
    company?: string,
    plant?: string,
  ) {
    const label = await this.fgLabelRepo.findOne({
      where: {
        fgBarcode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!label) {
      throw new NotFoundException(
        `FG 라벨을 찾을 수 없습니다: ${fgBarcode}`,
      );
    }
    if (label.status === 'VOIDED') {
      throw new BadRequestException('이미 취소된 라벨입니다.');
    }

    if (['PACKED', 'SHIPPED'].includes(label.status)) {
      throw new BadRequestException(
        `후공정이 진행된 FG 라벨(${fgBarcode})은 취소할 수 없습니다. 출하/팔레트/박스부터 먼저 정리해 주세요.`,
      );
    }

    label.status = 'VOIDED';
    label.voidReason = reason;
    await this.fgLabelRepo.save(label);

    return label;
  }
}
