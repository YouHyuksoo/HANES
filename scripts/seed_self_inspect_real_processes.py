# -*- coding: utf-8 -*-
"""
공정생품검사(SELF_INSPECT_ITEMS) 시드 — 실 라우팅 공정코드 기준.

배경: 기존 seed-self-inspect-items.sql 은 데모용 PRC-* 코드로 항목을 넣어
ROUTING_PROCESSES 가 실제 쓰는 코드(SASSY/MASSY/CRMPF/...)와 단절돼 있었다.
라우팅 "공정생품검사" 탭은 실 공정코드로 조회하므로 항목이 0건이었다.

이 스크립트는 실 공정코드 17종에 검사항목을 idempotent 하게 INSERT 한다.
- 측정형(MEASURE)은 LSL/USL/UNIT 을 예시값으로 채운다(실 규격은 추후 조정).
- 판정형(VISUAL)은 규격 없음.
- 자연키(COMPANY, PLANT_CD, PROCESS_CODE, ITEM_NAME)로 중복 방지 → 재실행 안전.
- 같은 데이터로 .sql 마이그레이션 파일도 생성한다.

사이트: JSHANES (COMPANY='40', PLANT_CD='1000')
실행: python scripts/seed_self_inspect_real_processes.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from execute_sql import get_connection  # noqa: E402

COMPANY = "40"
PLANT = "1000"
SITE = "JSHANES"

# (process_code, item_name, standard, method, timing, destructive, sort, item_type, unit, lsl, usl, sample_count)
M = "MEASURE"
V = "VISUAL"
D = "DIRECT"
G = "DELEGATE"

ITEMS = [
    # ATCUT 자동절단
    ("ATCUT", "전선 절단 길이 측정", "도면 기준 100±2mm", D, "FIRST,MID", 0, 1, M, "mm", 98, 102, 1),
    ("ATCUT", "절단면 상태 확인", "단면 직각, 심선 손상 없을 것", D, "FIRST,MID", 0, 2, V, None, None, None, 1),
    ("ATCUT", "전선 색상·규격 확인", "작업지시 지정 색상·단면적 일치", D, "FIRST", 0, 3, V, None, None, None, 1),
    # ATCNS 자동절단탈피
    ("ATCNS", "전선 절단 길이 측정", "도면 기준 100±2mm", D, "FIRST,MID", 0, 1, M, "mm", 98, 102, 1),
    ("ATCNS", "탈피 길이 측정", "도면 기준 6±0.5mm", D, "FIRST,MID", 0, 2, M, "mm", 5.5, 6.5, 1),
    ("ATCNS", "심선 단선 여부 확인", "심선 가닥 100% 유지", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # STRPB 양단탈피
    ("STRPB", "탈피 길이 측정", "도면 기준 6±0.5mm", D, "FIRST,MID", 0, 1, M, "mm", 5.5, 6.5, 1),
    ("STRPB", "절연체 손상 여부", "탈피 인접 피복 손상 없을 것", D, "FIRST,MID", 0, 2, V, None, None, None, 1),
    ("STRPB", "심선 단선 여부", "심선 가닥 100% 유지", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # SHDRM 편조제거
    ("SHDRM", "편조 제거 길이 측정", "도면 기준 10±1mm", D, "FIRST,MID", 0, 1, M, "mm", 9, 11, 1),
    ("SHDRM", "심선·편조 손상 여부", "심선/편조 찍힘·손상 없을 것", D, "FIRST,MID", 0, 2, V, None, None, None, 1),
    # CRMPF 전단압착
    ("CRMPF", "압착 높이(CH) 측정", "도면 기준 1.20±0.05mm", D, "FIRST,MID", 0, 1, M, "mm", 1.15, 1.25, 1),
    ("CRMPF", "압착 폭(CW) 측정", "도면 기준 2.00±0.10mm", D, "FIRST", 0, 2, M, "mm", 1.90, 2.10, 1),
    ("CRMPF", "인장강도 시험 (Pull test)", "규격 이상 하중에서 단선 없을 것", G, "FIRST", 1, 3, M, "N", 60, None, 3),
    ("CRMPF", "압착 단면 검사 (CS)", "단면 원형, 절연체·도체 비율 기준 내", G, "FIRST", 1, 4, V, None, None, None, 1),
    ("CRMPF", "절연체 손상 여부", "절연 피복 찍힘·손상 없을 것", D, "FIRST,MID,LAST", 0, 5, V, None, None, None, 1),
    # CRMPR 후단압착
    ("CRMPR", "압착 높이(CH) 측정", "도면 기준 1.20±0.05mm", D, "FIRST,MID", 0, 1, M, "mm", 1.15, 1.25, 1),
    ("CRMPR", "인장강도 시험 (Pull test)", "규격 이상 하중에서 단선 없을 것", G, "FIRST", 1, 2, M, "N", 60, None, 3),
    ("CRMPR", "압착 단면 검사 (CS)", "단면 원형, 절연체·도체 비율 기준 내", G, "FIRST", 1, 3, V, None, None, None, 1),
    ("CRMPR", "절연체 손상 여부", "절연 피복 찍힘·손상 없을 것", D, "FIRST,MID,LAST", 0, 4, V, None, None, None, 1),
    # HEXCP 육각압착
    ("HEXCP", "대변 거리(육각) 측정", "도면 기준 7.2±0.2mm", D, "FIRST,MID", 0, 1, M, "mm", 7.0, 7.4, 1),
    ("HEXCP", "인장강도 시험 (Pull test)", "규격 이상 하중에서 단선 없을 것", G, "FIRST", 1, 2, M, "N", 120, None, 3),
    ("HEXCP", "압착부 크랙 여부", "압착부 균열·크랙 없을 것", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # WELDR 후단융착
    ("WELDR", "융착부 인장강도", "규격 이상 하중에서 분리 없을 것", G, "FIRST", 1, 1, M, "N", 80, None, 3),
    ("WELDR", "융착 높이 측정", "도면 기준 1.5±0.2mm", D, "FIRST,MID", 0, 2, M, "mm", 1.3, 1.7, 1),
    ("WELDR", "융착부 외관 확인", "융착부 박리·기공 없을 것", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # TUBHT 튜브열처리
    ("TUBHT", "열처리 온도", "수축 적정 온도 120~180℃", D, "FIRST,MID", 0, 1, M, "℃", 120, 180, 1),
    ("TUBHT", "튜브 위치·길이", "도면 기준 20±2mm", D, "FIRST,MID", 0, 2, M, "mm", 18, 22, 1),
    ("TUBHT", "튜브 수축 상태", "수축 균일, 들뜸·터짐 없을 것", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # MTASY 자재장착
    ("MTASY", "부품 장착 위치 확인", "도면 지정 위치에 장착", D, "FIRST,MID", 0, 1, V, None, None, None, 1),
    ("MTASY", "체결 토크 측정", "규격 토크 2.0±0.2N·m", D, "FIRST,MID", 0, 2, M, "N·m", 1.8, 2.2, 1),
    ("MTASY", "부품 누락 여부", "BOM 기준 부품 누락 없을 것", D, "FIRST,MID,LAST", 0, 3, V, None, None, None, 1),
    # AUXMT 부자재장착
    ("AUXMT", "부자재 누락 여부", "도면 지정 부자재 누락 없을 것", D, "FIRST,MID", 0, 1, V, None, None, None, 1),
    ("AUXMT", "클립 간격 측정", "도면 기준 50±5mm", D, "FIRST,MID", 0, 2, M, "mm", 45, 55, 1),
    ("AUXMT", "클립·밴드 체결 상태", "고정류 체결 견고, 이탈 없을 것", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # SASSY 서브조립
    ("SASSY", "커넥터 체결 상태", "딸깍 체결, 불완전 체결 없을 것", D, "FIRST,MID,LAST", 0, 1, V, None, None, None, 1),
    ("SASSY", "전선 배열 순서 확인", "회로도 기준 핀 배열 일치", D, "FIRST,MID", 0, 2, V, None, None, None, 1),
    ("SASSY", "서브조립 길이 측정", "도면 기준 300±5mm", D, "FIRST,MID", 0, 3, M, "mm", 295, 305, 1),
    # MASSY 조립
    ("MASSY", "커넥터 체결 상태", "딸깍 체결, 불완전 체결 없을 것", D, "FIRST,MID,LAST", 0, 1, V, None, None, None, 1),
    ("MASSY", "회로 배열 확인", "회로도 기준 결선 일치", D, "FIRST,MID", 0, 2, V, None, None, None, 1),
    ("MASSY", "전장(전체 길이) 측정", "도면 기준 500±5mm", D, "FIRST,MID", 0, 3, M, "mm", 495, 505, 1),
    ("MASSY", "도통 검사", "전체 회로 도통 OK, 오결선 없을 것", G, "FIRST", 0, 4, V, None, None, None, 1),
    # TAPPN 배판작업(테이핑)
    ("TAPPN", "테이핑 피치 확인", "테이프 겹침 1/2 이상, 빈틈 없을 것", D, "FIRST,MID", 0, 1, V, None, None, None, 1),
    ("TAPPN", "분기점 위치 측정", "도면 기준 150±5mm", D, "FIRST,MID", 0, 2, M, "mm", 145, 155, 1),
    ("TAPPN", "테이프 종류·색상 확인", "작업지시 지정 테이프 사용", D, "FIRST", 0, 3, V, None, None, None, 1),
    # TINSP 단자검사
    ("TINSP", "단자 삽입력 측정", "규격 삽입력 10~40N", D, "FIRST,MID", 0, 1, M, "N", 10, 40, 1),
    ("TINSP", "단자 정위치(걸림) 확인", "단자 풀백 없이 정위치 걸림", D, "FIRST,MID,LAST", 0, 2, V, None, None, None, 1),
    ("TINSP", "단자 휨·변형 여부", "단자 휨·변형·손상 없을 것", D, "FIRST,MID", 0, 3, V, None, None, None, 1),
    # OINSP 외관검사
    ("OINSP", "외관 손상 확인", "찍힘·긁힘·오염 없을 것", D, "FIRST,MID,LAST", 0, 1, V, None, None, None, 1),
    ("OINSP", "라벨 부착 상태", "품번·Lot·수량 정확, 오부착 없을 것", D, "FIRST,LAST", 0, 2, V, None, None, None, 1),
    ("OINSP", "전선 색상·규격 확인", "작업지시 지정 색상·규격 일치", D, "FIRST", 0, 3, V, None, None, None, 1),
    # AINSP 통합검사
    ("AINSP", "도통 검사", "전체 회로 도통 OK, 오결선 없을 것", G, "FIRST", 0, 1, V, None, None, None, 1),
    ("AINSP", "절연 저항 측정", "500V 인가 시 1MΩ 이상", G, "FIRST", 0, 2, M, "MΩ", 1, None, 1),
    ("AINSP", "내전압 시험", "1000V 1분 인가 시 절연 파괴 없을 것", G, "FIRST", 0, 3, V, None, None, None, 1),
    ("AINSP", "최종 외관 확인", "찍힘·긁힘·오염 없을 것", D, "LAST", 0, 4, V, None, None, None, 1),
]

INSERT_SQL = """
INSERT INTO SELF_INSPECT_ITEMS
  (ID, PROCESS_CODE, ITEM_NAME, STANDARD, INSPECT_METHOD, TIMING, IS_DESTRUCTIVE,
   SORT_ORDER, USE_YN, ITEM_TYPE, UNIT, LSL_VALUE, USL_VALUE, SAMPLE_COUNT,
   COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT SYS_GUID(), :pc, :nm, :std, :method, :timing, :destr,
       :sort, 'Y', :itype, :unit, :lsl, :usl, :scnt,
       :company, :plant, SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM SELF_INSPECT_ITEMS
  WHERE COMPANY = :company AND PLANT_CD = :plant
    AND PROCESS_CODE = :pc AND ITEM_NAME = :nm
)
"""


def run():
    conn = get_connection(SITE)
    cur = conn.cursor()
    inserted = 0
    for (pc, nm, std, method, timing, destr, sort, itype, unit, lsl, usl, scnt) in ITEMS:
        cur.execute(INSERT_SQL, {
            "pc": pc, "nm": nm, "std": std, "method": method, "timing": timing,
            "destr": destr, "sort": sort, "itype": itype, "unit": unit,
            "lsl": lsl, "usl": usl, "scnt": scnt,
            "company": COMPANY, "plant": PLANT,
        })
        inserted += cur.rowcount
    conn.commit()
    print(f"[OK] inserted {inserted} new items (of {len(ITEMS)} defined; existing skipped)")
    # verify per-process
    cur.execute("""
        SELECT PROCESS_CODE, COUNT(*),
               SUM(CASE WHEN ITEM_TYPE='MEASURE' THEN 1 ELSE 0 END)
        FROM SELF_INSPECT_ITEMS
        WHERE COMPANY=:c AND PLANT_CD=:p
          AND PROCESS_CODE IN ('ATCUT','ATCNS','STRPB','SHDRM','CRMPF','CRMPR','HEXCP',
                               'WELDR','TUBHT','MTASY','AUXMT','SASSY','MASSY','TAPPN',
                               'TINSP','OINSP','AINSP')
        GROUP BY PROCESS_CODE ORDER BY PROCESS_CODE
    """, {"c": COMPANY, "p": PLANT})
    print("=== 실 공정코드별 검사항목 (총 / 측정형) ===")
    for r in cur.fetchall():
        print(f"  {r[0]:8} 총 {r[1]} (측정형 {r[2]})")
    conn.close()


if __name__ == "__main__":
    run()
