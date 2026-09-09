import {
  findOlderIssuableLot,
  getFifoDateKey,
  isLotExpired,
  normalizeFifoCriteria,
  toDayKey,
  isFifoApplicableToIssueType,
} from './fifo.rules';

describe('fifo.rules', () => {
  describe('toDayKey', () => {
    it('Date 는 로컬 날짜 YYYY-MM-DD 로 만든다(UTC 변환 금지)', () => {
      expect(toDayKey(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09');
      expect(toDayKey(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
    });

    it('ISO 문자열은 앞 10자리를 그대로 쓴다', () => {
      expect(toDayKey('2026-09-09T15:00:00.000Z')).toBe('2026-09-09');
      expect(toDayKey('2026-09-09')).toBe('2026-09-09');
    });

    it('null/빈값/잘못된 값은 null', () => {
      expect(toDayKey(null)).toBeNull();
      expect(toDayKey(undefined)).toBeNull();
      expect(toDayKey('')).toBeNull();
      expect(toDayKey('not-a-date')).toBeNull();
    });
  });

  describe('normalizeFifoCriteria', () => {
    it('null 은 RECEIVE_DATE, MFG_DATE 만 제조일 기준', () => {
      expect(normalizeFifoCriteria(null)).toBe('RECEIVE_DATE');
      expect(normalizeFifoCriteria(undefined)).toBe('RECEIVE_DATE');
      expect(normalizeFifoCriteria('RECEIVE_DATE')).toBe('RECEIVE_DATE');
      // 실DB(JSHANES) SYS_CONFIGS.FIFO_CRITERIA OPTIONS 값은 RCV_DATE — 입고일로 해석
      expect(normalizeFifoCriteria('RCV_DATE')).toBe('RECEIVE_DATE');
      expect(normalizeFifoCriteria('rcv_date')).toBe('RECEIVE_DATE');
      expect(normalizeFifoCriteria('MFG_DATE')).toBe('MFG_DATE');
      expect(normalizeFifoCriteria('mfg_date')).toBe('MFG_DATE');
      expect(normalizeFifoCriteria('UNKNOWN')).toBe('RECEIVE_DATE');
    });
  });

  describe('getFifoDateKey', () => {
    const lot = { matUid: 'L1', recvDate: new Date(2026, 8, 1), manufactureDate: new Date(2026, 7, 20) };

    it('RECEIVE_DATE 는 입고일, MFG_DATE 는 제조일', () => {
      expect(getFifoDateKey(lot, 'RECEIVE_DATE')).toBe('2026-09-01');
      expect(getFifoDateKey(lot, 'MFG_DATE')).toBe('2026-08-20');
    });
  });

  describe('findOlderIssuableLot', () => {
    const candidate = { matUid: 'NEW', recvDate: new Date(2026, 8, 5), manufactureDate: new Date(2026, 8, 1) };

    it('기준일이 더 빠른 LOT 가 있으면 그중 가장 오래된 LOT 를 돌려준다', () => {
      const others = [
        { matUid: 'MID', recvDate: new Date(2026, 8, 3), manufactureDate: null },
        { matUid: 'OLD', recvDate: new Date(2026, 8, 1), manufactureDate: null },
        { matUid: 'NEWER', recvDate: new Date(2026, 8, 7), manufactureDate: null },
      ];
      expect(findOlderIssuableLot(candidate, others, 'RECEIVE_DATE')?.matUid).toBe('OLD');
    });

    it('같은 날짜는 위반이 아니다', () => {
      const others = [{ matUid: 'SAME', recvDate: new Date(2026, 8, 5, 8, 0), manufactureDate: null }];
      expect(findOlderIssuableLot(candidate, others, 'RECEIVE_DATE')).toBeNull();
    });

    it('기준일이 null 인 LOT 는 비교 대상에서 제외한다', () => {
      const others = [
        { matUid: 'NO-DATE', recvDate: null, manufactureDate: null },
        { matUid: 'NEWER', recvDate: new Date(2026, 8, 9), manufactureDate: null },
      ];
      expect(findOlderIssuableLot(candidate, others, 'RECEIVE_DATE')).toBeNull();
    });

    it('후보 LOT 자신의 기준일이 null 이면 순서를 만들 수 없으므로 위반 없음', () => {
      const noDate = { matUid: 'NEW', recvDate: null, manufactureDate: null };
      const others = [{ matUid: 'OLD', recvDate: new Date(2026, 8, 1), manufactureDate: null }];
      expect(findOlderIssuableLot(noDate, others, 'RECEIVE_DATE')).toBeNull();
    });

    it('MFG_DATE 기준이면 제조일로 비교한다', () => {
      const others = [
        { matUid: 'OLD-MFG', recvDate: new Date(2026, 8, 8), manufactureDate: new Date(2026, 7, 15) },
      ];
      expect(findOlderIssuableLot(candidate, others, 'RECEIVE_DATE')).toBeNull();
      expect(findOlderIssuableLot(candidate, others, 'MFG_DATE')?.matUid).toBe('OLD-MFG');
    });

    it('자기 자신(matUid 동일)은 비교에서 뺀다', () => {
      const others = [{ matUid: 'NEW', recvDate: new Date(2026, 8, 1), manufactureDate: null }];
      expect(findOlderIssuableLot(candidate, others, 'RECEIVE_DATE')).toBeNull();
    });
  });

  describe('isLotExpired', () => {
    const today = new Date(2026, 8, 9, 10, 0);

    it('유효기한이 오늘보다 이전이면 만료', () => {
      expect(isLotExpired({ expireDate: new Date(2026, 8, 8) }, today)).toBe(true);
      expect(isLotExpired({ expireDate: '2026-09-08' }, today)).toBe(true);
    });

    it('유효기한이 오늘이거나 이후면 만료 아님', () => {
      expect(isLotExpired({ expireDate: new Date(2026, 8, 9, 0, 0) }, today)).toBe(false);
      expect(isLotExpired({ expireDate: new Date(2026, 8, 10) }, today)).toBe(false);
    });

    it('유효기한이 없으면 만료 아님', () => {
      expect(isLotExpired({ expireDate: null }, today)).toBe(false);
      expect(isLotExpired({}, today)).toBe(false);
    });
  });
});

describe('isFifoApplicableToIssueType', () => {
  it('REPAIR 는 FIFO_APPLY_REPAIR 가 false(기본 N) 면 적용 대상이 아니다', () => {
    expect(isFifoApplicableToIssueType('REPAIR', false)).toBe(false);
    expect(isFifoApplicableToIssueType('repair', false)).toBe(false);
  });
  it('REPAIR 는 FIFO_APPLY_REPAIR 가 true 면 적용 대상이다', () => {
    expect(isFifoApplicableToIssueType('REPAIR', true)).toBe(true);
  });
  it('그 외 출고 유형은 설정과 무관하게 적용 대상이다', () => {
    expect(isFifoApplicableToIssueType('PROD', false)).toBe(true);
    expect(isFifoApplicableToIssueType('OTHER', false)).toBe(true);
    expect(isFifoApplicableToIssueType(null, false)).toBe(true);
  });
});
