/**
 * @file crimp-inspect.service.ts
 * @description 절압물검사 서비스 — 압착 작업지시의 반제품(절압물)을 단자별 압착 규격으로 판정한다.
 *
 * 초보자 가이드:
 * 1. 대상: 공정유형 CRIMPING 인 작업지시. 라우팅의 CRINS(절압물검사)는 작업지시를 만들지 않으므로
 *    바로 앞 압착 작업지시에 검사 결과를 건다.
 * 2. 단자/전선: 작업지시 품목 BOM 의 TERMINAL 자품목이 단자 사이드, WIRE 자품목이 전선이다.
 *    전선이 압착 품목에 없으면(절단 반제품이 자품목) 한 단계 아래 반제품 BOM 에서 찾는다.
 * 3. 규격: TERMINAL_CRIMP_SPECS 에서 (단자 품목, 전선 품목)이 정확히 일치하는 사용중 규격 1건.
 *    없거나 2건 이상이면 판정하지 않는다(일반 사이즈 행으로 대신 판정하지 않는다).
 * 4. 저장: INSPECT_RESULTS(INSPECT_TYPE='TERMINAL', INSPECT_SCOPE='SAMPLE', ORDER_NO) 1건 + INSPECT_DATA JSON.
 *    합/불은 서버가 실측값과 외관 판정으로 다시 계산한다.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import {
  CRIMP_MEASURE_KEYS,
  CrimpMeasureKey,
  CrimpSpecLimits,
  judgeCrimpSide,
} from '@harness/shared';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { TransactionService } from '../../../../shared/transaction.service';
import { CreateCrimpInspectDto } from '../dto/crimp-inspect.dto';

export const CRIMP_INSPECT_TYPE = 'TERMINAL';

export type CrimpSideStatus = 'OK' | 'NO_WIRE' | 'MULTI_WIRE' | 'NO_SPEC' | 'DUP_SPEC';

export interface CrimpSideSpec extends CrimpSpecLimits {
  specId: number;
  wireSize: string;
  applicatorCode: string | null;
}

export interface CrimpInspectSide {
  sideKey: string;
  side: string | null;
  terminalItemCode: string;
  terminalName: string | null;
  terminalSpec: string | null;
  wireItemCode: string | null;
  wireName: string | null;
  wireSpec: string | null;
  status: CrimpSideStatus;
  spec: CrimpSideSpec | null;
}

export interface OrderRow {
  orderNo: string;
  itemCode: string;
  itemName: string | null;
  processCode: string;
  processName: string | null;
  status: string;
}

interface BomChildRow {
  childItemCode: string;
  side: string | null;
  seq: number | null;
  itemName: string | null;
  spec: string | null;
  productType: string | null;
  itemType: string | null;
}

interface SpecRow {
  SPEC_ID: number;
  TERMINAL_ITEM_CODE: string;
  WIRE_SIZE: string;
  WIRE_ITEM_CODE: string | null;
  CRIMP_HEIGHT_LSL: number | null;
  CRIMP_HEIGHT_USL: number | null;
  CRIMP_WIDTH_LSL: number | null;
  CRIMP_WIDTH_USL: number | null;
  INS_CRIMP_HEIGHT_LSL: number | null;
  INS_CRIMP_HEIGHT_USL: number | null;
  PULL_FORCE_MIN: number | null;
  STRIP_LENGTH_MIN: number | null;
  STRIP_LENGTH_MAX: number | null;
  APPLICATOR_CODE: string | null;
}

const MEASURE_LABEL: Record<CrimpMeasureKey, string> = {
  crimpHeight: '압착고',
  crimpWidth: '압착폭',
  insCrimpHeight: '절연부 압착고',
  pullForce: '인장력',
  stripLength: '탈피길이',
};

const SIDE_STATUS_MESSAGE: Record<Exclude<CrimpSideStatus, 'OK'>, string> = {
  NO_WIRE: 'BOM에서 전선을 찾을 수 없음',
  MULTI_WIRE: 'BOM 전선이 2종 이상이라 특정할 수 없음',
  NO_SPEC: '단자+전선 압착 규격 미등록',
  DUP_SPEC: '단자+전선 압착 규격 중복',
};

/** 전선을 찾을 때 반제품 BOM 을 내려가는 최대 단계 (순환 BOM 은 visited 로 끊는다) */
const BOM_WIRE_SEARCH_MAX_DEPTH = 10;

