# -*- coding: utf-8 -*-
"""트랜잭션 데이터 전체 리셋 — 기준정보(마스터)/설정/권한/코드/템플릿/스펙만 보존.

마스터 KEEP 화이트리스트를 두고, user_tables 중 KEEP/_BAK/migrations 를 제외한
나머지 트랜잭션 테이블을 전부 비운다(작업지시→생산→검사→라벨/포장→재고→출하→자재→구매→소모품→로그).

FK 처리: 삭제 대상 테이블에 '걸린' 또는 '삭제 대상을 참조하는' R 제약만 비활성화 → DELETE → 재활성화.
마스터 제약은 건드리지 않는다.

채번 시퀀스(SEQ_FG_BARCODE, MAT_UID_SEQ 등)는 리셋하지 않는다(새 데이터는 이어서 채번).

사용:
  python tools/seed/reset_transactional_data.py            # dry-run (삭제 건수만, 실제 미반영)
  python tools/seed/reset_transactional_data.py --commit   # 실제 삭제 + commit
"""
import json
import os
import sys

import oracledb

SITE = "JSHANES"
COMMIT = "--commit" in sys.argv

# ---------------------------------------------------------------------------
# 보존(기준정보 + 설정 + 권한/메뉴 + 코드 + 템플릿/스펙/규칙 + 마스터형 계획)
# ---------------------------------------------------------------------------
KEEP = {
    # 코드 / 설정 / 채번
    "COM_CODES", "SYS_CONFIGS", "COMM_CONFIGS", "SEQ_RULES", "NUM_RULE_MASTERS",
    # 메뉴 / 권한 / 사용자 / 조직
    "MENU_CATEGORIES", "MENU_CATEGORY_ITEMS", "ROLES", "ROLE_MENU_PERMISSIONS",
    "PDA_ROLE", "PDA_ROLE_MENU", "USERS", "USER_AUTHS", "WORKER_MASTERS",
    "DEPARTMENT_MASTERS", "COMPANY_MASTERS", "PLANTS", "PROD_LINE_MASTERS",
    # 품목 / BOM / 라우팅 / 공정
    "ITEM_MASTERS", "BOM_MASTERS", "ROUTING_GROUPS", "ROUTING_PROCESSES", "ROUTING_MATERIALS",
    "PROCESS_MASTERS", "PROCESS_MAPS", "PROCESS_EQUIPMENTS", "PROCESS_QUALITY_CONDITIONS",
    "PROCESS_CAPAS", "MODEL_SUFFIXES",
    # 설비
    "EQUIP_MASTERS", "EQUIP_PROTOCOLS", "EQUIP_BOM_ITEMS", "EQUIP_BOM_RELS",
    "EQUIP_CONDITION_RULES", "EQUIP_INSPECT_ITEM_MASTERS", "EQUIP_INSPECT_ITEM_POOL",
    # 창고
    "WAREHOUSES", "WAREHOUSE_LOCATIONS", "WAREHOUSE_TRANSFER_RULES",
    # 파트너 / 벤더
    "PARTNER_MASTERS", "VENDOR_MASTERS", "VENDOR_BARCODE_MAPPINGS",
    # 품질 마스터
    "DEFECT_CODE_MASTERS", "DEFECT_CATEGORY_MASTERS", "DEFECT_CODE_PRODUCT_TYPES",
    "IQC_ITEM_MASTERS", "IQC_ITEM_POOL", "IQC_PART_SPECS", "IQC_PART_SPEC_ITEMS",
    "IQC_TEMPLATES", "IQC_TEMPLATE_ITEMS", "IQC_AQL_POLICIES", "AQL_STANDARDS",
    "AQL_SAMPLING_RULES", "SELF_INSPECT_ITEMS", "CONTROL_PLANS", "CONTROL_PLAN_ITEMS",
    "GAUGE_MASTERS",
    # 소모품 마스터
    "CONSUMABLE_MASTERS", "CONSUMABLE_USAGE_MAP",
    # 하네스 / 도면
    "HARNESS_CIRCUIT_SPECS", "HARNESS_DRAWING_MASTERS", "HARNESS_DRAWING_REVISIONS",
    # 문서 / 라벨 / 작업표준
    "DOCUMENT_MASTERS", "LABEL_TEMPLATES", "WORK_INSTRUCTIONS",
    # 달력 / 교대
    "WORK_CALENDARS", "WORK_CALENDAR_DAYS", "SHIFT_PATTERNS",
    # 금형
    "MOLD_MASTERS",
    # 예방보전 계획(마스터) — 사용자 보존 선택
    "PM_PLANS", "PM_PLAN_ITEMS",
    # 스케줄러 작업 정의 / SPC 차트 정의 / 교육계획(마스터)
    "SCHEDULER_JOBS", "SPC_CHARTS", "TRAINING_PLANS",
}


