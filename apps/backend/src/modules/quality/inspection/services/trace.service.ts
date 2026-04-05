/**
 * @file src/modules/quality/inspection/services/trace.service.ts
 * @description 추적성 조회 서비스 - 시리얼/FG바코드로 4M 이력 종합 조회
 *
 * 초보자 가이드:
 * 1. 시리얼번호(FG_BARCODE)를 기준으로 FgLabel → ProdResult → JobOrder 순으로 추적
 * 2. TraceLog에서 해당 시리얼/PRD_UID의 공정별 타임라인 조립
 * 3. MatIssue에서 투입 자재 이력, InspectResult에서 검사 결과 조회
 * 4. 4M(Man, Machine, Material, Method) 데이터를 종합하여 반환
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { MatIssue } from '../../../../entities/mat-issue.entity';
import { TraceLog } from '../../../../entities/trace-log.entity';
import { PartMaster } from '../../../../entities/part-master.entity';
import { EquipMaster } from '../../../../entities/equip-master.entity';
import { WorkerMaster } from '../../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { MatLot } from '../../../../entities/mat-lot.entity';
import { ControlPlanItem } from '../../../../entities/control-plan-item.entity';
import { ControlPlan } from '../../../../entities/control-plan.entity';

/** 타임라인 항목 */
export interface TimelineItem {
  id: string;
  timestamp: string;
  process: string;
  processName: string;
  equipmentNo: string;
  operator: string;
  result: 'PASS' | 'FAIL' | 'WORK';
  detail?: string;
}

/** 4M 데이터 */
export interface FourMData {
  man: { process: string; processName: string; operatorId: string; operatorName: string; timestamp: string }[];
  machine: { process: string; processName: string; equipmentNo: string; equipmentName: string; timestamp: string }[];
  material: { materialCode: string; materialName: string; matUid: string; usedQty: number; unit: string; supplier: string }[];
  method: { process: string; processName: string; specName: string; specValue: string; actualValue: string; result: 'OK' | 'NG' }[];
}

/** 추적 결과 */
export interface TraceRecord {
  serialNo: string;
  matUid: string;
  prdUid: string;
  itemNo: string;
  itemName: string;
  workOrderNo: string;
  productionDate: string;
  timeline: TimelineItem[];
  fourM: FourMData;
}

@Injectable()
export class TraceService {
  private readonly logger = new Logger(TraceService.name);

  constructor(
    @InjectRepository(FgLabel)
    private readonly fgLabelRepo: Repository<FgLabel>,
    @InjectRepository(ProdResult)
    private readonly prodResultRepo: Repository<ProdResult>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(InspectResult)
    private readonly inspectResultRepo: Repository<InspectResult>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepo: Repository<MatIssue>,
    @InjectRepository(TraceLog)
    private readonly traceLogRepo: Repository<TraceLog>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepo: Repository<PartMaster>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepo: Repository<EquipMaster>,
    @InjectRepository(WorkerMaster)
    private readonly workerMasterRepo: Repository<WorkerMaster>,
    @InjectRepository(ProcessMaster)
    private readonly processMasterRepo: Repository<ProcessMaster>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(ControlPlanItem)
    private readonly controlPlanItemRepo: Repository<ControlPlanItem>,
  ) {}