/** BOM 자품목 조회 — 오늘 유효한 사용중 행만 */
async function findBomChildren(
  manager: EntityManager,
  parentItemCodes: string[],
  company: string,
  plant: string,
): Promise<BomChildRow[]> {
  if (parentItemCodes.length === 0) return [];
  return manager.query(
    `SELECT b.CHILD_ITEM_CODE AS "childItemCode", b.SIDE AS "side", b.SEQ AS "seq",
            im.ITEM_NAME AS "itemName", im.SPEC AS "spec", im.PRODUCT_TYPE AS "productType", im.ITEM_TYPE AS "itemType"
       FROM BOM_MASTERS b
       JOIN ITEM_MASTERS im ON im.COMPANY = b.COMPANY AND im.PLANT_CD = b.PLANT_CD AND im.ITEM_CODE = b.CHILD_ITEM_CODE
      WHERE b.COMPANY = :1 AND b.PLANT_CD = :2 AND b.USE_YN = 'Y'
        AND b.PARENT_ITEM_CODE IN (${parentItemCodes.map((_, i) => `:${i + 3}`).join(', ')})
        AND (b.VALID_FROM IS NULL OR b.VALID_FROM <= SYSDATE)
        AND (b.VALID_TO IS NULL OR b.VALID_TO >= TRUNC(SYSDATE))
      ORDER BY b.SEQ, b.CHILD_ITEM_CODE`,
    [company, plant, ...parentItemCodes],
  );
}

@Injectable()
export class CrimpInspectService {
  constructor(
    @InjectRepository(InspectResult)
    private readonly inspectResultRepo: Repository<InspectResult>,
    private readonly seqGenerator: SeqGeneratorService,
    private readonly tx: TransactionService,
  ) {}

  /** 진행/대기 중인 압착 작업지시 + 절압물검사 건수 */
  async findJobOrders(company: string, plant: string) {
    return this.inspectResultRepo.query(
      `SELECT jo.ORDER_NO AS "orderNo", jo.ITEM_CODE AS "itemCode", im.ITEM_NAME AS "itemName",
              jo.PROCESS_CODE AS "processCode", pm.PROCESS_NAME AS "processName", jo.EQUIP_CODE AS "equipCode",
              jo.PLAN_QTY AS "planQty", jo.GOOD_QTY AS "goodQty", jo.DEFECT_QTY AS "defectQty",
              jo.STATUS AS "status", jo.PLAN_DATE AS "planDate",
              NVL(ir.CNT, 0) AS "inspectCount", NVL(ir.FAIL_CNT, 0) AS "failCount"
         FROM JOB_ORDERS jo
         JOIN PROCESS_MASTERS pm ON pm.COMPANY = jo.COMPANY AND pm.PLANT_CD = jo.PLANT_CD AND pm.PROCESS_CODE = jo.PROCESS_CODE
         LEFT JOIN ITEM_MASTERS im ON im.COMPANY = jo.COMPANY AND im.PLANT_CD = jo.PLANT_CD AND im.ITEM_CODE = jo.ITEM_CODE
         LEFT JOIN (
           SELECT ORDER_NO, COUNT(*) AS CNT, SUM(CASE WHEN PASS_YN = 'N' THEN 1 ELSE 0 END) AS FAIL_CNT
             FROM INSPECT_RESULTS
            WHERE COMPANY = :1 AND PLANT_CD = :2 AND INSPECT_TYPE = '${CRIMP_INSPECT_TYPE}' AND ORDER_NO IS NOT NULL
            GROUP BY ORDER_NO
         ) ir ON ir.ORDER_NO = jo.ORDER_NO
        WHERE jo.COMPANY = :3 AND jo.PLANT_CD = :4
          AND pm.PROCESS_TYPE = 'CRIMPING'
          AND jo.STATUS IN ('RUNNING', 'WAITING')
        ORDER BY CASE jo.STATUS WHEN 'RUNNING' THEN 0 ELSE 1 END, jo.PRIORITY, jo.PLAN_DATE, jo.ORDER_NO`,
      // 위치 바인드는 같은 번호라도 나올 때마다 값이 필요하다(DPY-4009)
      [company, plant, company, plant],
    );
  }

