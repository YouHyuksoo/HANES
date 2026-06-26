# -*- coding: utf-8 -*-
"""N91H00-X9800 라우팅 생성 SQL 생성기 (BOM + 회신 시트 공정 기준).

라우팅 그룹 3개(완제품/C1/C2), 공정순서(회신 공정→PROCESS_MASTERS 매핑),
공정별 투입자재(BOM 자식 매핑). MERGE 멱등.
"""
import os

OUT = os.path.join("apps", "backend", "src", "migrations", "2026-06-26_n91h00_routing.sql")
CO, PL, BY = "40", "1000", "claude"

# 라우팅 그룹: (routing_code, routing_name, item_code)
GROUPS = [
    ("RT_N91H00-X9800", "N91H00-X9800 완제품 라우팅", "N91H00-X9800"),
    ("RT_N91H00-X9800-C1", "N91H00-X9800-C1 (1번 케이블) 라우팅", "N91H00-X9800-C1"),
    ("RT_N91H00-X9800-C2", "N91H00-X9800-C2 (2번 케이블) 라우팅", "N91H00-X9800-C2"),
]

# 공정: routing_code -> [(seq, process_code, process_name, flags)]
# flags: sample(SAMPLE_INSPECT_YN), sg(ISSUE_SG_LABEL_YN), fg(ISSUE_FG_LABEL_YN), des(DESTRUCTIVE_YN)
CABLE_PROCS = [
    (10, "ATCNS", "자동절단탈피", {}),
    (20, "SHDCT", "실드절단", {}),
    (30, "HEXPR", "압착준비(육각)", {}),
    (40, "HEXCP", "육각압착", {}),
    (50, "TMCRP", "단자압착", {"des": "Y", "sg": "Y"}),
]
PROCS = {
    "RT_N91H00-X9800-C1": CABLE_PROCS,
    "RT_N91H00-X9800-C2": CABLE_PROCS,
    "RT_N91H00-X9800": [
        (10, "TUBHT", "열수축", {}),
        (20, "SGINS", "반제품검사", {"sample": "Y"}),
        (30, "MATPR", "조립자재준비", {}),
        (40, "PROTC", "프로텍트체결", {}),
        (50, "MASSY", "조립", {}),
        (60, "CIINS", "회로검사", {"sample": "Y", "fg": "Y"}),
        (70, "AINSP", "통합검사", {"sample": "Y"}),
    ],
}

# 투입자재: routing_code -> [(seq, child_item_code, alloc_qty)]  (BOM 자식 기준)
MATS = {
    "RT_N91H00-X9800-C1": [
        (10, "1SH21A7A09", 670),
        (30, "STEVC73840", 1), (30, "RTEBW002MA", 1), (30, "SKEG176167", 1),
        (30, "CRSKEB6167", 1), (30, "CRRKEB6167", 1), (30, "HTEAVCW002MA", 1),
        (30, "CRRTEB3840", 1), (30, "CRSTEB3840", 1),
        (50, "TKEG1WFSCD", 1), (50, "VSFT1-201", 1), (50, "DLMLS6-3-3", 1), (50, "EKEESNATBC", 1),
    ],
    "RT_N91H00-X9800-C2": [
        (10, "1SH21A7A09", 785),
        (30, "STEVC73840", 1), (30, "RTEBW002MA", 1), (30, "SKEG176167", 1),
        (30, "CRSKEB6167", 1), (30, "CRRKEB6167", 1), (30, "CRRTEB3840", 1), (30, "CRSTEB3840", 1),
        (50, "TKEG1WFSCD", 1),
    ],
    "RT_N91H00-X9800": [
        (10, "VSFT1-201", 1),
        (20, "N91H00-X9800-C1", 1), (20, "N91H00-X9800-C2", 1),
        (30, "6TBE11A000", 345),
        (40, "HKEAN1W002FA", 1), (40, "RKEAW002F4", 1),
        (50, "6TPH1A0190", 1330), (50, "NBC3-5L", 2), (50, "LB04201250", 1),
        (60, "LB08802520", 1), (60, "RIBON-7", 94),
    ],
}


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


lines = ["-- N91H00-X9800 라우팅 (BOM + 회신 시트 공정 기준). MERGE 멱등.\n"]

