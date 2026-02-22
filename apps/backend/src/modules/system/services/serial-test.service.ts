/**
 * @file src/modules/system/services/serial-test.service.ts
 * @description 시리얼 포트 목록 조회 서비스
 *
 * 초보자 가이드:
 * 1. **listPorts**: 서버에 연결된 시리얼 포트 목록을 조회
 * 2. 실제 통신 테스트는 프론트엔드 Web Serial API로 수행
 * 3. serialport 패키지를 동적 import하여 미설치 시에도 앱 기동에 영향 없음
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';

@Injectable()
export class SerialTestService {
  private readonly logger = new Logger(SerialTestService.name);

  /** 사용 가능한 시리얼 포트 목록 */
  async listPorts() {
    try {
      const { SerialPort } = await import('serialport');
      const ports = await SerialPort.list();
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || null,
        serialNumber: p.serialNumber || null,
        vendorId: p.vendorId || null,
        productId: p.productId || null,
        pnpId: p.pnpId || null,
      }));
    } catch (error: unknown) {
      this.logger.error('시리얼 포트 목록 조회 실패', error);
      throw new BadRequestException(
        'serialport 패키지를 사용할 수 없습니다.',
      );
    }
  }
}