  /** 작업지시의 단자 사이드별 압착 규격 + 외관 판정 항목 */
  async getContext(orderNo: string, company: string, plant: string) {
    const qr = this.inspectResultRepo.manager;
    const order = await this.loadOrder(qr, orderNo, company, plant);
    const sides = await this.resolveSides(qr, order.itemCode, company, plant);
    const visualChecks = await this.loadVisualChecks(qr, company, plant);
    return { order, sides, visualChecks, ready: sides.length > 0 && sides.every((s) => s.status === 'OK') };
  }

  async findHistory(orderNo: string, company: string, plant: string) {
    return this.inspectResultRepo.find({
      where: { orderNo, inspectType: CRIMP_INSPECT_TYPE, company, plant },
      order: { inspectAt: 'DESC' },
      take: 100,
    });
  }

  async create(dto: CreateCrimpInspectDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const manager = qr.manager;
      const order = await this.loadOrder(manager, dto.orderNo, company, plant);
      await this.assertWorker(qr, dto.workerId, company, plant);

      const sides = await this.resolveSides(manager, order.itemCode, company, plant);
      if (sides.length === 0) {
        throw new BadRequestException(`작업지시 품목 BOM에 단자(TERMINAL)가 없습니다: ${order.itemCode}`);
      }
      const blocked = sides.filter((s) => s.status !== 'OK');
      if (blocked.length > 0) {
        throw new BadRequestException(
          `압착 규격을 특정할 수 없는 단자가 있어 판정할 수 없습니다: ${blocked
            .map((s) => `${s.terminalItemCode}(${SIDE_STATUS_MESSAGE[s.status as Exclude<CrimpSideStatus, 'OK'>]})`)
            .join(', ')}`,
        );
      }

      const inputByKey = new Map(dto.sides.map((s) => [s.sideKey, s]));
      const unknownKeys = [...inputByKey.keys()].filter((k) => !sides.some((s) => s.sideKey === k));
      if (unknownKeys.length > 0) {
        throw new BadRequestException(`작업지시 BOM에 없는 단자입니다: ${unknownKeys.join(', ')}`);
      }

      const judgedSides = sides.map((side) => {
        const input = inputByKey.get(side.sideKey);
        const measured = Object.fromEntries(
          CRIMP_MEASURE_KEYS.map((key) => [key, input?.[key] ?? null]),
        ) as Record<CrimpMeasureKey, number | null>;
        const judged = judgeCrimpSide(side.spec!, measured);
        if (judged.missing.length > 0) {
          throw new BadRequestException(
            `${side.terminalItemCode} 실측값이 없습니다: ${judged.missing.map((k) => MEASURE_LABEL[k]).join(', ')}`,
          );
        }
        return { side, measured, judged };
      });

      const visualCodes = await this.loadVisualChecks(manager, company, plant);
      const visualByCode = new Map(dto.visualChecks.map((v) => [v.code, v.result]));
      const unknownVisual = [...visualByCode.keys()].filter((c) => !visualCodes.some((v) => v.code === c));
      if (unknownVisual.length > 0) {
        throw new BadRequestException(`등록되지 않은 외관 판정 항목입니다: ${unknownVisual.join(', ')}`);
      }
      const missingVisual = visualCodes.filter((v) => !visualByCode.has(v.code));
      if (missingVisual.length > 0) {
        throw new BadRequestException(`외관 판정이 없습니다: ${missingVisual.map((v) => v.name).join(', ')}`);
      }
      const visualResults = visualCodes.map((v) => ({ code: v.code, name: v.name, result: visualByCode.get(v.code)! }));

      const specFailures = judgedSides.flatMap(({ side, judged }) =>
        judged.failures.map((f) => {
          const range = f.usl === null ? `≥${f.lsl}` : f.lsl === null ? `≤${f.usl}` : `${f.lsl}~${f.usl}`;
          return `${side.terminalItemCode} ${MEASURE_LABEL[f.key]} ${f.value} (${range})`;
        }),
      );
      const visualNg = visualResults.filter((v) => v.result === 'NG');
      const passYn = specFailures.length === 0 && visualNg.length === 0 ? 'Y' : 'N';
      const errorCode = specFailures.length > 0 ? 'SPEC' : visualNg.length > 0 ? 'VISUAL' : null;
      const errorDetail = passYn === 'N'
        ? [...specFailures, ...visualNg.map((v) => `외관 ${v.name} NG`), dto.remark?.trim() || null]
          .filter(Boolean)
          .join('; ')
          .slice(0, 500)
        : dto.remark?.trim() || null;

      const inspectData = JSON.stringify({
        timing: dto.timing,
        processCode: order.processCode,
        itemCode: order.itemCode,
        sides: judgedSides.map(({ side, measured, judged }) => ({
          sideKey: side.sideKey,
          side: side.side,
          terminalItemCode: side.terminalItemCode,
          wireItemCode: side.wireItemCode,
          specId: side.spec!.specId,
          measured,
          passYn: judged.passYn,
          failures: judged.failures,
        })),
        visualChecks: visualResults.map(({ code, result }) => ({ code, result })),
        remark: dto.remark?.trim() || null,
      });

      const resultNo = await this.seqGenerator.getNo('INSPECT_RESULT', qr);
      const saved = await manager.save(
        InspectResult,
        manager.create(InspectResult, {
          resultNo,
          orderNo: order.orderNo,
          prodResultNo: null,
          inspectType: CRIMP_INSPECT_TYPE,
          inspectScope: 'SAMPLE',
          passYn,
          errorCode,
          errorDetail,
          inspectData,
          inspectorId: dto.workerId,
          inspectAt: new Date(),
          company,
          plant,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      return saved;
    });
  }

  private async loadOrder(
    manager: EntityManager,
    orderNo: string,
    company: string,
    plant: string,
  ): Promise<OrderRow> {
    const rows: Array<OrderRow & { processType: string | null }> = await manager.query(
      `SELECT jo.ORDER_NO AS "orderNo", jo.ITEM_CODE AS "itemCode", im.ITEM_NAME AS "itemName",
              jo.PROCESS_CODE AS "processCode", pm.PROCESS_NAME AS "processName", pm.PROCESS_TYPE AS "processType",
              jo.STATUS AS "status"
         FROM JOB_ORDERS jo
         LEFT JOIN PROCESS_MASTERS pm ON pm.COMPANY = jo.COMPANY AND pm.PLANT_CD = jo.PLANT_CD AND pm.PROCESS_CODE = jo.PROCESS_CODE
         LEFT JOIN ITEM_MASTERS im ON im.COMPANY = jo.COMPANY AND im.PLANT_CD = jo.PLANT_CD AND im.ITEM_CODE = jo.ITEM_CODE
        WHERE jo.COMPANY = :1 AND jo.PLANT_CD = :2 AND jo.ORDER_NO = :3`,
      [company, plant, orderNo],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    if (row.processType !== 'CRIMPING') {
      throw new BadRequestException(`압착 공정 작업지시가 아닙니다: ${orderNo} (${row.processCode ?? '-'})`);
    }
    if (row.status === 'CANCELED') {
      throw new BadRequestException(`취소된 작업지시입니다: ${orderNo}`);
    }
    const { processType: _processType, ...order } = row;
    return order;
  }

  private async assertWorker(qr: QueryRunner, workerId: string, company: string, plant: string) {
    const rows: unknown[] = await qr.query(
      `SELECT 1 FROM WORKER_MASTERS WHERE COMPANY = :1 AND PLANT_CD = :2 AND WORKER_CODE = :3 AND USE_YN = 'Y'`,
      [company, plant, workerId],
    );
    if (rows.length === 0) throw new BadRequestException(`사용중인 작업자가 아닙니다: ${workerId}`);
  }

  private async loadVisualChecks(manager: EntityManager, company: string, plant: string) {
    const rows: Array<{ code: string; name: string }> = await manager.query(
      `SELECT DETAIL_CODE AS "code", CODE_NAME AS "name" FROM COM_CODES
        WHERE COMPANY = :1 AND PLANT_CD = :2 AND GROUP_CODE = 'CRIMP_VISUAL_CHECK' AND USE_YN = 'Y'
        ORDER BY SORT_ORDER, DETAIL_CODE`,
      [company, plant],
    );
    return rows;
  }

  /** BOM 단자 사이드별로 전선과 압착 규격을 정한다 */
  private async resolveSides(
    manager: EntityManager,
    itemCode: string,
    company: string,
    plant: string,
  ): Promise<CrimpInspectSide[]> {
    const children = await findBomChildren(manager, [itemCode], company, plant);
    const terminals = children.filter((c) => c.productType === 'TERMINAL');
    if (terminals.length === 0) return [];

    // 절단 반제품(또는 그 상위 서브어셈블리)을 압착하는 경우 — 반제품 BOM 을 단계별로 내려가
    // 전선이 처음 나오는 단계의 전선만 쓴다. 그 단계에 전선이 2종 이상이면 MULTI_WIRE 로 막는다.
    let wires = children.filter((c) => c.productType === 'WIRE');
    const visited = new Set([itemCode]);
    let level = children;
    for (let depth = 1; wires.length === 0 && depth <= BOM_WIRE_SEARCH_MAX_DEPTH; depth++) {
      const semiCodes = [...new Set(level.filter((c) => c.itemType === 'SEMI_PRODUCT').map((c) => c.childItemCode))]
        .filter((code) => !visited.has(code));
      if (semiCodes.length === 0) break;
      semiCodes.forEach((code) => visited.add(code));
      level = await findBomChildren(manager, semiCodes, company, plant);
      wires = level.filter((c) => c.productType === 'WIRE');
    }
    wires = wires.filter((w, i, arr) => arr.findIndex((x) => x.childItemCode === w.childItemCode) === i);
    const wire = wires.length === 1 ? wires[0] : null;

    const specRows: SpecRow[] = await manager.query(
      `SELECT SPEC_ID, TERMINAL_ITEM_CODE, WIRE_SIZE, WIRE_ITEM_CODE,
              CRIMP_HEIGHT_LSL, CRIMP_HEIGHT_USL, CRIMP_WIDTH_LSL, CRIMP_WIDTH_USL,
              INS_CRIMP_HEIGHT_LSL, INS_CRIMP_HEIGHT_USL, PULL_FORCE_MIN, STRIP_LENGTH_MIN, STRIP_LENGTH_MAX, APPLICATOR_CODE
         FROM TERMINAL_CRIMP_SPECS
        WHERE COMPANY = :1 AND PLANT_CD = :2 AND USE_YN = 'Y'
          AND TERMINAL_ITEM_CODE IN (${terminals.map((_, i) => `:${i + 3}`).join(', ')})`,
      [company, plant, ...terminals.map((t) => t.childItemCode)],
    );

    return terminals.map((t): CrimpInspectSide => {
      const base = {
        sideKey: t.childItemCode,
        side: t.side ?? null,
        terminalItemCode: t.childItemCode,
        terminalName: t.itemName,
        terminalSpec: t.spec,
        wireItemCode: wire?.childItemCode ?? null,
        wireName: wire?.itemName ?? null,
        wireSpec: wire?.spec ?? null,
      };
      if (!wire) return { ...base, status: wires.length === 0 ? 'NO_WIRE' : 'MULTI_WIRE', spec: null };
      const matched = specRows.filter(
        (s) => s.TERMINAL_ITEM_CODE === t.childItemCode && s.WIRE_ITEM_CODE === wire.childItemCode,
      );
      if (matched.length !== 1) return { ...base, status: matched.length === 0 ? 'NO_SPEC' : 'DUP_SPEC', spec: null };
      const s = matched[0];
      return {
        ...base,
        status: 'OK',
        spec: {
          specId: Number(s.SPEC_ID),
          wireSize: s.WIRE_SIZE,
          applicatorCode: s.APPLICATOR_CODE,
          crimpHeightLsl: s.CRIMP_HEIGHT_LSL,
          crimpHeightUsl: s.CRIMP_HEIGHT_USL,
          crimpWidthLsl: s.CRIMP_WIDTH_LSL,
          crimpWidthUsl: s.CRIMP_WIDTH_USL,
          insCrimpHeightLsl: s.INS_CRIMP_HEIGHT_LSL,
          insCrimpHeightUsl: s.INS_CRIMP_HEIGHT_USL,
          pullForceMin: s.PULL_FORCE_MIN,
          stripLengthMin: s.STRIP_LENGTH_MIN,
          stripLengthMax: s.STRIP_LENGTH_MAX,
        },
      };
    });
  }
}
