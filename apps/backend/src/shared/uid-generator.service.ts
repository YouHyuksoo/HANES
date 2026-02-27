/**
 * @file uid-generator.service.ts
 * @description Oracle DB Function을 호출하여 matUid/prdUid/conUid를 채번하는 서비스
 *
 * 초보자 가이드:
 * 1. matUid: 자재시리얼 (자재 라벨 발행 시 1개당 1개 부여)
 * 2. prdUid: 제품시리얼 (제품 라벨 발행 시 1개당 1개 부여)
 * 3. conUid: 소모품시리얼 (소모품 라벨 발행 시 1개당 1개 부여)
 * 4. 채번 로직은 Oracle DB Function(F_GET_MAT_UID, F_GET_PRD_UID, F_GET_CON_UID) 내부에서 관리
 * 5. 트랜잭션 내에서 호출 시 QueryRunner를 전달
 */
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class UidGeneratorService {
  constructor(private readonly dataSource: DataSource) {}

  /** 트랜잭션 내에서 matUid(자재시리얼) 채번 */
  async nextMatUid(qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      'SELECT F_GET_MAT_UID() AS "uid" FROM DUAL',
    );
    return result[0].uid;
  }

  /** 트랜잭션 내에서 prdUid(제품시리얼) 채번 */
  async nextPrdUid(qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      'SELECT F_GET_PRD_UID() AS "uid" FROM DUAL',
    );
    return result[0].uid;
  }

  /** 트랜잭션 내에서 conUid(소모품시리얼) 채번 */
  async nextConUid(qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      'SELECT F_GET_CON_UID() AS "uid" FROM DUAL',
    );
    return result[0].uid;
  }
}
