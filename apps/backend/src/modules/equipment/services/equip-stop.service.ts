/**
 * @file src/modules/equipment/services/equip-stop.service.ts
 * @description 설비정지 / 관리자호출 비즈니스 로직
 *
 * 초보자 가이드:
 * 1. **시각의 단일 출처는 DB**다. 정지/해제 시각과 경과초를 전부 SYSTIMESTAMP로 계산한다.
 *    키오스크 PC 시계가 틀어져 있어도, 화면을 껐다 켜도 유실시간이 흔들리지 않게 하기 위함이다.
 * 2. **설비당 진행중 정지는 1건**이다. UX_EQUIP_STOP_OPEN 유니크 인덱스가 DB에서 한 번 더 막는다.
 * 3. **사유미정 허용**: 정지는 사유 없이 시작할 수 있지만, 해제하려면 사유가 확정돼 있어야 한다.
 * 4. **해제 권한은 체크하지 않는다**(1단계). 누가 해제했는지 RELEASED_BY로 기록만 한다.
 * 5. 정지 시 EQUIP_MASTERS.STATUS를 'STOP'으로 바꾸되, **NORMAL일 때만** 바꾼다.
 *    MAINT/INTERLOCK 처럼 더 강한 상태를 정지가 덮어쓰면 안 된다.
 *    해제 시에는 **아직 STOP일 때만** 직전 상태로 되돌린다.
 *    정지 중에 금형수명/PM계획/센서룰/생산실적이 INTERLOCK을 걸 수 있는데,
 *    조건 없이 되돌리면 그 인터록을 조용히 풀어버린다(안전 역방향 실패).
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import {
  StartEquipStopDto,
  UpdateEquipStopReasonDto,
  ReleaseEquipStopDto,
  CreateEquipCallDto,
  AckEquipCallDto,
  EquipStopEventView,
  EquipStopSummary,
  EquipCallEventView,
} from '../dto/equip-stop.dto';

/** 정지 이벤트 조회 시 공통으로 쓰는 SELECT 목록 */
const STOP_SELECT = `
  STOP_ID           AS "stopId",
  EQUIP_CODE        AS "equipCode",
  JOB_ORDER_NO      AS "jobOrderNo",
  STOP_REASON       AS "stopReason",
  STOP_REMARK       AS "stopRemark",
  STATUS            AS "status",
  TO_CHAR(STARTED_AT, 'YYYY-MM-DD HH24:MI:SS')  AS "startedAt",
  STARTED_BY        AS "startedBy",
  TO_CHAR(RELEASED_AT, 'YYYY-MM-DD HH24:MI:SS') AS "releasedAt",
  RELEASED_BY       AS "releasedBy",
  RELEASE_REMARK    AS "releaseRemark",
  NVL(LOSS_SECONDS, ROUND((CAST(SYSTIMESTAMP AS DATE) - CAST(STARTED_AT AS DATE)) * 86400)) AS "lossSeconds"
`;

const CALL_SELECT = `
  CALL_ID       AS "callId",
  EQUIP_CODE    AS "equipCode",
  JOB_ORDER_NO  AS "jobOrderNo",
  CALL_TYPE     AS "callType",
  CALL_REMARK   AS "callRemark",
  STATUS        AS "status",
  TO_CHAR(CALLED_AT, 'YYYY-MM-DD HH24:MI:SS') AS "calledAt",
  CALLED_BY     AS "calledBy",
  TO_CHAR(ACKED_AT, 'YYYY-MM-DD HH24:MI:SS')  AS "ackedAt",
  ACKED_BY      AS "ackedBy",
  ACK_REMARK    AS "ackRemark",
  ROUND((CAST(NVL(ACKED_AT, SYSTIMESTAMP) AS DATE) - CAST(CALLED_AT AS DATE)) * 86400) AS "elapsedSeconds"
`;

@Injectable()
export class EquipStopService {
  private readonly logger = new Logger(EquipStopService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
  ) {}

  private assertTenant(company?: string, plant?: string): asserts company is string {
    if (!company || !plant) {
      throw new BadRequestException('회사/사업장 정보가 없습니다.');
    }
  }