  /**
   * 시리얼번호로 추적성 데이터 종합 조회
   * @param serial - 시리얼번호 (FG_BARCODE 또는 SERIAL_NO)
   * @param company - 회사코드
   * @param plant - 공장코드
   * @returns TraceRecord 또는 null
   */
  async findBySerial(serial: string, company: string, plant: string): Promise<TraceRecord | null> {
    this.logger.debug(`Trace lookup: serial=${serial}, company=${company}, plant=${plant}`);

    // 1) FgLabel에서 시리얼번호로 조회 (FG_BARCODE 또는 시리얼 패턴)
    const fgLabel = await this.fgLabelRepo.findOne({
      where: { fgBarcode: serial, company, plant },
    });

    if (!fgLabel) {
      this.logger.debug(`FgLabel not found for serial=${serial}`);
      return null;
    }

    // 2) FgLabel의 orderNo로 ProdResult 조회
    const prodResults = fgLabel.orderNo
      ? await this.prodResultRepo.find({
          where: { orderNo: fgLabel.orderNo, company, plant },
          order: { startAt: 'ASC' },
        })
      : [];

    // 3) JobOrder 조회
    const jobOrder = fgLabel.orderNo
      ? await this.jobOrderRepo.findOne({
          where: { orderNo: fgLabel.orderNo, company, plant },
        })
      : null;

    // 4) PartMaster 조회 (품목 정보)
    const partMaster = await this.partMasterRepo.findOne({
      where: { itemCode: fgLabel.itemCode, company, plant },
    });

    // 5) PRD_UID 수집 (생산실적에서)
    const prdUid = prodResults.find((pr) => pr.prdUid)?.prdUid ?? '';

    // 6) TraceLog에서 시리얼 관련 타임라인 조회
    const traceLogs = await this.traceLogRepo
      .createQueryBuilder('tl')
      .where('tl.company = :company', { company })
      .andWhere('tl.plant = :plant', { plant })
      .andWhere(
        '(tl.serialNo = :serial OR tl.prdUid = :prdUid)',
        { serial, prdUid: prdUid || '__NONE__' },
      )
      .orderBy('tl.traceTime', 'ASC')
      .addOrderBy('tl.seq', 'ASC')
      .getMany();

    // 7) 공정 마스터 캐시 (processCode → processName)
    const processCodeSet = new Set<string>();
    for (const pr of prodResults) {
      if (pr.processCode) processCodeSet.add(pr.processCode);
    }
    for (const tl of traceLogs) {
      if (tl.processCode) processCodeSet.add(tl.processCode);
    }
    const processCodes = [...processCodeSet];
    const processMap = new Map<string, string>();
    if (processCodes.length > 0) {
      const processes = await this.processMasterRepo
        .createQueryBuilder('pm')
        .where('pm.processCode IN (:...codes)', { codes: processCodes })
        .getMany();
      for (const p of processes) {
        processMap.set(p.processCode, p.processName);
      }
    }

    // 8) 설비 마스터 캐시 (equipCode → equipName)
    const equipCodeSet = new Set<string>();
    for (const pr of prodResults) {
      if (pr.equipCode) equipCodeSet.add(pr.equipCode);
    }
    for (const tl of traceLogs) {
      if (tl.equipCode) equipCodeSet.add(tl.equipCode);
    }
    if (fgLabel.equipCode) equipCodeSet.add(fgLabel.equipCode);
    const equipCodes = [...equipCodeSet];
    const equipMap = new Map<string, EquipMaster>();
    if (equipCodes.length > 0) {
      const equips = await this.equipMasterRepo
        .createQueryBuilder('em')
        .where('em.equipCode IN (:...codes)', { codes: equipCodes })
        .getMany();
      for (const e of equips) {
        equipMap.set(e.equipCode, e);
      }
    }

    // 9) 작업자 마스터 캐시 (workerCode → workerName)
    const workerIdSet = new Set<string>();
    for (const pr of prodResults) {
      if (pr.workerId) workerIdSet.add(pr.workerId);
    }
    for (const tl of traceLogs) {
      if (tl.workerId) workerIdSet.add(tl.workerId);
    }
    if (fgLabel.workerId) workerIdSet.add(fgLabel.workerId);
    const workerIds = [...workerIdSet];
    const workerMap = new Map<string, WorkerMaster>();
    if (workerIds.length > 0) {
      const workers = await this.workerMasterRepo
        .createQueryBuilder('wm')
        .where('wm.workerCode IN (:...codes)', { codes: workerIds })
        .getMany();
      for (const w of workers) {
        workerMap.set(w.workerCode, w);
      }
    }

    // === 타임라인 조립 ===
    const timeline: TimelineItem[] = [];
    let stepCounter = 0;

    // TraceLog 기반 타임라인
    for (const tl of traceLogs) {
      stepCounter++;
      const procName = tl.processCode ? (processMap.get(tl.processCode) ?? tl.processCode) : '';
      const worker = tl.workerId ? workerMap.get(tl.workerId) : null;

      timeline.push({
        id: `TL-${tl.traceTime instanceof Date ? tl.traceTime.getTime() : String(tl.traceTime)}-${tl.seq}`,
        timestamp: tl.traceTime instanceof Date ? tl.traceTime.toISOString() : String(tl.traceTime),
        process: tl.processCode ?? '',
        processName: procName,
        equipmentNo: tl.equipCode ?? '',
        operator: worker?.workerName ?? tl.workerId ?? '',
        result: this.mapEventTypeToResult(tl.eventType),
        detail: tl.eventData ?? undefined,
      });
    }

    // TraceLog가 없으면 ProdResult + InspectResult에서 타임라인 생성
    if (timeline.length === 0) {
      // 검사결과 일괄 조회 (N+1 제거)
      const resultNos = prodResults.map((pr) => pr.resultNo).filter(Boolean);
      const allInspResults = resultNos.length > 0
        ? await this.inspectResultRepo.find({
            where: { prodResultNo: In(resultNos), company, plant },
            order: { inspectAt: 'ASC' },
          })
        : [];
      const inspByResult = new Map<string, typeof allInspResults>();
      for (const ir of allInspResults) {
        const key = ir.prodResultNo;
        if (!inspByResult.has(key)) inspByResult.set(key, []);
        inspByResult.get(key)!.push(ir);
      }

      for (const pr of prodResults) {
        stepCounter++;
        const procName = pr.processCode ? (processMap.get(pr.processCode) ?? pr.processCode) : '';
        const worker = pr.workerId ? workerMap.get(pr.workerId) : null;
        const ts = pr.startAt ?? pr.createdAt;

        timeline.push({
          id: `PR-${pr.resultNo}`,
          timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
          process: pr.processCode ?? '',
          processName: procName,
          equipmentNo: pr.equipCode ?? '',
          operator: worker?.workerName ?? pr.workerId ?? '',
          result: 'WORK',
          detail: pr.remark ?? undefined,
        });

        const inspResults = inspByResult.get(pr.resultNo) ?? [];
        for (const ir of inspResults) {
          stepCounter++;
          timeline.push({
            id: `IR-${ir.resultNo}`,
            timestamp: ir.inspectAt instanceof Date ? ir.inspectAt.toISOString() : String(ir.inspectAt),
            process: pr.processCode ?? '',
            processName: `${procName} ${ir.inspectType ?? '검사'}`,
            equipmentNo: pr.equipCode ?? '',
            operator: ir.inspectorId ?? '',
            result: ir.passYn === 'Y' ? 'PASS' : 'FAIL',
            detail: ir.errorDetail ?? undefined,
          });
        }
      }
    }

    // === 4M 데이터 조립 ===

    // Man: 작업자 이력 (ProdResult 기반)
    const manData: FourMData['man'] = [];
    for (const pr of prodResults) {
      if (!pr.workerId) continue;
      const worker = workerMap.get(pr.workerId);
      const procName = pr.processCode ? (processMap.get(pr.processCode) ?? pr.processCode) : '';
      const ts = pr.startAt ?? pr.createdAt;
      manData.push({
        process: pr.processCode ?? '',
        processName: procName,
        operatorId: pr.workerId,
        operatorName: worker?.workerName ?? pr.workerId,
        timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
      });
    }

    // Machine: 설비 이력 (ProdResult 기반)
    const machineData: FourMData['machine'] = [];
    for (const pr of prodResults) {
      if (!pr.equipCode) continue;
      const equip = equipMap.get(pr.equipCode);
      const procName = pr.processCode ? (processMap.get(pr.processCode) ?? pr.processCode) : '';
      const ts = pr.startAt ?? pr.createdAt;
      machineData.push({
        process: pr.processCode ?? '',
        processName: procName,
        equipmentNo: pr.equipCode,
        equipmentName: equip?.equipName ?? pr.equipCode,
        timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
      });
    }

    // Material: 투입 자재 이력 (MatIssue 기반)
    const materialData: FourMData['material'] = [];
    if (fgLabel.orderNo) {
      const matIssues = await this.matIssueRepo.find({
        where: { orderNo: fgLabel.orderNo, company, plant },
        order: { issueDate: 'ASC' },
      });
      // 자재 LOT + 품목 일괄 조회 (N+1 제거)
      const matUids = [...new Set(matIssues.map((mi) => mi.matUid).filter(Boolean))];
      const allMatLots = matUids.length > 0
        ? await this.matLotRepo.find({ where: { matUid: In(matUids) } })
        : [];
      const matLotMap = new Map(allMatLots.map((l) => [l.matUid, l]));

      const matItemCodes = [...new Set(allMatLots.map((l) => l.itemCode).filter(Boolean))];
      const matParts = matItemCodes.length > 0
        ? await this.partMasterRepo.find({ where: { itemCode: In(matItemCodes) } })
        : [];
      const matPartMap = new Map(matParts.map((p) => [p.itemCode, p]));

      for (const mi of matIssues) {
        const matLot = matLotMap.get(mi.matUid);
        const matPart = matLot ? matPartMap.get(matLot.itemCode) : null;
        materialData.push({
          materialCode: matPart?.itemCode ?? matLot?.itemCode ?? '',
          materialName: matPart?.itemName ?? '',
          matUid: mi.matUid,
          usedQty: mi.issueQty,
          unit: matPart?.unit ?? 'EA',
          supplier: matLot?.vendor ?? '',
        });
      }
    }

    // Method: 관리계획서 항목 (ControlPlanItem 기반 — 품목코드로 연결)
    const methodData: FourMData['method'] = [];
    if (fgLabel.itemCode) {
      const controlPlanItems = await this.controlPlanItemRepo
        .createQueryBuilder('cpi')
        .innerJoin(ControlPlan, 'cp', 'cp.planNo = cpi.controlPlanId')
        .where('cp.itemCode = :itemCode', { itemCode: fgLabel.itemCode })
        .andWhere('cp.company = :company', { company })
        .andWhere('cp.plant = :plant', { plant })
        .orderBy('cpi.seq', 'ASC')
        .getMany();

      for (const cpi of controlPlanItems) {
        methodData.push({
          process: cpi.processCode ?? '',
          processName: cpi.processName ?? '',
          specName: cpi.productCharacteristic ?? cpi.processCharacteristic ?? '',
          specValue: cpi.specification ?? '',
          actualValue: '',
          result: 'OK',
        });
      }
    }

    // 검사 데이터가 있으면 Method에 실제 결과 반영
    // N+1 제거: prodResult 전체에 대해 일괄 조회
    const methodResultNos = prodResults.map((pr) => pr.resultNo).filter(Boolean);
    const allMethodInspResults = methodResultNos.length > 0
      ? await this.inspectResultRepo.find({
          where: { prodResultNo: In(methodResultNos), company, plant },
        })
      : [];
    const methodInspByResult = new Map<string, typeof allMethodInspResults>();
    for (const ir of allMethodInspResults) {
      const key = ir.prodResultNo;
      if (!methodInspByResult.has(key)) methodInspByResult.set(key, []);
      methodInspByResult.get(key)!.push(ir);
    }

    for (const pr of prodResults) {
      const inspResults = methodInspByResult.get(pr.resultNo) ?? [];
      for (const ir of inspResults) {
        if (ir.inspectData) {
          try {
            const inspData = JSON.parse(ir.inspectData);
            if (Array.isArray(inspData)) {
              for (const item of inspData) {
                const procName = pr.processCode ? (processMap.get(pr.processCode) ?? pr.processCode) : '';
                methodData.push({
                  process: pr.processCode ?? '',
                  processName: procName,
                  specName: item.specName ?? item.itemName ?? '',
                  specValue: item.specValue ?? item.standard ?? '',
                  actualValue: String(item.actualValue ?? item.measuredValue ?? ''),
                  result: (item.result === 'NG' || item.passYn === 'N' || ir.passYn === 'N') ? 'NG' : 'OK',
                });
              }
            }
          } catch {
            // inspectData 파싱 실패 — 무시
          }
        }
      }
    }

    const productionDate = jobOrder?.planDate
      ?? (prodResults.length > 0 ? prodResults[0].startAt : null)
      ?? fgLabel.issuedAt;

    return {
      serialNo: fgLabel.fgBarcode,
      matUid: prdUid ? '' : fgLabel.itemCode,
      prdUid,
      itemNo: partMaster?.itemNo ?? fgLabel.itemCode,
      itemName: partMaster?.itemName ?? '',
      workOrderNo: fgLabel.orderNo ?? '',
      productionDate: productionDate instanceof Date ? productionDate.toISOString().split('T')[0] : String(productionDate ?? ''),
      timeline,
      fourM: {
        man: manData,
        machine: machineData,
        material: materialData,
        method: methodData,
      },
    };
  }

  /**
   * TraceLog의 eventType을 타임라인 result로 매핑
   */
  private mapEventTypeToResult(eventType: string | null): 'PASS' | 'FAIL' | 'WORK' {
    if (!eventType) return 'WORK';
    const upper = eventType.toUpperCase();
    if (upper.includes('PASS') || upper.includes('OK') || upper.includes('ACCEPT')) return 'PASS';
    if (upper.includes('FAIL') || upper.includes('NG') || upper.includes('REJECT')) return 'FAIL';
    return 'WORK';
  }
}
