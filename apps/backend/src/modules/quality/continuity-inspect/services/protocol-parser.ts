/**
 * @file protocol-parser.ts
 * @description EQUIP_PROTOCOLS 설정에 따라 장비 raw 데이터를 토큰 분해하는 순수 함수
 *
 * 초보자 가이드:
 * 1. dataStartChar/dataEndChar로 프레임을 잘라내고 delimiter로 토큰을 나눈다.
 * 2. resultIndex 토큰이 passValue와 같으면 passYn='Y', 아니면 'N'.
 * 3. 불합격이고 errorIndex 토큰이 있으면 errorCode로 사용한다.
 * 4. valueIndex가 설정돼 있으면 해당 토큰을 숫자로 변환해 measuredValue로 돌려준다.
 *    변환 실패(비숫자/토큰 없음)나 valueIndex 미설정이면 null.
 *
 * 통전검사(autoInspect)와 계측기 수치 수신(POST /quality/measurements)이 함께 쓴다.
 */
import type { EquipProtocol } from '../../../../entities/equip-protocol.entity';

export interface ParsedProtocolData {
  passYn: 'Y' | 'N';
  errorCode: string | null;
  /** valueIndex 토큰의 숫자값. valueIndex 미설정/비숫자면 null */
  measuredValue: number | null;
}

type ProtocolParseRule = Pick<
  EquipProtocol,
  'delimiter' | 'resultIndex' | 'passValue' | 'errorIndex' | 'dataStartChar' | 'dataEndChar'
> & { valueIndex?: number | null };

/** 토큰 문자열을 유한한 숫자로 변환. 빈 문자열/비숫자/Infinity는 null */
export function parseMeasuredToken(token: string | undefined): number | null {
  if (token === undefined) return null;
  const trimmed = token.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseProtocolData(rawData: string, protocol: ProtocolParseRule): ParsedProtocolData {
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
  const passYn: 'Y' | 'N' =
    resultValue.toUpperCase() === protocol.passValue.toUpperCase() ? 'Y' : 'N';

  let errorCode: string | null = null;
  if (passYn === 'N' && protocol.errorIndex != null && parts[protocol.errorIndex]) {
    errorCode = parts[protocol.errorIndex];
  }

  const measuredValue =
    protocol.valueIndex != null ? parseMeasuredToken(parts[protocol.valueIndex]) : null;

  return { passYn, errorCode, measuredValue };
}