  // ─────────────────────────── 설비정지 ───────────────────────────

  /** 진행중(OPEN) 정지 1건. 없으면 null */
  async findOpenStop(
    equipCode: string,
    company?: string,
    plant?: string,
  ): Promise<EquipStopEventView | null> {
    this.assertTenant(company, plant);
    const rows: EquipStopEventView[] = await this.dataSource.query(
      `SELECT ${STOP_SELECT}
         FROM EQUIP_STOP_EVENTS
        WHERE COMPANY = :1 AND PLANT_CD = :2 AND EQUIP_CODE = :3 AND STATUS = 'OPEN'`,
      [company, plant, equipCode],
    );
    return rows[0] ?? null;
  }

  /** 정지 시작. 이미 진행중이면 409 */
  async startStop(
    dto: StartEquipStopDto,
    company?: string,
    plant?: string,
    userId = 'system',
  ): Promise<EquipStopEventView> {
    this.assertTenant(company, plant);

    return this.tx.run(async (qr) => {
      const existing = await qr.manager.query(
        `SELECT STOP_ID FROM EQUIP_STOP_EVENTS
          WHERE COMPANY = :1 AND PLANT_CD = :2 AND EQUIP_CODE = :3 AND STATUS = 'OPEN'`,
        [company, plant, dto.equipCode],
      );
      if (existing.length > 0) {
        throw new ConflictException(
          `이미 정지 중인 설비입니다: ${dto.equipCode} (정지번호 ${existing[0].STOP_ID})`,
        );
      }

      const equipRows = await qr.manager.query(
        `SELECT STATUS FROM EQUIP_MASTERS
          WHERE EQUIP_CODE = :1 AND COMPANY = :2 AND PLANT_CD = :3`,
        [dto.equipCode, company, plant],
      );
      if (equipRows.length === 0) {
        throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);
      }
      const prevStatus: string | null = equipRows[0].STATUS ?? null;

      const seqRows = await qr.manager.query(
        `SELECT SEQ_EQUIP_STOP_EVENTS.NEXTVAL AS "nextId" FROM DUAL`,
      );
      const stopId: number = seqRows[0].nextId;

      await qr.manager.query(
        `INSERT INTO EQUIP_STOP_EVENTS (
           STOP_ID, COMPANY, PLANT_CD, EQUIP_CODE, JOB_ORDER_NO,
           STOP_REASON, STOP_REMARK, STATUS, STARTED_AT, STARTED_BY,
           PREV_EQUIP_STATUS, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
         ) VALUES (
           :1, :2, :3, :4, :5,
           :6, :7, 'OPEN', SYSTIMESTAMP, :8,
           :9, :10, :11, SYSTIMESTAMP, SYSTIMESTAMP
         )`,
        [
          stopId,
          company,
          plant,
          dto.equipCode,
          dto.jobOrderNo ?? null,
          dto.stopReason ?? null,
          dto.stopRemark ?? null,
          userId,
          prevStatus,
          userId,
          userId,
        ],
      );

      await qr.manager.query(
        `UPDATE EQUIP_MASTERS
            SET STATUS = 'STOP', UPDATED_BY = :1, UPDATED_AT = SYSTIMESTAMP
          WHERE EQUIP_CODE = :2 AND COMPANY = :3 AND PLANT_CD = :4
            AND STATUS = 'NORMAL'`,
        [userId, dto.equipCode, company, plant],
      );

      const rows: EquipStopEventView[] = await qr.manager.query(
        `SELECT ${STOP_SELECT} FROM EQUIP_STOP_EVENTS WHERE STOP_ID = :1`,
        [stopId],
      );
      this.logger.log(`설비정지 시작 stopId=${stopId} equip=${dto.equipCode} by=${userId}`);
      return rows[0];
    });
  }

  /** 사유 확정/변경. 해제된 정지도 사후 보정이 가능하다 */
  async updateReason(
    stopId: number,
    dto: UpdateEquipStopReasonDto,
    company?: string,
    plant?: string,
    userId = 'system',
  ): Promise<EquipStopEventView> {
    this.assertTenant(company, plant);
    const updated = await this.dataSource.query(
      `UPDATE EQUIP_STOP_EVENTS
          SET STOP_REASON = :1,
              STOP_REMARK = NVL(:2, STOP_REMARK),
              UPDATED_BY = :3,
              UPDATED_AT = SYSTIMESTAMP
        WHERE STOP_ID = :4 AND COMPANY = :5 AND PLANT_CD = :6`,
      [dto.stopReason, dto.stopRemark ?? null, userId, stopId, company, plant],
    );
    void updated;
    const rows: EquipStopEventView[] = await this.dataSource.query(
      `SELECT ${STOP_SELECT} FROM EQUIP_STOP_EVENTS
        WHERE STOP_ID = :1 AND COMPANY = :2 AND PLANT_CD = :3`,
      [stopId, company, plant],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`정지 이벤트를 찾을 수 없습니다: ${stopId}`);
    }
    return rows[0];
  }

  /** 해제. 사유가 확정돼 있어야 한다 */
  async releaseStop(
    stopId: number,
    dto: ReleaseEquipStopDto,
    company?: string,
    plant?: string,
    userId = 'system',
  ): Promise<EquipStopEventView> {
    this.assertTenant(company, plant);

    return this.tx.run(async (qr) => {
      const rows = await qr.manager.query(
        `SELECT STOP_ID, EQUIP_CODE, STOP_REASON, STATUS, PREV_EQUIP_STATUS
           FROM EQUIP_STOP_EVENTS
          WHERE STOP_ID = :1 AND COMPANY = :2 AND PLANT_CD = :3
          FOR UPDATE`,
        [stopId, company, plant],
      );
      if (rows.length === 0) {
        throw new NotFoundException(`정지 이벤트를 찾을 수 없습니다: ${stopId}`);
      }
      const event = rows[0];
      if (event.STATUS !== 'OPEN') {
        throw new ConflictException(`이미 해제된 정지입니다: ${stopId}`);
      }

      const reason: string | null = dto.stopReason ?? event.STOP_REASON ?? null;
      if (!reason) {
        throw new BadRequestException(
          '정지사유가 확정되지 않았습니다. 사유를 선택한 뒤 해제하세요.',
        );
      }

      await qr.manager.query(
        `UPDATE EQUIP_STOP_EVENTS
            SET STATUS = 'CLOSED',
                STOP_REASON = :1,
                RELEASED_AT = SYSTIMESTAMP,
                RELEASED_BY = :2,
                RELEASE_REMARK = :3,
                LOSS_SECONDS = ROUND((CAST(SYSTIMESTAMP AS DATE) - CAST(STARTED_AT AS DATE)) * 86400),
                UPDATED_BY = :4,
                UPDATED_AT = SYSTIMESTAMP
          WHERE STOP_ID = :5 AND STATUS = 'OPEN'`,
        [reason, userId, dto.releaseRemark ?? null, userId, stopId],
      );

      // 정지 직전 상태로 되돌린다. 기록이 없으면 NORMAL.
      // STATUS='STOP' 조건이 핵심이다 — 정지 중에 누군가 INTERLOCK을 걸었다면 그대로 둔다.
      await qr.manager.query(
        `UPDATE EQUIP_MASTERS
            SET STATUS = :1, UPDATED_BY = :2, UPDATED_AT = SYSTIMESTAMP
          WHERE EQUIP_CODE = :3 AND COMPANY = :4 AND PLANT_CD = :5
            AND STATUS = 'STOP'`,
        [event.PREV_EQUIP_STATUS ?? 'NORMAL', userId, event.EQUIP_CODE, company, plant],
      );

      const after: EquipStopEventView[] = await qr.manager.query(
        `SELECT ${STOP_SELECT} FROM EQUIP_STOP_EVENTS WHERE STOP_ID = :1`,
        [stopId],
      );
      this.logger.log(
        `설비정지 해제 stopId=${stopId} equip=${event.EQUIP_CODE} loss=${after[0]?.lossSeconds}s by=${userId}`,
      );
      return after[0];
    });
  }

  /**
   * 정지 이력 + 유실시간 집계.
   * 집계는 DB에서 끝낸다(메모리 집계 금지). from/to는 'YYYY-MM-DD'.
   */
  async findStops(
    params: { equipCode?: string; from?: string; to?: string; jobOrderNo?: string },
    company?: string,
    plant?: string,
  ): Promise<{ data: EquipStopEventView[]; summary: EquipStopSummary }> {
    this.assertTenant(company, plant);

    const binds: unknown[] = [company, plant];
    let where = 'COMPANY = :1 AND PLANT_CD = :2';
    if (params.equipCode) {
      binds.push(params.equipCode);
      where += ` AND EQUIP_CODE = :${binds.length}`;
    }
    if (params.jobOrderNo) {
      binds.push(params.jobOrderNo);
      where += ` AND JOB_ORDER_NO = :${binds.length}`;
    }
    if (params.from) {
      binds.push(params.from);
      where += ` AND STARTED_AT >= TO_TIMESTAMP(:${binds.length}, 'YYYY-MM-DD')`;
    }
    if (params.to) {
      binds.push(params.to);
      where += ` AND STARTED_AT < TO_TIMESTAMP(:${binds.length}, 'YYYY-MM-DD') + INTERVAL '1' DAY`;
    }

    const data: EquipStopEventView[] = await this.dataSource.query(
      `SELECT ${STOP_SELECT} FROM EQUIP_STOP_EVENTS
        WHERE ${where}
        ORDER BY STARTED_AT DESC`,
      binds,
    );
    const summaryRows = await this.dataSource.query(
      `SELECT COUNT(*) AS "stopCount",
              NVL(SUM(NVL(LOSS_SECONDS, ROUND((CAST(SYSTIMESTAMP AS DATE) - CAST(STARTED_AT AS DATE)) * 86400))), 0) AS "totalLossSeconds",
              SUM(CASE WHEN STATUS = 'OPEN' THEN 1 ELSE 0 END) AS "openCount"
         FROM EQUIP_STOP_EVENTS
        WHERE ${where}`,
      binds,
    );
    return {
      data,
      summary: {
        stopCount: Number(summaryRows[0]?.stopCount ?? 0),
        totalLossSeconds: Number(summaryRows[0]?.totalLossSeconds ?? 0),
        openCount: Number(summaryRows[0]?.openCount ?? 0),
      },
    };
  }

  // ─────────────────────────── 관리자호출 ───────────────────────────

  /** 진행중(OPEN) 호출 1건. 없으면 null */
  async findOpenCall(
    equipCode: string,
    company?: string,
    plant?: string,
  ): Promise<EquipCallEventView | null> {
    this.assertTenant(company, plant);
    const rows: EquipCallEventView[] = await this.dataSource.query(
      `SELECT ${CALL_SELECT}
         FROM EQUIP_CALL_EVENTS
        WHERE COMPANY = :1 AND PLANT_CD = :2 AND EQUIP_CODE = :3 AND STATUS = 'OPEN'`,
      [company, plant, equipCode],
    );
    return rows[0] ?? null;
  }

  /** 관리자호출 등록. 이미 호출중이면 409 */
  async createCall(
    dto: CreateEquipCallDto,
    company?: string,
    plant?: string,
    userId = 'system',
  ): Promise<EquipCallEventView> {
    this.assertTenant(company, plant);

    return this.tx.run(async (qr) => {
      const existing = await qr.manager.query(
        `SELECT CALL_ID FROM EQUIP_CALL_EVENTS
          WHERE COMPANY = :1 AND PLANT_CD = :2 AND EQUIP_CODE = :3 AND STATUS = 'OPEN'`,
        [company, plant, dto.equipCode],
      );
      if (existing.length > 0) {
        throw new ConflictException(
          `이미 호출 중입니다: ${dto.equipCode} (호출번호 ${existing[0].CALL_ID})`,
        );
      }

      const seqRows = await qr.manager.query(
        `SELECT SEQ_EQUIP_CALL_EVENTS.NEXTVAL AS "nextId" FROM DUAL`,
      );
      const callId: number = seqRows[0].nextId;

      await qr.manager.query(
        `INSERT INTO EQUIP_CALL_EVENTS (
           CALL_ID, COMPANY, PLANT_CD, EQUIP_CODE, JOB_ORDER_NO,
           CALL_TYPE, CALL_REMARK, STATUS, CALLED_AT, CALLED_BY,
           CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
         ) VALUES (
           :1, :2, :3, :4, :5,
           :6, :7, 'OPEN', SYSTIMESTAMP, :8,
           :9, :10, SYSTIMESTAMP, SYSTIMESTAMP
         )`,
        [
          callId,
          company,
          plant,
          dto.equipCode,
          dto.jobOrderNo ?? null,
          dto.callType,
          dto.callRemark ?? null,
          userId,
          userId,
          userId,
        ],
      );

      const rows: EquipCallEventView[] = await qr.manager.query(
        `SELECT ${CALL_SELECT} FROM EQUIP_CALL_EVENTS WHERE CALL_ID = :1`,
        [callId],
      );
      this.logger.log(`관리자호출 callId=${callId} equip=${dto.equipCode} type=${dto.callType}`);
      return rows[0];
    });
  }

  /** 호출 응대 처리 */
  async ackCall(
    callId: number,
    dto: AckEquipCallDto,
    company?: string,
    plant?: string,
    userId = 'system',
  ): Promise<EquipCallEventView> {
    this.assertTenant(company, plant);
    const rows = await this.dataSource.query(
      `SELECT STATUS FROM EQUIP_CALL_EVENTS
        WHERE CALL_ID = :1 AND COMPANY = :2 AND PLANT_CD = :3`,
      [callId, company, plant],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`호출 이력을 찾을 수 없습니다: ${callId}`);
    }
    if (rows[0].STATUS !== 'OPEN') {
      throw new ConflictException(`이미 응대된 호출입니다: ${callId}`);
    }

    await this.dataSource.query(
      `UPDATE EQUIP_CALL_EVENTS
          SET STATUS = 'ACKED',
              ACKED_AT = SYSTIMESTAMP,
              ACKED_BY = :1,
              ACK_REMARK = :2,
              UPDATED_BY = :3,
              UPDATED_AT = SYSTIMESTAMP
        WHERE CALL_ID = :4 AND STATUS = 'OPEN'`,
      [userId, dto.ackRemark ?? null, userId, callId],
    );
    const after: EquipCallEventView[] = await this.dataSource.query(
      `SELECT ${CALL_SELECT} FROM EQUIP_CALL_EVENTS WHERE CALL_ID = :1`,
      [callId],
    );
    return after[0];
  }

  /** 호출 이력 조회 */
  async findCalls(
    params: { equipCode?: string; from?: string; to?: string; onlyOpen?: boolean },
    company?: string,
    plant?: string,
  ): Promise<EquipCallEventView[]> {
    this.assertTenant(company, plant);

    const binds: unknown[] = [company, plant];
    let where = 'COMPANY = :1 AND PLANT_CD = :2';
    if (params.equipCode) {
      binds.push(params.equipCode);
      where += ` AND EQUIP_CODE = :${binds.length}`;
    }
    if (params.onlyOpen) {
      where += ` AND STATUS = 'OPEN'`;
    }
    if (params.from) {
      binds.push(params.from);
      where += ` AND CALLED_AT >= TO_TIMESTAMP(:${binds.length}, 'YYYY-MM-DD')`;
    }
    if (params.to) {
      binds.push(params.to);
      where += ` AND CALLED_AT < TO_TIMESTAMP(:${binds.length}, 'YYYY-MM-DD') + INTERVAL '1' DAY`;
    }

    return this.dataSource.query(
      `SELECT ${CALL_SELECT} FROM EQUIP_CALL_EVENTS
        WHERE ${where}
        ORDER BY CALLED_AT DESC`,
      binds,
    );
  }
}