def connect():
    with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)["profiles"][SITE]
    return oracledb.connect(
        user=cfg["user"],
        password=cfg["password"],
        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}",
    )


def main():
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()

    # 전체 테이블 → 삭제 대상 산출(KEEP/_BAK/migrations 제외)
    cur.execute("SELECT table_name FROM user_tables")
    all_tables = [r[0] for r in cur.fetchall()]
    delete_set = sorted(
        t for t in all_tables
        if t not in KEEP and "BAK" not in t.upper() and t.upper() != "MIGRATIONS"
    )

    # 건수 측정
    print(f"[START] reset transactional data on {SITE}  mode={'COMMIT' if COMMIT else 'DRY-RUN'}")
    print(f"[SCOPE] 보존(마스터) {len(KEEP)}개 / 삭제 대상 {len(delete_set)}개\n")
    counts = {}
    total = 0
    for t in delete_set:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        c = cur.fetchone()[0]
        counts[t] = c
        total += c
    nonzero = {t: c for t, c in counts.items() if c}
    print(f"[DELETE-LIST] (행>0 인 테이블만 표기, 총 {len(delete_set)}개 / {total}행)")
    for t in sorted(nonzero, key=lambda x: -nonzero[x]):
        print(f"   {t:34s} {nonzero[t]:6d}")
    empty_n = len(delete_set) - len(nonzero)
    print(f"   ... (빈 테이블 {empty_n}개는 0행, 함께 비움)\n")

    if not COMMIT:
        print(">>> DRY-RUN: 실제 삭제하지 않음. 반영하려면 --commit")
        cur.close(); conn.close()
        return

    # FK 제약: 삭제대상에 걸렸거나 삭제대상을 참조하는 ENABLED R 제약만 비활성화
    cur.execute(
        """
        SELECT c.constraint_name, c.table_name AS child_tab, p.table_name AS parent_tab
          FROM user_constraints c
          JOIN user_constraints p
            ON p.owner = c.r_owner AND p.constraint_name = c.r_constraint_name
         WHERE c.constraint_type = 'R' AND c.status = 'ENABLED'
        """
    )
    ds = set(delete_set)
    fk_to_toggle = [
        (name, child) for (name, child, parent) in cur.fetchall()
        if child in ds or parent in ds
    ]
    print(f"[FK] 비활성화 대상 제약 {len(fk_to_toggle)}개")
    for name, child in fk_to_toggle:
        cur.execute(f'ALTER TABLE "{child}" DISABLE CONSTRAINT "{name}"')

    deleted_total = 0
    try:
        for t in delete_set:
            cur.execute(f'DELETE FROM "{t}"')
            n = cur.rowcount or 0
            deleted_total += n
            if n:
                print(f"   DEL {t:34s} {n:6d}")
        conn.commit()
        print(f"\n[DELETE_TOTAL] {deleted_total}  >>> COMMITTED")
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] 삭제 실패 → 롤백: {e}")
    finally:
        fail = []
        for name, child in fk_to_toggle:
            try:
                cur.execute(f'ALTER TABLE "{child}" ENABLE CONSTRAINT "{name}"')
            except Exception as e:  # noqa: BLE001
                fail.append((child, name, str(e)))
        if fail:
            print(f"\n[FK][WARN] 재활성화 실패 {len(fail)}개:")
            for child, name, msg in fail:
                print(f"   {child}.{name} :: {msg.splitlines()[0]}")
        else:
            print(f"[FK] 제약 {len(fk_to_toggle)}개 전부 재활성화 완료")

    # 사후 확인
    print("\n[AFTER] 남은 행 확인(0이어야 정상)")
    left = 0
    for t in delete_set:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        c = cur.fetchone()[0]
        if c:
            print(f"   ! {t:34s} {c}")
            left += c
    print(f"   잔여 {left}행")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
