/**
 * @file src/modules/production/services/subprocess-kitting.service.ts
 * @description 서브공정 키팅 서비스 — 완제품 작업지시의 서브공정에서 스캔된 반제품 묶음(SG_LABELS)에서
 *              가닥을 소비해 제품라벨(FG_LABELS)을 발행하고 genealogy(PRODUCT_GENEALOGY)를 남기며
 *              제품 WIP 재고(WIP_MAIN)를 올린다.
 *
 * 핵심 원칙:
 * - 단일 트랜잭션(this.tx.run) 내에서 채번/저장/재고적재를 모두 처리한다.
 * - 모든 쿼리는 멀티테넌시(company / PLANT_CD) 스코프를 적용한다.
 * - 채번은 모두 동일한 QueryRunner(qr)를 전달한다.
 * - cancel()은 본 범위에서 구현하지 않는다(별도 후속).
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { AutoIssueService } from './auto-issue.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ProductGenealogy } from '../../../entities/product-genealogy.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { KitDto, ConfirmAssemblyDto, ConfirmSubKitDto } from '../dto/subprocess-kitting.dto';
import { In } from 'typeorm';
import { ProductionSpecificationService } from './production-specification.service';
import { HarnessCircuitSpec } from '../../../entities/harness-circuit-spec.entity';

/** 제품 WIP 공정창고 코드 — 생산실적 자동 적재(adsorbProductStockInTx)와 동일하게 WIP_MAIN 사용 */
const WIP_WAREHOUSE = 'WIP_MAIN';

@Injectable()
export class SubprocessKittingService {
  private readonly logger = new Logger(SubprocessKittingService.name);

  constructor(
    @InjectRepository(SgLabel)
    private readonly sgLabelRepository: Repository<SgLabel>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(BomMaster)
    private readonly bomMasterRepository: Repository<BomMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
    private readonly productInventory: ProductInventoryService,
    private readonly wipMatStockService: WipMatStockService,
    private readonly autoIssueService: AutoIssueService,
    private readonly productionSpec: ProductionSpecificationService,
  ) {}

  /**
   * 서브공정 키팅 — FG 발행 + SG 소비 + genealogy + 제품 WIP 재고 적재.
   * @returns { resultNo, fgBarcodes }
   */
  /**
   * 현재 공정이 제품(FG) 라벨 인쇄 공정인지 판정한다(라우팅 ISSUE_FG_LABEL_YN='Y').
   * FG 데이터는 항상 발행하되, 프린터 출력 여부만 이 플래그로 제어한다.
   * routingCode/processCode 가 없으면 인쇄하지 않는다(false).
   */
  private async isFgPrintProcess(
    qr: QueryRunner,
    routingCode: string | null | undefined,
    processCode: string | null | undefined,
    tenant: { company: string; plant: string },
  ): Promise<boolean> {
    if (!routingCode || !processCode) return false;
    const step = await qr.manager.findOne(RoutingProcess, {
      where: { routingCode, processCode, ...tenant },
    });
    return step?.issueFgLabelYn === 'Y';
  }

