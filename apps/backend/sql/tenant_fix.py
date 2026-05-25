"""테넌트 정정 — VNHNS/HANES-/NULL 데이터를 40/1000으로 마이그레이션.
PK 충돌(target에 동일 비즈니스키 존재) 검사 후 안전한 것만 UPDATE.
인자 없으면 dry-run, --apply 주면 실제 변경.
"""
import sys, json, os, oracledb

APPLY = '--apply' in sys.argv

# (table, src_company, src_plant)  → 항상 40/1000으로 이동. None=NULL
PLAN = [
    ('ROLES', '40', 'VNHNS'),
    ('WORK_CALENDARS', '40', 'VNHNS'),
    ('WORK_CALENDAR_DAYS', '40', 'VNHNS'),
    ('PROCESS_CAPAS', '40', 'VNHNS'),
    ('SHIFT_PATTERNS', '40', 'VNHNS'),
    ('CUSTOMER_ORDERS', '40', 'VNHNS'),
    ('CUSTOMER_ORDER_ITEMS', '40', 'VNHNS'),
    ('SCHEDULER_JOBS', '40', 'VNHNS'),
    ('SCHEDULER_LOGS', '40', 'VNHNS'),
    ('SCHEDULER_NOTIFICATIONS', '40', 'VNHNS'),
    ('SIMULATION_HEADERS', '40', 'VNHNS'),
    ('PROD_PLANS', '40', 'VNHNS'),
    ('JOB_ORDERS', '40', 'VNHNS'),
    ('ITEM_MASTERS', '40', 'VNHNS'),
    ('EQUIP_INSPECT_LOGS', '40', 'VNHNS'),
    ('IMPR_REQUESTS', '40', 'VNHNS'),
    ('COM_CODES', '40', 'VNHNS'),
    ('MENU_CATEGORIES', 'HANES', '-'),
    ('MENU_CATEGORY_ITEMS', 'HANES', '-'),
    ('PDA_ROLE', None, None),
    ('PHYSICAL_INV_SESSIONS', None, None),
]

with open(os.path.expanduser("~/.oracle_db_config.json")) as f:
    config = json.load(f)
site = config["profiles"]["JSHANES"]
conn = oracledb.connect(
    user=site["user"], password=site["password"],
    dsn=f"{site['host']}:{site['port']}/{site['service_name']}",
)
cur = conn.cursor()


def pk_cols(t):
    cur.execute(
        """SELECT cc.column_name FROM user_constraints c
           JOIN user_cons_columns cc ON c.constraint_name=cc.constraint_name
           WHERE c.table_name=:t AND c.constraint_type='P' ORDER BY cc.position""",
        t=t,
    )
    return [r[0] for r in cur.fetchall()]


def cond(col, val):
    return f"{col} IS NULL" if val is None else f"{col} = '{val}'"


# FK (child_table, fk_name) — 변경 중 일시 비활성화
FKS = [
    ('PROD_PLANS', 'FK_PROD_PLANS_ITEM'),
    ('MENU_CATEGORY_ITEMS', 'FK_MCI_CATEGORY'),
    ('ROLE_MENU_PERMISSIONS', 'FK_ROLE_MENU_ROLE'),
    ('SCHEDULER_LOGS', 'FK_SCHED_LOGS_JOB'),
    ('SIMULATION_PLANS', 'FK_SIM_PLANS_HEADER'),
    ('SIMULATION_SCHEDULES', 'FK_SIM_SCHED_HEADER'),
]

print(f"=== {'APPLY' if APPLY else 'DRY-RUN'} ===\n")

if APPLY:
    for child, fk in FKS:
        cur.execute(f"ALTER TABLE {child} DISABLE CONSTRAINT {fk}")
    print(f"FK {len(FKS)}개 비활성화\n")

total_updated = 0
for t, sco, spl in PLAN:
    pks = pk_cols(t)
    biz = [c for c in pks if c not in ('COMPANY', 'PLANT_CD')]
    src = f"COMPANY {cond('COMPANY', sco).split('COMPANY')[1]}".replace('  ', ' ')
    where_src = f"{cond('COMPANY', sco)} AND {cond('PLANT_CD', spl)}"
    cur.execute(f"SELECT COUNT(*) FROM {t} WHERE {where_src}")
    n_src = cur.fetchone()[0]
    # 충돌: target(40/1000)에 동일 비즈니스키 존재
    conflict = 0
    if biz:
        join = " AND ".join(f"s.{c}=d.{c}" for c in biz)
        cur.execute(
            f"""SELECT COUNT(*) FROM {t} s WHERE {where_src.replace('COMPANY', 's.COMPANY').replace('PLANT_CD', 's.PLANT_CD')}
                AND EXISTS (SELECT 1 FROM {t} d WHERE d.COMPANY='40' AND d.PLANT_CD='1000' AND {join})"""
        )
        conflict = cur.fetchone()[0]
    status = "OK" if conflict == 0 else f"CONFLICT={conflict}"
    print(f"{t:28} src={n_src:6} pk={biz} {status}")
    if APPLY and conflict == 0 and n_src > 0:
        cur.execute(
            f"UPDATE {t} SET COMPANY='40', PLANT_CD='1000' WHERE {where_src}"
        )
        total_updated += cur.rowcount

if APPLY:
    conn.commit()
    print(f"\n총 {total_updated}행 변경 커밋됨")
    errs = []
    for child, fk in FKS:
        try:
            cur.execute(f"ALTER TABLE {child} ENABLE CONSTRAINT {fk}")
        except Exception as e:
            errs.append(f"{fk}: {e}")
    if errs:
        print("FK 재활성화 실패:\n  " + "\n  ".join(errs))
    else:
        print(f"FK {len(FKS)}개 재활성화 완료")
else:
    print("\n(dry-run — 변경 없음. --apply 로 실행)")
