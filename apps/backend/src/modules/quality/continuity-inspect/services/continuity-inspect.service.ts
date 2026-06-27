/**
 * @file src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts
 * @description 통전검사 서비스 - 조립 발행 FG 라벨 스캔 → 검사 결과 등록 + 판정 기록
 *
 * 초보자 가이드:
 * 1. 작업지시 선택 → 제품 1개씩 전수검사
 * 2. PASS → 조립(서브공정) 키팅에서 발행된 FG 라벨(ISSUED)을 스캔 → InspectResult 등록 + 판정 기록 (채번 없음)
 * 3. FAIL → InspectResult 등록 (스캔 라벨에 불합격 기록)
 *
 * 주요 흐름:
 * - findJobOrders: 진행중/대기 작업지시 목록 (품목 정보 포함)
 * - inspect: 합격 시 스캔된 FG 라벨에 판정/검사정보 갱신 (FG 발행은 조립 키팅 담당, 트랜잭션)
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
import { In, IsNull, Not, Repository } from 'typeorm';
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
  ReInspectDto,
  UpdateEquipProtocolDto,
  IntegratedInspectDto,
  IntegratedInspectResponseDto,
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
    finishedOnly?: boolean;
  }) {
    const qb = this.jobOrderRepo
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .where('jo.status IN (:...statuses)', {
        statuses: ['RUNNING', 'IN_PROGRESS', 'WAITING'],
      });

    // 완제품 검사(예: 통전검사)는 완제품(FINISHED) 작업지시만 대상으로 제한
    if (query.finishedOnly) {
      qb.andWhere('part.itemType = :finishedType', { finishedType: 'FINISHED' });
    }

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
    company?: string;
    plant?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
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
    if (query.company) {
      qb.andWhere('fg.company = :company', { company: query.company });
    }
    if (query.plant) {
      qb.andWhere('fg.plant = :plant', { plant: query.plant });
    }

    qb.andWhere('fg.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['PACKED', 'SHIPPED', 'VOIDED'] });
    qb.andWhere('fg.structureYn IS NULL');

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
    // 외관검사 상태변경 전용 — 임의 상태(PACKED/SHIPPED 등)로의 직접 변경을 차단한다.
    const ALLOWED_TARGET = ['VISUAL_PASS', 'VISUAL_FAIL'];
    if (!ALLOWED_TARGET.includes(status)) {
      throw new BadRequestException(
        `외관검사 상태변경은 ${ALLOWED_TARGET.join('/')} 만 허용됩니다(요청: ${status}).`,
      );
    }
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
    // 후공정/종료 상태 라벨은 외관검사 상태로 되돌릴 수 없다.
    const BLOCKED_SOURCE = ['PACKED', 'SHIPPED', 'VOIDED'];
    if (BLOCKED_SOURCE.includes(label.status)) {
      throw new BadRequestException(
        `현재 상태(${label.status})에서는 외관검사 상태로 변경할 수 없습니다.`,
      );
    }
    label.status = status;
    return this.fgLabelRepo.save(label);
  }

  /**
   * 외관검사 — 검사결과 기록 + FG라벨 상태전이를 한 트랜잭션에 처리(원자성).
   * 기존엔 inspect-results 등록과 fg-label-status 변경을 프론트에서 2번 호출해
   * 2번째 실패 시 불일치가 생기던 문제를 해소한다.
   */
  async visualInspect(
    fgBarcode: string,
    dto: { passYn: 'Y' | 'N'; errorCode?: string | null; errorDetail?: string | null; inspectData?: string | null; inspectorId?: string | null },
    company?: string,
    plant?: string,
  ): Promise<{ inspectResult: InspectResult; fgLabel: FgLabel }> {
    if (await this.sysConfigService.isEnabled('VISUAL_INSP_BYPASS')) {
      throw new BadRequestException('외관검사가 시스템 설정에서 bypass 처리되었습니다. 관리자에게 문의하세요.');
    }
    return this.tx.run(async (qr) => {
      const label = await qr.manager.findOne(FgLabel, {
        where: { fgBarcode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });
      if (!label) {
        throw new NotFoundException(`FG 라벨을 찾을 수 없습니다: ${fgBarcode}`);
      }
      if (['PACKED', 'SHIPPED', 'VOIDED'].includes(label.status)) {
        throw new BadRequestException(`현재 상태(${label.status})에서는 외관검사할 수 없습니다.`);
      }

      const inspectResultNo = await this.seqGenerator.getNo('INSPECT_RESULT', qr);
      const inspectResult = qr.manager.create(InspectResult, {
        resultNo: inspectResultNo,
        prodResultNo: null,
        inspectType: 'VISUAL',
        inspectScope: 'FULL',
        passYn: dto.passYn,
        errorCode: dto.passYn === 'N' ? dto.errorCode ?? null : null,
        errorDetail: dto.passYn === 'N' ? dto.errorDetail ?? null : null,
        inspectData: dto.passYn === 'N' ? dto.inspectData ?? null : null,
        fgBarcode,
        inspectorId: dto.inspectorId ?? null,
        inspectAt: new Date(),
        company: company ?? label.company,
        plant: plant ?? label.plant,
      });
      const savedInspect = await qr.manager.save(InspectResult, inspectResult);

      label.status = dto.passYn === 'Y' ? 'VISUAL_PASS' : 'VISUAL_FAIL';
      const savedLabel = await qr.manager.save(FgLabel, label);

      return { inspectResult: savedInspect, fgLabel: savedLabel };
    });
  }

  /**
   * 작업지시별 검사 이력 조회 (PASS+FAIL 모두 포함)
   * - FG_LABELS.ORDER_NO 로 연결된 검사결과 (PASS)
   * - PROD_RESULTS.ORDER_NO 로 연결된 검사결과 (FAIL, prodResultNo null 허용)
   */
  async findInspectHistory(
    orderNo: string,
    company: string,
    plant: string,
    inspectType?: string,
  ) {
    // 해당 작업지시에 속하는 FG_BARCODE 목록 (PASS 케이스 추적)
    const fgLabels = await this.fgLabelRepo
      .createQueryBuilder('fg')
      .select('fg.fgBarcode')
      .where('fg.orderNo = :orderNo', { orderNo })
      .getMany();
    const fgBarcodes = fgLabels.map((l) => l.fgBarcode).filter((v): v is string => !!v);

    // 해당 작업지시에 속하는 PROD_RESULT_NO 목록 (FAIL 케이스 추적)
    const prodResults = await this.prodResultRepo
      .createQueryBuilder('pr')
      .select('pr.resultNo')
      .where('pr.orderNo = :orderNo', { orderNo })
      .getMany();
    const prodResultNos = prodResults.map((p) => p.resultNo);

    if (fgBarcodes.length === 0 && prodResultNos.length === 0) return [];

    const conditions: string[] = [];
    const params: Record<string, unknown> = { company, plant };

    if (fgBarcodes.length > 0) {
      conditions.push('ir.fgBarcode IN (:...fgBarcodes)');
      params.fgBarcodes = fgBarcodes;
    }
    if (prodResultNos.length > 0) {
      conditions.push('ir.prodResultNo IN (:...prodResultNos)');
      params.prodResultNos = prodResultNos;
    }

    const qb = this.inspectResultRepo
      .createQueryBuilder('ir')
      .where(`(${conditions.join(' OR ')})`, params)
      .andWhere('ir.company = :company', { company })
      .andWhere('ir.plant = :plant', { plant })
      .orderBy('ir.inspectAt', 'DESC')
      .take(20);

    if (inspectType) {
      qb.andWhere('ir.inspectType = :inspectType', { ...params, inspectType });
    }

    return qb.getMany();
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
   * 제품(FG) 라벨은 조립(서브공정) 키팅 공정에서 발행되므로(라우팅 ISSUE_LABEL_TYPE='FG'), 검사 단계는 채번하지 않는다.
   * - PASS: 회로라벨 필수 + 중복 차단 → dto.fgBarcode(조립 발행 ISSUED 라벨) 스캔 조회 → 판정/검사정보 갱신
   * - FAIL: InspectResult 등록 + dto.fgBarcode 있으면 ISSUED 라벨에 불합격 기록
   */
  async inspect(
    dto: ContinuityInspectDto,
    company?: string,
    plant?: string,
  ): Promise<{ inspectResult: InspectResult; fgBarcode: string | null }> {
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

      /** 1-2. 합격 시 회로라벨 필수 + 중복 차단 */
      if (dto.passYn === 'Y') {
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
        /** 합격: 조립(서브공정) 키팅에서 이미 발행된 ISSUED 라벨에 판정/검사정보만 갱신.
         *  바코드 채번·신규 FG_LABELS 생성 없음. 라벨 식별은 dto.fgBarcode(스캔값) 사용. */
        if (!dto.fgBarcode) {
          throw new BadRequestException(
            `합격 시 제품 라벨(FG) 스캔이 필요합니다.`,
          );
        }
        fgBarcode = dto.fgBarcode;

        const issuedLabel = await queryRunner.manager.findOne(FgLabel, {
          where: {
            fgBarcode: dto.fgBarcode,
            status: 'ISSUED',
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });
        if (!issuedLabel) {
          throw new NotFoundException(
            `ISSUED 상태의 FG 라벨을 찾을 수 없습니다: ${dto.fgBarcode}`,
          );
        }

        issuedLabel.inspectResultId = savedInspect.resultNo;
        issuedLabel.inspectPassYn = 'Y';
        issuedLabel.workerId = dto.workerId ?? issuedLabel.workerId;
        issuedLabel.equipCode = dto.equipCode ?? issuedLabel.equipCode;
        issuedLabel.lineCode = dto.lineCode ?? issuedLabel.lineCode;
        await queryRunner.manager.save(FgLabel, issuedLabel);

        savedInspect.fgBarcode = fgBarcode;
        await queryRunner.manager.save(InspectResult, savedInspect);
      } else {
        /** 불합격: 스캔된 ISSUED 라벨에 불합격 기록 */
        if (dto.fgBarcode) {
          const issuedLabel = await queryRunner.manager.findOne(FgLabel, {
            where: {
              fgBarcode: dto.fgBarcode,
              status: 'ISSUED',
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });
          if (issuedLabel) {
            issuedLabel.inspectResultId = savedInspect.resultNo;
            issuedLabel.inspectPassYn = 'N';
            await queryRunner.manager.save(FgLabel, issuedLabel);
          }
        }
      }
      this.logger.log(
        `통전검사 완료: orderNo=${dto.orderNo}, pass=${dto.passYn}, fgBarcode=${fgBarcode}`,
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
   * 작업지시별 검사 대기 FG 라벨 목록 조회.
   * 조립(서브공정) 키팅에서 발행(ISSUED)됐으나 아직 통전검사를 하지 않은(inspectPassYn IS NULL) 라벨.
   */
  async getPendingLabels(orderNo: string, company?: string, plant?: string) {
    return this.fgLabelRepo.find({
      where: {
        orderNo,
        status: 'ISSUED',
        inspectPassYn: IsNull(),
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
   * 통합검사 — 회로/리크/내전압/구조 4개 검사를 한 번에 처리
   * - ALL PASS → FG 바코드 발행 + FG_LABEL 등록
   * - 하나라도 FAIL → 종합 FAIL (FG 바코드 미발행)
   * - 각 스텝은 INSPECT_RESULTS에 개별 기록
   */
  async integratedInspect(
    dto: IntegratedInspectDto,
    company?: string,
    plant?: string,
  ): Promise<IntegratedInspectResponseDto> {
    const steps = dto.steps ?? [];
    if (steps.length === 0) {
      throw new BadRequestException('최소 1개 이상의 검사 스텝이 필요합니다.');
    }

    return this.tx.run(async (queryRunner) => {
      /** 1. 작업지시 존재 확인 */
      const jobOrder = await queryRunner.manager.findOne(JobOrder, {
        where: {
          orderNo: dto.orderNo,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
      }

      /** 2. 종합 합부 판정 — 하나라도 N이면 전체 FAIL */
      const overallPass = steps.every((s) => s.passYn === 'Y');

      /** 3. FG 바코드 발행 (ALL PASS 시에만) & 과발행 차단 */
      let fgBarcode: string | null = null;
      if (overallPass) {
        const producedRow = await queryRunner.manager
          .createQueryBuilder(ProdResult, 'pr')
          .select('COALESCE(SUM(pr.goodQty), 0)', 'sum')
          .where('pr.orderNo = :orderNo', { orderNo: dto.orderNo })
          .andWhere("pr.status != 'CANCELED'")
          .andWhere(company ? 'pr.company = :company' : '1=1', company ? { company } : {})
          .andWhere(plant ? 'pr.plant = :plant' : '1=1', plant ? { plant } : {})
          .getRawOne();
        const producedGoodQty = Number(producedRow?.sum ?? 0);

        // 기 발행: 구조검사에서 통전검사로 발행된 ISSUED 라벨 포함
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
            `통합검사 합격 발행수가 생산 양품수를 초과할 수 없습니다. ` +
              `(작업지시 ${dto.orderNo}: 생산 양품 ${producedGoodQty}, 기발행 ${issuedCount})`,
          );
        }

        fgBarcode = await this.seqGenerator.nextFgBarcode(queryRunner);
      }

      /** 4. 각 스텝별 INSPECT_RESULT 생성 */
      const inspectResultIds: string[] = [];
      const stepResults: IntegratedInspectResponseDto['stepResults'] = [];

      for (const step of steps) {
        const inspectResultNo = await this.seqGenerator.getNo('INSPECT_RESULT', queryRunner);
        const inspectResult = queryRunner.manager.create(InspectResult, {
          resultNo: inspectResultNo,
          prodResultNo: null,
          inspectType: step.inspectType,
          inspectScope: 'FULL',
          passYn: step.passYn,
          errorCode: step.passYn === 'N' ? (step.errorCode ?? null) : null,
          errorDetail: step.passYn === 'N' ? (step.errorDetail ?? null) : null,
          inspectData: step.passYn === 'N' ? (step.inspectData ?? null) : null,
          fgBarcode,
          inspectorId: dto.workerId ?? null,
          equipCode: dto.equipCode ?? null,
          inspectAt: new Date(),
          company: company ?? jobOrder.company,
          plant: plant ?? jobOrder.plant,
        });
        const saved = await queryRunner.manager.save(InspectResult, inspectResult);
        inspectResultIds.push(saved.resultNo);
        stepResults.push({ inspectType: step.inspectType, passYn: step.passYn, resultNo: saved.resultNo });
      }

      /** 5. ALL PASS 시 FG_LABEL 등록 */
      if (overallPass && fgBarcode) {
        // 첫 번째 스텝(CONTINUITY 우선) 결과를 inspectResultId로 연결
        const continuityResult = steps.find((s) => s.inspectType === 'CONTINUITY');
        const continuityId = continuityResult
          ? inspectResultIds[steps.indexOf(continuityResult)]
          : inspectResultIds[0];

        const structureResult = steps.find((s) => s.inspectType === 'STRUCTURE');
        const structureIdx = structureResult ? steps.indexOf(structureResult) : -1;

        const fgLabel = queryRunner.manager.create(FgLabel, {
          fgBarcode,
          itemCode: dto.itemCode,
          orderNo: dto.orderNo,
          equipCode: dto.equipCode ?? null,
          workerId: dto.workerId ?? null,
          lineCode: dto.lineCode ?? null,
          status: 'ISSUED',
          inspectResultId: continuityId,
          inspectPassYn: 'Y',
          structureYn: structureIdx >= 0 ? steps[structureIdx].passYn : null,
          company: company ?? jobOrder.company,
          plant: plant ?? jobOrder.plant,
        });
        await queryRunner.manager.save(FgLabel, fgLabel);
      }

      this.logger.log(
        `통합검사 완료: orderNo=${dto.orderNo}, overallPass=${overallPass}, fgBarcode=${fgBarcode}, steps=${steps.length}`,
      );

      return { overallPass, fgBarcode, inspectResultIds, stepResults };
    });
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
   * 구조검사 — 저전압 공정 DIM'S/부재자누락 검사
   * FG_BARCODE 스캔 → 검사결과 기록 + FG_LABELS.STRUCTURE_YN 갱신
   * STATUS는 변경하지 않음 (생산흐름과 독립적)
   */
  async structureInspect(
    fgBarcode: string,
    dto: { passYn: 'Y' | 'N'; errorCode?: string | null; errorDetail?: string | null; inspectData?: string | null; inspectorId?: string | null },
    company?: string,
    plant?: string,
  ): Promise<{ inspectResult: InspectResult; fgLabel: FgLabel }> {
    if (await this.sysConfigService.isEnabled('STRUCTURE_INSP_BYPASS')) {
      throw new BadRequestException('구조검사가 시스템 설정에서 bypass 처리되었습니다. 관리자에게 문의하세요.');
    }
    return this.tx.run(async (qr) => {
      const label = await qr.manager.findOne(FgLabel, {
        where: { fgBarcode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });
      if (!label) {
        throw new NotFoundException(`FG 라벨을 찾을 수 없습니다: ${fgBarcode}`);
      }

      const inspectResultNo = await this.seqGenerator.getNo('INSPECT_RESULT', qr);
      const inspectResult = qr.manager.create(InspectResult, {
        resultNo: inspectResultNo,
        prodResultNo: null,
        inspectType: 'STRUCTURE',
        inspectScope: 'FULL',
        passYn: dto.passYn,
        errorCode: dto.passYn === 'N' ? dto.errorCode ?? null : null,
        errorDetail: dto.passYn === 'N' ? dto.errorDetail ?? null : null,
        inspectData: dto.passYn === 'N' ? dto.inspectData ?? null : null,
        fgBarcode,
        inspectorId: dto.inspectorId ?? null,
        inspectAt: new Date(),
        company: company ?? label.company,
        plant: plant ?? label.plant,
      });
      const savedInspect = await qr.manager.save(InspectResult, inspectResult);

      label.structureYn = dto.passYn;
      label.inspectResultId = savedInspect.resultNo;
      label.inspectPassYn = dto.passYn;
      const savedLabel = await qr.manager.save(FgLabel, label);

      return { inspectResult: savedInspect, fgLabel: savedLabel };
    });
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
