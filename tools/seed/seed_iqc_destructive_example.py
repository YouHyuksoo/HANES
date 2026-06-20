"""
seed_iqc_destructive_example.py
CBL-A의 IQC 검사 스펙에 파괴검사 항목(LQC) 1건 추가.
풀 코드: LQC (파괴검사, JUDGE_METHOD=MEASURE) — IQC_ITEM_POOL 실측 확인됨
대상: IQC_PART_SPEC_ITEMS COMPANY='40' PLANT_CD='1000' ITEM_CODE='CBL-A'
신규 SEQ: 40 (기존 10/20/30)

Usage:
    python tools/seed/seed_iqc_destructive_example.py          # dry-run
    python tools/seed/seed_iqc_destructive_example.py --commit # DB 반영
"""
import sys
import json
import os
import oracledb

COMPANY = "40"
PLANT_CD = "1000"
ITEM_CODE = "CBL-A"
INSP_ITEM_CODE = "LQC"
SEQ = 40
INSPECTION_TYPE = "DESTRUCTIVE"
SAMPLE_METHOD = "FIXED"
SAMPLE_QTY = 5
DEFECT_GRADE = "MAJOR"

commit = "--commit" in sys.argv


def get_conn():
    with open(os.path.expanduser("~/.oracle_db_config.json")) as f:
        config = json.load(f)
    site = config["profiles"]["JSHANES"]
    return oracledb.connect(
        user=site["user"],
        password=site["password"],
        dsn=f"{site['host']}:{site['port']}/{site['service_name']}",
    )


def main():
    conn = get_conn()
    cur = conn.cursor()

    # 1. 풀에 LQC 존재 확인
    cur.execute(
        "SELECT COUNT(*) FROM IQC_ITEM_POOL WHERE INSP_ITEM_CODE=:code AND COMPANY=:co AND PLANT_CD=:pl",
        code=INSP_ITEM_CODE, co=COMPANY, pl=PLANT_CD,
    )
    (pool_cnt,) = cur.fetchone()
    if pool_cnt == 0:
        print(f"[ERROR] IQC_ITEM_POOL에 {INSP_ITEM_CODE} 없음 — 시드 중단")
        sys.exit(1)

    # 2. 대상 품목 IQC_PART_SPECS 존재 확인
    cur.execute(
        "SELECT COUNT(*) FROM IQC_PART_SPECS WHERE ITEM_CODE=:ic AND COMPANY=:co AND PLANT_CD=:pl",
        ic=ITEM_CODE, co=COMPANY, pl=PLANT_CD,
    )
    (spec_cnt,) = cur.fetchone()
    if spec_cnt == 0:
        print(f"[ERROR] IQC_PART_SPECS에 {ITEM_CODE} 없음 — 시드 중단")
        sys.exit(1)

    # 3. 멱등 체크 — 이미 같은 항목 있으면 스킵
    cur.execute(
        """SELECT COUNT(*) FROM IQC_PART_SPEC_ITEMS
           WHERE COMPANY=:co AND PLANT_CD=:pl AND ITEM_CODE=:ic AND INSP_ITEM_CODE=:code""",
        co=COMPANY, pl=PLANT_CD, ic=ITEM_CODE, code=INSP_ITEM_CODE,
    )
    (exist_cnt,) = cur.fetchone()
    if exist_cnt > 0:
        print(f"[SKIP] {ITEM_CODE}/{INSP_ITEM_CODE} 이미 존재 (멱등) — 0건 변경")
        cur.close()
        conn.close()
        return

    sql = """
        INSERT INTO IQC_PART_SPEC_ITEMS
            (COMPANY, PLANT_CD, ITEM_CODE, SEQ, INSP_ITEM_CODE,
             INSPECTION_TYPE, SAMPLE_METHOD, SAMPLE_QTY, DEFECT_GRADE,
             USE_YN, CREATED_BY, UPDATED_BY)
        VALUES
            (:co, :pl, :ic, :seq, :code,
             :itype, :smethod, :sqty, :dgrade,
             'Y', 'seed', 'seed')
    """
    params = dict(
        co=COMPANY, pl=PLANT_CD, ic=ITEM_CODE, seq=SEQ, code=INSP_ITEM_CODE,
        itype=INSPECTION_TYPE, smethod=SAMPLE_METHOD, sqty=SAMPLE_QTY, dgrade=DEFECT_GRADE,
    )

    if commit:
        cur.execute(sql, params)
        conn.commit()
        print(f"[COMMITTED] {ITEM_CODE} + {INSP_ITEM_CODE} (SEQ={SEQ}) DESTRUCTIVE/FIXED/5/MAJOR 삽입 완료")
    else:
        print("[DRY-RUN] 아래 INSERT를 실행 예정 (--commit 없음)")
        print(f"  ITEM_CODE={ITEM_CODE}  INSP_ITEM_CODE={INSP_ITEM_CODE}  SEQ={SEQ}")
        print(f"  INSPECTION_TYPE={INSPECTION_TYPE}  SAMPLE_METHOD={SAMPLE_METHOD}")
        print(f"  SAMPLE_QTY={SAMPLE_QTY}  DEFECT_GRADE={DEFECT_GRADE}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