# 그룹
for code, name, item in GROUPS:
    lines.append(
        f"MERGE INTO ROUTING_GROUPS g USING (SELECT {q(CO)} C,{q(PL)} P,{q(code)} R FROM DUAL) x "
        f"ON (g.COMPANY=x.C AND g.PLANT_CD=x.P AND g.ROUTING_CODE=x.R)\n"
        f"WHEN MATCHED THEN UPDATE SET g.ROUTING_NAME={q(name)}, g.ITEM_CODE={q(item)}, g.USE_YN='Y', g.UPDATED_BY={q(BY)}, g.UPDATED_AT=SYSTIMESTAMP\n"
        f"WHEN NOT MATCHED THEN INSERT (COMPANY,PLANT_CD,ROUTING_CODE,ROUTING_NAME,ITEM_CODE,USE_YN,CREATED_BY) "
        f"VALUES ({q(CO)},{q(PL)},{q(code)},{q(name)},{q(item)},'Y',{q(BY)});\n/"
    )

# 공정
for code, procs in PROCS.items():
    for seq, pc, pn, fl in procs:
        s = fl.get("sample", "N"); sg = fl.get("sg", "N"); fg = fl.get("fg", "N"); des = fl.get("des", "N")
        lines.append(
            f"MERGE INTO ROUTING_PROCESSES p USING (SELECT {q(CO)} C,{q(PL)} P,{q(code)} R,{seq} S FROM DUAL) x "
            f"ON (p.COMPANY=x.C AND p.PLANT_CD=x.P AND p.ROUTING_CODE=x.R AND p.SEQ=x.S)\n"
            f"WHEN MATCHED THEN UPDATE SET p.PROCESS_CODE={q(pc)}, p.PROCESS_NAME={q(pn)}, p.SAMPLE_INSPECT_YN={q(s)}, "
            f"p.ISSUE_SG_LABEL_YN={q(sg)}, p.ISSUE_FG_LABEL_YN={q(fg)}, p.DESTRUCTIVE_YN={q(des)}, p.UPDATED_BY={q(BY)}, p.UPDATED_AT=SYSTIMESTAMP\n"
            f"WHEN NOT MATCHED THEN INSERT (COMPANY,PLANT_CD,ROUTING_CODE,SEQ,PROCESS_CODE,PROCESS_NAME,SAMPLE_INSPECT_YN,ISSUE_SG_LABEL_YN,ISSUE_FG_LABEL_YN,DESTRUCTIVE_YN,USE_YN,CREATED_BY) "
            f"VALUES ({q(CO)},{q(PL)},{q(code)},{seq},{q(pc)},{q(pn)},{q(s)},{q(sg)},{q(fg)},{q(des)},'Y',{q(BY)});\n/"
        )

# 자재
for code, mats in MATS.items():
    for seq, child, qty in mats:
        lines.append(
            f"MERGE INTO ROUTING_MATERIALS m USING (SELECT {q(CO)} C,{q(PL)} P,{q(code)} R,{seq} S,{q(child)} CH FROM DUAL) x "
            f"ON (m.COMPANY=x.C AND m.PLANT_CD=x.P AND m.ROUTING_CODE=x.R AND m.SEQ=x.S AND m.CHILD_ITEM_CODE=x.CH)\n"
            f"WHEN MATCHED THEN UPDATE SET m.ALLOC_QTY={qty}, m.USE_YN='Y', m.UPDATED_BY={q(BY)}, m.UPDATED_AT=SYSTIMESTAMP\n"
            f"WHEN NOT MATCHED THEN INSERT (COMPANY,PLANT_CD,ROUTING_CODE,SEQ,CHILD_ITEM_CODE,ALLOC_QTY,ISSUE_METHOD,USE_YN,CREATED_BY) "
            f"VALUES ({q(CO)},{q(PL)},{q(code)},{seq},{q(child)},{qty},'BACKFLUSH','Y',{q(BY)});\n/"
        )

lines.append("COMMIT;\n/")
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print(f"generated {OUT}")
print(f"groups={len(GROUPS)} procs={sum(len(v) for v in PROCS.values())} mats={sum(len(v) for v in MATS.values())}")
