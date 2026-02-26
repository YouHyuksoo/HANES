/**
 * @file services/label-print.service.ts
 * @description 라벨 인쇄 서비스 - ZPL 변수 치환, TCP/IP 전송, 발행 이력 관리
 *
 * 초보자 가이드:
 * 1. **generateZpl**: 템플릿 ZPL 코드에서 변수를 실제 LOT 데이터로 치환
 * 2. **printViaTcp**: TCP/IP로 Zebra 프린터에 ZPL 직접 전송 (옵션)
 * 3. **createLog**: 라벨 발행 이력 저장
 * 4. **findLogs**: 발행 이력 조회 (페이지네이션)
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as net from 'net';

import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { LabelTemplate } from '../../../entities/label-template.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  GenerateZplDto,
  TcpPrintDto,
  CreatePrintLogDto,
  PrintLogQueryDto,
} from '../dto/label-print.dto';

/** 날짜를 YYYY-MM-DD 형식 문자열로 변환 */
function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class LabelPrintService {
  constructor(
    @InjectRepository(LabelPrintLog)
    private readonly printLogRepo: Repository<LabelPrintLog>,
    @InjectRepository(LabelTemplate)
    private readonly templateRepo: Repository<LabelTemplate>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepo: Repository<PartMaster>,
  ) {}

  /**
   * ZPL 변수 치환 - 템플릿의 변수 플레이스홀더를 LOT 실제 데이터로 교체
   * @param dto templateId + matUids
   * @returns zplDataList(치환된 ZPL 배열), lotDetails(LOT 정보 배열)
   */
  async generateZpl(dto: GenerateZplDto) {
    const template = await this.templateRepo.findOne({
      where: { id: Number(dto.templateId) },
    });
    if (!template) {
      throw new NotFoundException(
        `템플릿을 찾을 수 없습니다: ${dto.templateId}`,
      );
    }
    if (!template.zplCode) {
      throw new BadRequestException(
        `해당 템플릿에 ZPL 코드가 설정되지 않았습니다: ${template.templateName}`,
      );
    }

    const zplDataList: string[] = [];
    const lotDetails: any[] = [];

    for (const matUid of dto.matUids) {
      const lot = await this.matLotRepo.findOne({ where: { matUid: matUid } });
      if (!lot) {
        throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
      }

      const part = await this.partMasterRepo.findOne({
        where: { itemCode: lot.itemCode },
      });

      // 변수 치환 맵
      const vars: Record<string, string> = {
        '{{matUid}}': lot.matUid,
        '{{itemCode}}': part?.itemCode ?? '',
        '{{itemName}}': part?.itemName ?? '',
        '{{qty}}': String(lot.initQty),
        '{{unit}}': part?.unit ?? 'EA',
        '{{vendor}}': lot.vendor ?? '',
        '{{recvDate}}': formatDate(lot.recvDate),
        '{{barcode}}': lot.matUid,
        '{{custom1}}': '',
        '{{custom2}}': '',
        '{{custom3}}': '',
        '{{custom4}}': '',
        '{{custom5}}': '',
      };

      let zpl = template.zplCode;
      for (const [placeholder, value] of Object.entries(vars)) {
        zpl = zpl.split(placeholder).join(value);
      }

      zplDataList.push(zpl);
      lotDetails.push({
        matUid: lot.matUid,
        itemCode: part?.itemCode ?? '',
        itemName: part?.itemName ?? '',
        qty: lot.initQty,
        unit: part?.unit ?? 'EA',
      });
    }

    return { zplDataList, lotDetails };
  }

  /**
   * TCP/IP로 Zebra 프린터에 ZPL 직접 전송
   * @param dto printerIp, port, zplData
   * @returns 성공/실패 메시지
   */
  async printViaTcp(
    dto: TcpPrintDto,
  ): Promise<{ success: boolean; message: string }> {
    const TIMEOUT_MS = 10_000;

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        reject(
          new BadRequestException(
            `프린터 연결 시간 초과 (${TIMEOUT_MS / 1000}초): ${dto.printerIp}:${dto.port}`,
          ),
        );
      }, TIMEOUT_MS);

      socket.connect(dto.port, dto.printerIp, () => {
        socket.write(dto.zplData, () => {
          clearTimeout(timer);
          socket.end();
          resolve({
            success: true,
            message: `ZPL 전송 완료: ${dto.printerIp}:${dto.port}`,
          });
        });
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        socket.destroy();
        reject(
          new BadRequestException(
            `프린터 연결 실패: ${dto.printerIp}:${dto.port} - ${err.message}`,
          ),
        );
      });
    });
  }

  /**
   * 라벨 발행 이력 저장
   * @param dto 발행 정보
   * @param company 회사코드 (테넌트)
   * @param plant 공장코드 (테넌트)
   */
  async createLog(
    dto: CreatePrintLogDto,
    company?: string,
    plant?: string,
  ): Promise<LabelPrintLog> {
    const log = this.printLogRepo.create({
      templateId: dto.templateId ? Number(dto.templateId) : null,
      category: dto.category,
      printMode: dto.printMode,
      printerName: dto.printerName ?? null,
      uidList: JSON.stringify(dto.uidList),
      labelCount: dto.labelCount,
      status: dto.status ?? 'SUCCESS',
      errorMsg: dto.errorMsg ?? null,
      company: company ?? null,
      plant: plant ?? null,
    });

    return this.printLogRepo.save(log);
  }

  /**
   * 발행 이력 조회 (페이지네이션)
   * @param query 필터 + 페이지네이션 파라미터
   * @param company 회사코드 (테넌트)
   * @param plant 공장코드 (테넌트)
   */
  async findLogs(query: PrintLogQueryDto, company?: string, plant?: string) {
    const {
      category,
      printMode,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.printLogRepo.createQueryBuilder('log');

    if (company) qb.andWhere('log.company = :company', { company });
    if (plant) qb.andWhere('log.plant = :plant', { plant });
    if (category) qb.andWhere('log.category = :category', { category });
    if (printMode) qb.andWhere('log.printMode = :printMode', { printMode });
    if (status) qb.andWhere('log.status = :status', { status });

    if (dateFrom && dateTo) {
      qb.andWhere('log.printedAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
      });
    } else if (dateFrom) {
      qb.andWhere('log.printedAt >= :dateFrom', {
        dateFrom: new Date(dateFrom),
      });
    } else if (dateTo) {
      qb.andWhere('log.printedAt <= :dateTo', {
        dateTo: new Date(dateTo),
      });
    }

    qb.orderBy('log.printedAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }
}