  async kit(
    dto: KitDto,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<{ resultNo: string; fgBarcodes: string[]; printFg: boolean }> {
    const tenantWhere = { company, plant };

    return this.tx.run(async (qr) => {
      // 1. 작업지시 조회 + 완제품 검증
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo: dto.orderNo, ...tenantWhere },
        relations: ['part'],
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
      }
      if (jobOrder.part?.itemType !== 'FINISHED') {
        throw new BadRequestException('완제품 작업지시만 키팅 가능합니다.');
      }

      // 2. 완제품 BOM의 반제품(SEMI_PRODUCT) 자식 종류 조회 (RAW 자식은 이 단계에서 무시 — matLots로 별도)
      const bomRows = await qr.manager.find(BomMaster, {
        where: { parentItemCode: jobOrder.itemCode, useYn: 'Y', ...tenantWhere },
      });
      if (bomRows.length === 0) {
        throw new BadRequestException(`완제품 BOM이 없습니다: ${jobOrder.itemCode}`);
      }

      // 자식 품목의 itemType 조회 → SEMI_PRODUCT 만 화이트리스트로 채택
      const childCodes = [...new Set(bomRows.map((b) => b.childItemCode))];
      const childParts = await qr.manager.find(PartMaster, {
        where: { itemCode: In(childCodes), ...tenantWhere },
        select: ['itemCode', 'itemType'],
      });
      const semiCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'SEMI_PRODUCT').map((p) => p.itemCode),
      );
      // 원자재(RAW_MATERIAL) 자식 화이트리스트 — matLots(직접투입) 검증용
      const rawCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'RAW_MATERIAL').map((p) => p.itemCode),
      );
      // itemCode → qtyPer 매핑 (SEMI 자식만)
      const qtyPerByItem = new Map<string, number>();
      for (const b of bomRows) {
        if (semiCodeSet.has(b.childItemCode)) {
          qtyPerByItem.set(b.childItemCode, Number(b.qtyPer));
        }
      }
      if (qtyPerByItem.size === 0) {
        throw new BadRequestException(
          `완제품 BOM에 반제품(SEMI_PRODUCT) 자식이 없습니다: ${jobOrder.itemCode}`,
        );
      }

      // 3. 스캔된 SG 검증 (status / remainQty / 화이트리스트)
      const sgBarcodes = [...new Set(dto.sgBarcodes)];
      const sgLabels = await qr.manager.find(SgLabel, {
        where: { sgBarcode: In(sgBarcodes), ...tenantWhere },
      });
      const foundSet = new Set(sgLabels.map((s) => s.sgBarcode));
      const missing = sgBarcodes.filter((b) => !foundSet.has(b));
      if (missing.length > 0) {
        throw new BadRequestException(`존재하지 않는 SG 라벨: ${missing.join(', ')}`);
      }
      for (const sg of sgLabels) {
        if (!['IN_STOCK', 'MOUNTED'].includes(sg.status)) {
          throw new BadRequestException(
            `사용할 수 없는 SG 라벨 상태입니다: ${sg.sgBarcode} (${sg.status})`,
          );
        }
        if (sg.remainQty <= 0) {
          throw new BadRequestException(`잔량이 없는 SG 라벨입니다: ${sg.sgBarcode}`);
        }
        if (!semiCodeSet.has(sg.itemCode)) {
          throw new BadRequestException(
            `BOM에 없는 반제품 SG 라벨입니다: ${sg.sgBarcode} (${sg.itemCode})`,
          );
        }
      }

      // 4. 용량 검증 — 각 SEMI 자식 itemCode에 대해 required vs available
      for (const [itemCode, qtyPer] of qtyPerByItem) {
        const required = dto.qty * qtyPer;
        const available = sgLabels
          .filter((s) => s.itemCode === itemCode)
          .reduce((sum, s) => sum + s.remainQty, 0);
        if (available < required) {
          throw new BadRequestException(
            `재고 부족: ${itemCode} 필요 ${required}, 가용 ${available}`,
          );
        }
      }

      // 5. 제품 루프 — 제품 수량만큼 FG 발행 + SG 소비 + genealogy.
      //    genealogy는 row를 모았다가 루프 종료 후 ID 일괄 채번·일괄 저장(N+1 회피).
      const fgBarcodes: string[] = [];
      const genealogyRows: Array<Partial<ProductGenealogy>> = [];
      for (let i = 0; i < dto.qty; i++) {
        // FG 발행
        const fg = await this.numbering.nextFgBarcode(qr);
        await qr.manager.save(FgLabel, {
          fgBarcode: fg,
          itemCode: jobOrder.itemCode,
          orderNo: dto.orderNo,
          status: 'ISSUED',
          equipCode: dto.equipCode ?? null,
          workerId: workerId ?? null,
          inspectPassYn: null,
          company,
          plant,
        });
        fgBarcodes.push(fg);

        // 각 SEMI 자식 itemCode 별로 qtyPer 만큼 FIFO 소비
        for (const [itemCode, qtyPer] of qtyPerByItem) {
          let need = qtyPer;
          // 해당 itemCode 의 SG 중 잔량 있는 것을 FIFO(issuedAt ASC) 정렬
          const candidates = sgLabels
            .filter((s) => s.itemCode === itemCode && s.remainQty > 0)
            .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
          for (const sg of candidates) {
            if (need <= 0) break;
            if (sg.remainQty <= 0) continue;
            const take = Math.min(need, sg.remainQty);
            sg.remainQty -= take;
            sg.status = sg.remainQty === 0 ? 'CONSUMED' : 'MOUNTED';
            sg.currentProcessCode = dto.processCode;
            await qr.manager.save(SgLabel, sg);

            genealogyRows.push({
              parentType: 'FG',
              parentKey: fg,
              childType: 'SG',
              childKey: sg.sgBarcode,
              itemCode: sg.itemCode,
              qty: take,
              processCode: dto.processCode,
              circuitNo: dto.circuitNo ?? null,
              company,
              plant,
            });
            need -= take;
          }
          // 용량 검증을 통과했으므로 need 는 0이 되어야 한다. 방어적 체크.
          if (need > 0) {
            throw new BadRequestException(
              `재고 부족: ${itemCode} (제품 ${i + 1}/${dto.qty} 처리 중 잔량 소진)`,
            );
          }
        }

        // matLots(원자재 직접투입) — genealogy(FG←MAT_LOT)는 각 FG에 대해 기록(기존 동작 유지).
        // 실제 재고 차감은 FG 루프와 별개로 1회만 수행(아래 5-1).
        if (dto.matLots && dto.matLots.length > 0) {
          for (const lot of dto.matLots) {
            genealogyRows.push({
              parentType: 'FG',
              parentKey: fg,
              childType: 'MAT_LOT',
              childKey: lot.matUid,
              itemCode: lot.itemCode,
              qty: lot.qty ?? 1,
              processCode: dto.processCode,
              circuitNo: dto.circuitNo ?? null,
              company,
              plant,
            });
          }
        }
      }

      // 5-2. genealogy ID 일괄 채번 후 일괄 저장.
      const kitGenIds = await this.numbering.nextGenealogyIds(qr, genealogyRows.length);
      genealogyRows.forEach((row, idx) => {
        row.genealogyId = kitGenIds[idx];
      });
      if (genealogyRows.length > 0) {
        await qr.manager.save(ProductGenealogy, genealogyRows);
      }

      // 6. 생산실적 1건
      const resultNo = await this.numbering.nextProdResultNo(qr);
      const now = new Date();
      await qr.manager.save(ProdResult, {
        resultNo,
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        goodQty: dto.qty,
        defectQty: 0,
        status: 'DONE',
        startAt: now,
        endAt: now,
        equipCode: dto.equipCode ?? null,
        workerId: workerId ?? null,
        company,
        plant,
      });

      // 6-1. matLots(직접투입 원자재) 실제 재고 차감 — FG 루프와 별개로 1회 처리.
      //   · 화이트리스트: 완제품 BOM의 RAW_MATERIAL 자식만 허용.
      //   · equipCode 있고 해당 LOT가 공정재고(WIP_MAT_STOCKS)에 있으면 → 공정재고 차감.
      //   · 아니면 → 원자재창고(MAT_STOCKS) 차감(auto-issue fallback 저수준 경로 재사용).
      //   · qty 의미: dto의 qty(스캔 입력) 신뢰, 없으면 1 (BOM qtyPer 자동계산은 범위 밖).
      //   · 부족/미존재면 BadRequest로 throw → 트랜잭션 롤백.
      if (dto.matLots && dto.matLots.length > 0) {
        await this.deductMatLotsInTx(qr, {
          matLots: dto.matLots,
          rawCodeSet,
          equipCode: dto.equipCode ?? null,
          orderNo: dto.orderNo,
          resultNo,
          workerId: workerId ?? null,
          company,
          plant,
        });
      }

      // 7. 제품 WIP 재고 +qty (WIP_MAIN). 품목+창고 단일행 집계 적재.
      await this.productInventory.receiveStockInTx(qr, {
        warehouseId: WIP_WAREHOUSE,
        itemCode: jobOrder.itemCode,
        itemType: 'FINISHED',
        qty: dto.qty,
        transType: 'WIP_IN',
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        refType: 'KITTING',
        refId: resultNo,
        workerId: workerId ?? undefined,
        remark: '서브공정 키팅 적재',
        company,
        plant,
      });

      this.logger.log(
        `서브공정 키팅: ${jobOrder.itemCode} × ${dto.qty} → ${WIP_WAREHOUSE} (실적 #${resultNo}, FG ${fgBarcodes.length}건)`,
      );

      const printFg = await this.isFgPrintProcess(qr, jobOrder.routingCode, dto.processCode, { company, plant });
      return { resultNo, fgBarcodes, printFg };
    });
  }

  /**
   * 조립 라벨 발행 (② FG 채번 + ISSUED 저장).
   * SG·자재·실적·재고는 미반영. return { fgBarcode }.
   */
  async issueLabel(
    orderNo: string,
    equipCode: string,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<{ fgBarcode: string }> {
    const tenantWhere = { company, plant };

    return this.tx.run(async (qr) => {
      // 1. 작업지시 조회 + 완제품 검증
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo, ...tenantWhere },
        relations: ['part'],
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
      }
      if (jobOrder.part?.itemType !== 'FINISHED') {
        throw new BadRequestException('완제품 작업지시만 라벨 발행 가능합니다.');
      }
      // 작업지시 상태 가드 — 완료/취소/홀딩 작업지시에는 라벨 발행 불가
      if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
        throw new BadRequestException('완료되거나 취소된 작업지시에는 라벨을 발행할 수 없습니다.');
      }
      if (jobOrder.status === 'HOLD') {
        throw new BadRequestException('홀딩된 작업지시에는 라벨을 발행할 수 없습니다.');
      }

      // 2. FG 바코드 채번
      const fgBarcode = await this.numbering.nextFgBarcode(qr);

      // 3. FgLabel status='ISSUED' 저장 (SG·자재·실적·재고 미반영)
      await qr.manager.save(FgLabel, {
        fgBarcode,
        itemCode: jobOrder.itemCode,
        orderNo,
        status: 'ISSUED',
        equipCode,
        workerId: workerId ?? null,
        inspectPassYn: null,
        company,
        plant,
      });

      this.logger.log(`조립 라벨 발행: ${fgBarcode} (orderNo=${orderNo}, equip=${equipCode})`);
      return { fgBarcode };
    });
  }

  /**
   * 조립 확정 (③ 실물 FG 라벨 스캔 → 단일 트랜잭션).
   * genealogy(FG→SG, FG→MAT_LOT) + SG 소비 + 설비 WIP 자재 BOM 차감 + ProdResult + FG WIP 재고.
   * return { resultNo, fgBarcode }.
   */
  async confirmAssembly(
    dto: ConfirmAssemblyDto,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<{ resultNo: string; fgBarcode: string; printFg: boolean }> {
    const tenantWhere = { company, plant };
    const { fgBarcode, orderNo, equipCode, processCode, circuitNo } = dto;

    return this.tx.run(async (qr) => {
      // 1. FgLabel 조회 — status='ISSUED' + orderNo 일치 확인
      const fgLabel = await qr.manager.findOne(FgLabel, {
        where: { fgBarcode, ...tenantWhere },
      });
      if (!fgLabel) {
        throw new BadRequestException(`FG 라벨을 찾을 수 없습니다: ${fgBarcode}`);
      }
      if (fgLabel.status !== 'ISSUED') {
        throw new BadRequestException(
          `FG 라벨 상태가 ISSUED가 아닙니다: ${fgBarcode} (${fgLabel.status})`,
        );
      }
      if (fgLabel.orderNo !== orderNo) {
        throw new BadRequestException(
          `FG 라벨의 작업지시가 일치하지 않습니다: ${fgBarcode} (라벨=${fgLabel.orderNo ?? '-'}, 요청=${orderNo})`,
        );
      }

      // 중복 확정 방지: 이미 genealogy가 있으면 거부
      const existingGenealogy = await qr.manager.findOne(ProductGenealogy, {
        where: { parentType: 'FG', parentKey: fgBarcode, company, plant },
      });
      if (existingGenealogy) {
        throw new BadRequestException(`이미 확정된 FG 라벨입니다: ${fgBarcode}`);
      }

      // 2. 작업지시 + 완제품 BOM 조회 (kit 패턴)
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo, ...tenantWhere },
        relations: ['part'],
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
      }
      if (jobOrder.part?.itemType !== 'FINISHED') {
        throw new BadRequestException('완제품 작업지시만 조립 확정 가능합니다.');
      }
      // 작업지시 상태 가드 — prod-result.service 등록 규칙과 동일
      if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
        throw new BadRequestException('완료되거나 취소된 작업지시에는 조립을 확정할 수 없습니다.');
      }
      if (jobOrder.status === 'HOLD') {
        throw new BadRequestException('홀딩된 작업지시에는 조립을 확정할 수 없습니다.');
      }

      const bomRows = await qr.manager.find(BomMaster, {
        where: { parentItemCode: jobOrder.itemCode, useYn: 'Y', ...tenantWhere },
      });
      if (bomRows.length === 0) {
        throw new BadRequestException(`완제품 BOM이 없습니다: ${jobOrder.itemCode}`);
      }

      const childCodes = [...new Set(bomRows.map((b) => b.childItemCode))];
      const childParts = await qr.manager.find(PartMaster, {
        where: { itemCode: In(childCodes), ...tenantWhere },
        select: ['itemCode', 'itemType'],
      });
      const semiCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'SEMI_PRODUCT').map((p) => p.itemCode),
      );
      const rawCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'RAW_MATERIAL').map((p) => p.itemCode),
      );
      // rawCodeSet qtyPer 매핑
      const rawQtyPerByItem = new Map<string, number>();
      for (const b of bomRows) {
        if (rawCodeSet.has(b.childItemCode)) {
          rawQtyPerByItem.set(b.childItemCode, Number(b.qtyPer));
        }
      }

      // 3. 스캔된 SG 검증 (오투입 포함)
      const sgBarcodes = [...new Set(dto.sgBarcodes)];
      const sgLabels = await qr.manager.find(SgLabel, {
        where: { sgBarcode: In(sgBarcodes), ...tenantWhere },
      });
      const foundSet = new Set(sgLabels.map((s) => s.sgBarcode));
      const missing = sgBarcodes.filter((b) => !foundSet.has(b));
      if (missing.length > 0) {
        throw new BadRequestException(`존재하지 않는 SG 라벨: ${missing.join(', ')}`);
      }
      for (const sg of sgLabels) {
        if (!['IN_STOCK', 'MOUNTED'].includes(sg.status)) {
          throw new BadRequestException(
            `사용할 수 없는 SG 라벨 상태입니다: ${sg.sgBarcode} (${sg.status})`,
          );
        }
        if (sg.remainQty <= 0) {
          throw new BadRequestException(`잔량이 없는 SG 라벨입니다: ${sg.sgBarcode}`);
        }
        if (!semiCodeSet.has(sg.itemCode)) {
          throw new BadRequestException(
            `BOM에 없는 반제품 SG 라벨입니다(오투입): ${sg.sgBarcode} (${sg.itemCode})`,
          );
        }
      }

      // 4. SG 1씩 소비 + genealogy(FG→SG, qty:1).
      //    genealogy ID는 N+1 회피를 위해 일괄 채번 후 인덱스로 분배.
      const sgGenIds = await this.numbering.nextGenealogyIds(qr, sgLabels.length);
      for (let i = 0; i < sgLabels.length; i++) {
        const sg = sgLabels[i];
        sg.remainQty -= 1;
        sg.status = sg.remainQty === 0 ? 'CONSUMED' : 'MOUNTED';
        sg.currentProcessCode = processCode;
        await qr.manager.save(SgLabel, sg);

        await qr.manager.save(ProductGenealogy, {
          genealogyId: sgGenIds[i],
          parentType: 'FG',
          parentKey: fgBarcode,
          childType: 'SG',
          childKey: sg.sgBarcode,
          itemCode: sg.itemCode,
          qty: 1,
          processCode,
          circuitNo: circuitNo ?? null,
          company,
          plant,
        });
      }

      // 5. 설비 WIP 자재 BOM 소요량 차감 + genealogy(FG→MAT_LOT) per lot.
      //    제품 수량 1 고정이므로 qtyPer = 1개분 소요량.
      //    차감으로 확정된 LOT 목록을 먼저 모은 뒤 genealogy ID를 일괄 채번(N+1 회피).
      const resultNoForRef = await this.numbering.nextProdResultNo(qr);
      const matGenRows: Array<{ matUid: string; itemCode: string; qty: number }> = [];
      for (const [itemCode, qtyPer] of rawQtyPerByItem) {
        const deductedLots = await this.wipMatStockService.deductStockInTx(qr, {
          equipCode,
          itemCode,
          qty: qtyPer,
          transType: 'PROD_CONSUME',
          refType: 'ASSEMBLY',
          refId: resultNoForRef,
          orderNo,
          stockPolicy: 'BLOCK',
          workerId: workerId ?? null,
          company,
          plant,
        });
        for (const lot of deductedLots) {
          matGenRows.push({ matUid: lot.matUid, itemCode, qty: lot.qty });
        }
      }
      const matGenIds = await this.numbering.nextGenealogyIds(qr, matGenRows.length);
      for (let i = 0; i < matGenRows.length; i++) {
        const row = matGenRows[i];
        await qr.manager.save(ProductGenealogy, {
          genealogyId: matGenIds[i],
          parentType: 'FG',
          parentKey: fgBarcode,
          childType: 'MAT_LOT',
          childKey: row.matUid,
          itemCode: row.itemCode,
          qty: row.qty,
          processCode,
          circuitNo: circuitNo ?? null,
          company,
          plant,
        });
      }

      // 6. ProdResult 저장
      const now = new Date();
      await qr.manager.save(ProdResult, {
        resultNo: resultNoForRef,
        orderNo,
        processCode,
        goodQty: 1,
        defectQty: 0,
        status: 'DONE',
        startAt: now,
        endAt: now,
        equipCode,
        workerId: workerId ?? null,
        company,
        plant,
      });

      // 6-1. 실적이 최초 등록되면 작업지시를 RUNNING으로 승격(prod-result.service와 동일).
      if (jobOrder.status === 'WAITING') {
        await qr.manager.update(
          JobOrder,
          { orderNo, ...tenantWhere },
          { status: 'RUNNING', startAt: now },
        );
      }

      // 7. FG WIP 재고 적재 (kit와 동일: productInventory.receiveStockInTx)
      await this.productInventory.receiveStockInTx(qr, {
        warehouseId: WIP_WAREHOUSE,
        itemCode: jobOrder.itemCode,
        itemType: 'FINISHED',
        qty: 1,
        transType: 'WIP_IN',
        orderNo,
        processCode,
        refType: 'ASSEMBLY',
        refId: resultNoForRef,
        workerId: workerId ?? undefined,
        remark: '조립 확정 WIP 적재',
        company,
        plant,
      });

      this.logger.log(
        `조립 확정: ${fgBarcode} → ${WIP_WAREHOUSE} (실적 #${resultNoForRef})`,
      );

      const printFg = await this.isFgPrintProcess(qr, jobOrder.routingCode, processCode, { company, plant });
      return { resultNo: resultNoForRef, fgBarcode, printFg };
    });
  }

  /**
   * 서브공정 키팅 SG 라벨 발행 (② 새 SG 채번 + ISSUED 저장).
   * 입력 SG·자재·실적·재고는 미반영. confirmAssembly의 issueLabel 대칭(FG→새 SG).
   * @returns { sgBarcode }
   */
  async issueSgLabel(
    dto: { orderNo: string; processCode: string; equipCode?: string },
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<{ sgBarcode: string }> {
    const tenantWhere = { company, plant };

    return this.tx.run(async (qr) => {
      // 1. 작업지시 조회 + 반제품 검증
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo: dto.orderNo, ...tenantWhere },
        relations: ['part'],
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
      }
      if (jobOrder.part?.itemType !== 'SEMI_PRODUCT') {
        throw new BadRequestException('반제품 작업지시만 SG 라벨 발행 가능합니다.');
      }
      // 작업지시 상태 가드 — 완료/취소/홀딩 작업지시에는 라벨 발행 불가
      if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
        throw new BadRequestException('완료되거나 취소된 작업지시에는 라벨을 발행할 수 없습니다.');
      }
      if (jobOrder.status === 'HOLD') {
        throw new BadRequestException('홀딩된 작업지시에는 라벨을 발행할 수 없습니다.');
      }

      // 2. SG 바코드 채번 (기존 SG 발행과 동일 유틸 — SEQ_SG_LABEL)
      const sgBarcode = await this.numbering.nextSgLabel(qr);

      // 3. SgLabel status='ISSUED' 저장 (확정 전까지 재고 오인 방지). 입력 SG·자재·실적·재고 미반영.
      await qr.manager.save(SgLabel, {
        sgBarcode,
        itemCode: jobOrder.itemCode,
        orderNo: dto.orderNo,
        resultNo: null,
        issueProcessCode: dto.processCode,
        currentProcessCode: dto.processCode,
        mountedEquipCode: dto.equipCode ?? null,
        initQty: 1,
        remainQty: 1,
        status: 'ISSUED',
        workerId: workerId ?? null,
        company,
        plant,
      });

      this.logger.log(
        `서브 키팅 SG 발행: ${sgBarcode} (orderNo=${dto.orderNo}, process=${dto.processCode})`,
      );
      return { sgBarcode };
    });
  }

  /**
   * 서브공정 키팅 확정 (③ 실물 새 SG 라벨 스캔 → 단일 트랜잭션).
   * genealogy(SG→입력SG, SG→MAT_LOT) + 입력 SG 소비 + 설비 WIP 자재 BOM 차감 +
   * 새 SG IN_STOCK 승격 + ProdResult + SEMI_PRODUCT WIP 재고.
   * confirmAssembly 대칭(FG→새 SG, 자식SG→입력SG).
   * @returns { resultNo, sgBarcode }
   */
  async confirmSubKit(
    dto: ConfirmSubKitDto,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<{ resultNo: string; sgBarcode: string }> {
    const tenantWhere = { company, plant };
    const { newSgBarcode, orderNo, equipCode, processCode, circuitNo } = dto;

    return this.tx.run(async (qr) => {
      // 1. 새 SgLabel 조회 — status='ISSUED' + orderNo 일치 확인
      const newSg = await qr.manager.findOne(SgLabel, {
        where: { sgBarcode: newSgBarcode, ...tenantWhere },
      });
      if (!newSg) {
        throw new BadRequestException(`SG 라벨을 찾을 수 없습니다: ${newSgBarcode}`);
      }
      if (newSg.status !== 'ISSUED') {
        throw new BadRequestException(
          `SG 라벨 상태가 ISSUED가 아닙니다: ${newSgBarcode} (${newSg.status})`,
        );
      }
      if (newSg.orderNo !== orderNo) {
        throw new BadRequestException(
          `SG 라벨의 작업지시가 일치하지 않습니다: ${newSgBarcode} (라벨=${newSg.orderNo ?? '-'}, 요청=${orderNo})`,
        );
      }

      // 중복 확정 방지: 이미 genealogy가 있으면 거부
      const existingGenealogy = await qr.manager.findOne(ProductGenealogy, {
        where: { parentType: 'SG', parentKey: newSgBarcode, company, plant },
      });
      if (existingGenealogy) {
        throw new BadRequestException(`이미 확정된 SG 라벨입니다: ${newSgBarcode}`);
      }

      // 2. 작업지시 + 반제품 BOM 조회
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo, ...tenantWhere },
        relations: ['part'],
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
      }
      if (jobOrder.part?.itemType !== 'SEMI_PRODUCT') {
        throw new BadRequestException('반제품 작업지시만 키팅 확정 가능합니다.');
      }
      if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
        throw new BadRequestException('완료되거나 취소된 작업지시에는 키팅을 확정할 수 없습니다.');
      }
      if (jobOrder.status === 'HOLD') {
        throw new BadRequestException('홀딩된 작업지시에는 키팅을 확정할 수 없습니다.');
      }

      // 회로 필수 검증 — 회로가 있는 품목이면 circuitNo 없이 확정 불가.
      // 회로 정보는 아래 genealogy(SG→입력SG, SG→MAT_LOT)의 CIRCUIT_NO로만 남으므로,
      // 누락 시 추적 데이터가 비게 된다. 프론트 가드와 대칭으로 서버에서도 강제한다.
      const orderCircuits = await this.productionSpec.findCircuitsByItemCode(
        jobOrder.itemCode,
        company,
        plant,
      );
      if (orderCircuits.length > 0 && !circuitNo) {
        throw new BadRequestException('회로를 선택해야 키팅을 확정할 수 있습니다.');
      }

      const bomRows = await qr.manager.find(BomMaster, {
        where: { parentItemCode: jobOrder.itemCode, useYn: 'Y', ...tenantWhere },
      });
      if (bomRows.length === 0) {
        throw new BadRequestException(`반제품 BOM이 없습니다: ${jobOrder.itemCode}`);
      }

      const childCodes = [...new Set(bomRows.map((b) => b.childItemCode))];
      const childParts = await qr.manager.find(PartMaster, {
        where: { itemCode: In(childCodes), ...tenantWhere },
        select: ['itemCode', 'itemType'],
      });
      const semiCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'SEMI_PRODUCT').map((p) => p.itemCode),
      );
      const rawCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'RAW_MATERIAL').map((p) => p.itemCode),
      );
      const rawQtyPerByItem = new Map<string, number>();
      for (const b of bomRows) {
        if (rawCodeSet.has(b.childItemCode)) {
          rawQtyPerByItem.set(b.childItemCode, Number(b.qtyPer));
        }
      }

      // 3. 스캔된 입력 SG 검증 (오투입 포함)
      const sgBarcodes = [...new Set(dto.inputSgBarcodes)];
      if (sgBarcodes.includes(newSgBarcode)) {
        throw new BadRequestException('새 SG 라벨을 입력 SG로 사용할 수 없습니다.');
      }
      const sgLabels = await qr.manager.find(SgLabel, {
        where: { sgBarcode: In(sgBarcodes), ...tenantWhere },
      });
      const foundSet = new Set(sgLabels.map((s) => s.sgBarcode));
      const missing = sgBarcodes.filter((b) => !foundSet.has(b));
      if (missing.length > 0) {
        throw new BadRequestException(`존재하지 않는 SG 라벨: ${missing.join(', ')}`);
      }
      for (const sg of sgLabels) {
        if (!['IN_STOCK', 'MOUNTED'].includes(sg.status)) {
          throw new BadRequestException(
            `사용할 수 없는 SG 라벨 상태입니다: ${sg.sgBarcode} (${sg.status})`,
          );
        }
        if (sg.remainQty <= 0) {
          throw new BadRequestException(`잔량이 없는 SG 라벨입니다: ${sg.sgBarcode}`);
        }
        if (!semiCodeSet.has(sg.itemCode)) {
          throw new BadRequestException(
            `BOM에 없는 반제품 SG 라벨입니다(오투입): ${sg.sgBarcode} (${sg.itemCode})`,
          );
        }
      }

      // 4. 입력 SG 1씩 소비 + genealogy(SG→입력SG, qty:1). genealogy ID 일괄 채번.
      const sgGenIds = await this.numbering.nextGenealogyIds(qr, sgLabels.length);
      for (let i = 0; i < sgLabels.length; i++) {
        const sg = sgLabels[i];
        sg.remainQty -= 1;
        sg.status = sg.remainQty === 0 ? 'CONSUMED' : 'MOUNTED';
        sg.currentProcessCode = processCode;
        await qr.manager.save(SgLabel, sg);

        await qr.manager.save(ProductGenealogy, {
          genealogyId: sgGenIds[i],
          parentType: 'SG',
          parentKey: newSgBarcode,
          childType: 'SG',
          childKey: sg.sgBarcode,
          itemCode: sg.itemCode,
          qty: 1,
          processCode,
          circuitNo: circuitNo ?? null,
          company,
          plant,
        });
      }

      // 5. 설비 WIP 자재 BOM 소요량 차감 + genealogy(SG→MAT_LOT) per lot.
      //    설비를 선택한 경우에만 차감(자재를 걸어 쓰는 흐름). 제품 수량 1 고정.
      const resultNoForRef = await this.numbering.nextProdResultNo(qr);
      const matGenRows: Array<{ matUid: string; itemCode: string; qty: number }> = [];
      if (equipCode) {
        for (const [itemCode, qtyPer] of rawQtyPerByItem) {
          const deductedLots = await this.wipMatStockService.deductStockInTx(qr, {
            equipCode,
            itemCode,
            qty: qtyPer,
            transType: 'PROD_CONSUME',
            refType: 'SUBKIT',
            refId: resultNoForRef,
            orderNo,
            stockPolicy: 'BLOCK',
            workerId: workerId ?? null,
            company,
            plant,
          });
          for (const lot of deductedLots) {
            matGenRows.push({ matUid: lot.matUid, itemCode, qty: lot.qty });
          }
        }
      }
      const matGenIds = await this.numbering.nextGenealogyIds(qr, matGenRows.length);
      for (let i = 0; i < matGenRows.length; i++) {
        const row = matGenRows[i];
        await qr.manager.save(ProductGenealogy, {
          genealogyId: matGenIds[i],
          parentType: 'SG',
          parentKey: newSgBarcode,
          childType: 'MAT_LOT',
          childKey: row.matUid,
          itemCode: row.itemCode,
          qty: row.qty,
          processCode,
          circuitNo: circuitNo ?? null,
          company,
          plant,
        });
      }

      // 6. 새 SG 승격: ISSUED → IN_STOCK + resultNo 채움 + currentProcessCode.
      newSg.status = 'IN_STOCK';
      newSg.resultNo = resultNoForRef;
      newSg.currentProcessCode = processCode;
      await qr.manager.save(SgLabel, newSg);

      // 7. ProdResult 저장
      const now = new Date();
      await qr.manager.save(ProdResult, {
        resultNo: resultNoForRef,
        orderNo,
        processCode,
        goodQty: 1,
        defectQty: 0,
        status: 'DONE',
        startAt: now,
        endAt: now,
        equipCode: equipCode ?? null,
        workerId: workerId ?? null,
        company,
        plant,
      });

      // 7-1. 실적 최초 등록 시 작업지시 RUNNING 승격(prod-result.service와 동일).
      if (jobOrder.status === 'WAITING') {
        await qr.manager.update(
          JobOrder,
          { orderNo, ...tenantWhere },
          { status: 'RUNNING', startAt: now },
        );
      }

      // 8. 반제품 WIP 재고 +1 (WIP_MAIN). 품목+창고 단일행 집계 적재.
      await this.productInventory.receiveStockInTx(qr, {
        warehouseId: WIP_WAREHOUSE,
        itemCode: jobOrder.itemCode,
        itemType: 'SEMI_PRODUCT',
        qty: 1,
        transType: 'WIP_IN',
        orderNo,
        processCode,
        refType: 'SUBKIT',
        refId: resultNoForRef,
        workerId: workerId ?? undefined,
        remark: '서브 키팅 확정 WIP 적재',
        company,
        plant,
      });

      this.logger.log(
        `서브 키팅 확정: ${newSgBarcode} → ${WIP_WAREHOUSE} (실적 #${resultNoForRef})`,
      );

      return { resultNo: resultNoForRef, sgBarcode: newSgBarcode };
    });
  }

  /**
   * 작업지시 기준 회로 목록 조회 — 키팅 화면 회로 선택 칸 데이터 소스.
   * 작업지시 itemCode → 도면 회로(production-specification 재사용). 회로 없으면 빈 배열.
   */
  async getCircuitsByOrder(
    orderNo: string,
    company: string,
    plant: string,
  ): Promise<Array<{ circuitNo: string; wireSpec: string | null; colorName: string | null }>> {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, company, plant },
    });
    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }
    const circuits: HarnessCircuitSpec[] = await this.productionSpec.findCircuitsByItemCode(
      jobOrder.itemCode,
      company,
      plant,
    );
    return circuits.map((c) => ({
      circuitNo: c.circuitNo,
      wireSpec: c.wireSpec ?? null,
      colorName: c.colorName ?? null,
    }));
  }

  /**
   * matLots(직접투입 원자재 LOT) 실제 재고 차감 + 수불 기록.
   * - kit() 트랜잭션 내에서 1회 호출(FG 루프와 별개).
   * - 각 LOT: RAW_MATERIAL 화이트리스트 검증 → equipCode+공정재고 보유 시 WIP 차감, 아니면 원자재창고 차감.
   * - genealogy(FG←MAT_LOT) 기록은 호출부(kit)에서 별도로 이미 처리됨(차감과 genealogy 둘 다 남음).
   */
  private async deductMatLotsInTx(
    qr: QueryRunner,
    p: {
      matLots: { matUid: string; itemCode: string; qty?: number }[];
      rawCodeSet: Set<string>;
      equipCode: string | null;
      orderNo: string;
      resultNo: string;
      workerId: string | null;
      company: string;
      plant: string;
    },
  ): Promise<void> {
    for (const lot of p.matLots) {
      // 1) BOM RAW_MATERIAL 자식 화이트리스트 검증
      if (!p.rawCodeSet.has(lot.itemCode)) {
        throw new BadRequestException(
          `BOM에 없는 원자재 직접투입 LOT입니다: ${lot.matUid} (${lot.itemCode})`,
        );
      }
      const qty = lot.qty ?? 1;
      if (qty <= 0) {
        throw new BadRequestException(`직접투입 수량이 올바르지 않습니다: ${lot.matUid} (${qty})`);
      }

      // 2) equipCode 있고 해당 LOT가 공정재고(WIP_MAT_STOCKS)에 존재하면 공정재고 차감
      let usedWip = false;
      if (p.equipCode) {
        const wipRow = await qr.manager.findOne(WipMatStock, {
          where: {
            company: p.company,
            plant: p.plant,
            equipCode: p.equipCode,
            itemCode: lot.itemCode,
            matUid: lot.matUid,
          },
        });
        if (wipRow) {
          // 지정 LOT 우선 차감(scannedMatUids) + 부족 시 예외(BLOCK)
          const deducted = await this.wipMatStockService.deductStockInTx(qr, {
            equipCode: p.equipCode,
            itemCode: lot.itemCode,
            qty,
            transType: 'PROD_CONSUME',
            refType: 'KITTING',
            refId: p.resultNo,
            orderNo: p.orderNo,
            scannedMatUids: [lot.matUid],
            stockPolicy: 'BLOCK',
            workerId: p.workerId,
            company: p.company,
            plant: p.plant,
          });
          // deductStockInTx는 (equip,item) FIFO라 다른 LOT가 차감될 수 있으므로 지정 LOT 일치 검증
          const tookSpecified = deducted.some((d) => d.matUid === lot.matUid);
          if (!tookSpecified) {
            throw new BadRequestException(
              `공정재고에서 지정 LOT를 차감하지 못했습니다: ${lot.matUid} (${lot.itemCode})`,
            );
          }
          usedWip = true;
        }
      }

      // 3) 공정재고 미사용 → 원자재창고(MAT_STOCKS) 지정 LOT 차감(auto-issue 저수준 경로 재사용)
      if (!usedWip) {
        await this.autoIssueService.consumeMatLotInTx(qr, {
          matUid: lot.matUid,
          itemCode: lot.itemCode,
          qty,
          orderNo: p.orderNo,
          prodResultNo: p.resultNo,
          refType: 'KITTING',
          refId: p.resultNo,
          workerId: p.workerId,
          company: p.company,
          plant: p.plant,
        });
      }
    }
  }

  /** 생산실적별 SG 라벨 목록 조회 — 서브공정 실적 등록 후 발행된 라벨 확인용 */
  async getSgLabelsByResult(
    resultNo: string,
    company: string,
    plant: string,
  ): Promise<SgLabel[]> {
    return this.sgLabelRepository.find({
      where: { resultNo, company, plant },
      order: { issuedAt: 'ASC' },
    });
  }

  /** 조립 요구사항 조회 — 완제품 작업지시의 BOM에서 SEMI_PRODUCT 자식 컴포넌트 목록 반환 */
  async getAssemblyRequirements(
    orderNo: string,
    company: string,
    plant: string,
  ): Promise<{
    orderNo: string;
    itemCode: string;
    itemName: string;
    planQty: number;
    components: Array<{
      itemCode: string;
      itemName: string;
      itemType: string;
      qtyPer: number;
      totalRequired: number;
    }>;
  }> {
    const tenantWhere = { company, plant };

    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...tenantWhere },
      relations: ['part'],
    });
    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }

    const bomRows = await this.bomMasterRepository.find({
      where: { parentItemCode: jobOrder.itemCode, useYn: 'Y', ...tenantWhere },
    });

    const childCodes = [...new Set(bomRows.map((b) => b.childItemCode))];
    const childParts =
      childCodes.length > 0
        ? await this.partMasterRepository.find({
            where: { itemCode: In(childCodes), ...tenantWhere },
            select: ['itemCode', 'itemName', 'itemType'],
          })
        : [];
    const partMap = new Map(childParts.map((p) => [p.itemCode, p]));

    const components = bomRows
      .filter((b) => partMap.get(b.childItemCode)?.itemType === 'SEMI_PRODUCT')
      .map((b) => {
        const part = partMap.get(b.childItemCode);
        return {
          itemCode: b.childItemCode,
          itemName: part?.itemName ?? b.childItemCode,
          itemType: 'SEMI_PRODUCT',
          qtyPer: Number(b.qtyPer),
          totalRequired: Number(jobOrder.planQty) * Number(b.qtyPer),
        };
      });

    return {
      orderNo,
      itemCode: jobOrder.itemCode,
      itemName: jobOrder.part?.itemName ?? jobOrder.itemCode,
      planQty: Number(jobOrder.planQty),
      components,
    };
  }

  /** SG 라벨 단건 조회 (tenant). 없으면 NotFound. */
  async getSgLabel(
    sgBarcode: string,
    company: string,
    plant: string,
  ): Promise<{
    sgBarcode: string;
    itemCode: string;
    remainQty: number;
    status: string;
    orderNo: string | null;
  }> {
    const sg = await this.sgLabelRepository.findOne({
      where: { sgBarcode, company, plant },
    });
    if (!sg) {
      throw new NotFoundException(`SG 라벨을 찾을 수 없습니다: ${sgBarcode}`);
    }
    return {
      sgBarcode: sg.sgBarcode,
      itemCode: sg.itemCode,
      remainQty: sg.remainQty,
      status: sg.status,
      orderNo: sg.orderNo,
    };
  }
}
