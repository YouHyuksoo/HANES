from lib import *
import yaml
def dc(i): return f'<span id="{i}"></span><code>{i}</code>'
LAB={s['code']:s['label'] for s in SCREENS}
WF=[]
for f in sorted(glob.glob(f'{R}/docs/workflows/definitions/*.md')):
    t=open(f,encoding='utf-8-sig').read().split('---')
    WF.append(yaml.safe_load(t[1]))
SC_BY={s['code']:s for s in SCREENS}
info=D['info']

# ================= 1. 요구사항 정의서 =================
d=Doc('01-requirements.html','HNS-MES-RQ-001','요구사항 정의서','HANES MES 제조실행시스템 구축 — 요구사항 정의서','현행 MES가 제공해야 하는 업무·시스템 요구사항을 정의하고 이후 설계·시험·매뉴얼과 추적번호로 연결한다.')
d.h2('1. 개요')
d.h3('1.1 배경 및 목적',toc=False)
d.p('하네스(와이어링 하니스) 제조 현장의 자재 입하부터 출하까지 전 과정을 LOT·시리얼 단위로 추적·통제하기 위한 MES를 구축한다. 본 문서는 구축된 시스템의 화면·API·DB·기존 업무 로직 문서를 분석하여 요구사항을 역으로 정리한 산출물이다.')
d.h3('1.2 범위',toc=False)
d.p(f'웹 업무 화면 {info["pages"]}개 페이지(메뉴 등록 화면 {len(SCREENS)}개), PDA 화면, 백엔드 API, Oracle DB 테이블 {len(D["tabs"])}개 문서화(엔티티 {info["entities"]}개)를 대상으로 한다. 소스코드 문서는 산출물에서 제외한다.')
d.h3('1.3 추적번호 체계',toc=False)
d.raw(table(['접두어','의미','부여 규칙','정의 문서'],[
 ['REQ-모듈-NNN','요구사항','메뉴(화면) 단위 1건, 모듈 약어 + 일련번호','01 요구사항 정의서'],
 ['FUN-모듈-NNN','기능','요구사항과 동일 번호(1:1)','02 개발 설계서'],
 ['SCR-모듈-NNN','화면','요구사항과 동일 번호(1:1)','02 개발 설계서'],
 ['TBL-모듈-NN','DB 테이블','모듈별 일련번호','02 개발 설계서'],
 ['TST-모듈-001','시험 결과','모듈별 1건(해당 모듈 요구사항 전체 대상)','03 시험 운영 결과 보고서'],
 ['MUS-모듈','사용자 매뉴얼 장','모듈별 1장','04 사용자 매뉴얼'],
 ['NFR-NN','비기능 요구사항','일련번호','01 요구사항 정의서'],
]))
d.p('예) REQ-MAT-005 → FUN-MAT-005 → SCR-MAT-005 → TBL-MAT-xx → TST-MAT-001 → MUS-MAT. 전체 연결은 문서 말미 추적 매트릭스와 산출물 목록(index.html)에서 확인한다.')
d.h3('1.4 모듈 약어',toc=False)
d.raw(table(['약어','모듈','범위','화면 수'],[[m['short'],m['label'],m['desc'],len([s for s in SCREENS if s['mod']==m['code']])] for m in mods]))

d.h2('2. 업무 프로세스 개요')
d.p('요구사항은 아래 5개 핵심 업무 흐름(워크플로우 정의 문서 기준)을 중심으로 도출했다. 각 단계는 메뉴 코드에 대응하며, 단계 간 선행조건이 시스템에서 강제된다.')
for w in WF:
    steps=[]
    for st in w['steps']:
        s=SC_BY.get(st['menu']);steps.append(f'<span>{e(s["label"]) if s else e(st["menu"])}</span>')
    d.raw(f'<h3>{e(w["title"])} <span class="mut">({e(w["workflowId"])})</span></h3><div class="flow">{"<i>→</i>".join(steps)}</div>')

d.h2('3. 기능 요구사항')
d.p('메뉴(화면) 1개를 요구사항 1건으로 정의한다. 우선순위는 입하→생산→검사→출하의 핵심 흐름에 속하면 상, 그 외 지원 업무는 중으로 구분했다. 요구 설명은 화면별 업무 로직 문서(docs/business-logics)의 화면 목적을 따른다.')
for m in mods:
    d.h3(f'3.{mods.index(m)+1} {m["label"]} ({m["short"]})',anchor=f'm-{m["short"]}')
    d.p(m['desc'])
    pr='상' if m['code'] in CORE else '중'
    rows=[[dc(s['req']),e(s['label']),e(s['purpose']),pr,f'<code>{e(s["path"] or "-")}</code>',f'<span class="mut">{"docs/business-logics/"+s["code"]+".md" if s["hasdoc"] else "메뉴 설정/화면 소스"}</span>'] for s in m['screens']]
    d.raw(table(['요구번호','요구사항명','요구 내용','우선순위','화면 경로','근거'],rows,raw=True))

d.h2('4. 비기능 요구사항')
NFR=[
 ['NFR-01','멀티 테넌트','모든 업무 데이터는 회사(COMPANY)·사업장(PLANT_CD) 범위로 분리 조회·저장한다.','DB 규칙(AGENTS.md §5)'],
 ['NFR-02','권한(RBAC)','메뉴 코드 단위 역할별 접근 권한을 제어하고, 서버에서도 권한을 검증한다.','menuConfig, role 모듈'],
 ['NFR-03','추적성','자재 LOT → 반제품 → 완제품 시리얼 → 박스/팔레트 → 출하까지 정·역방향 추적이 가능해야 한다.','PRODUCT_GENEALOGY, TRACE_LOGS'],
 ['NFR-04','채번','번호 채번은 Oracle SEQUENCE.NEXTVAL만 사용하며 MAX+1 방식을 금지한다.','AGENTS.md §5'],
 ['NFR-05','트랜잭션 정합성','작업지시 집계=실적 합계, 공정재고 잔량=원장 등 트랜잭션 불변식을 정기 검증한다.','기준정보검증 TXN_INVARIANT, 스케줄러 MST_VALIDATION_DAILY'],
 ['NFR-06','다국어','화면 문구는 한국어·영어·베트남어·중국어를 지원한다.','locales(ko/en/vi/zh)'],
 ['NFR-07','현장 장비 연동','바코드/QR 스캔, 라벨 프린터(Print Agent), PDA, 검사 설비 통신을 지원한다.','BarcodeScanInput, print-agent, EQUIP_PROTOCOLS'],
 ['NFR-08','UI 표준','코드성 값은 공통코드/기준정보 선택 방식, 알림은 모달 사용(alert/confirm 금지), 상태 표시는 공통 배지를 사용한다.','AGENTS.md §6, docs/design'],
 ['NFR-09','이력·감사','화면 접근 이력(ACTIVITY_LOGS), 스케줄러/인터페이스 송수신 이력을 보존한다.','ACTIVITY_LOGS, INTER_LOGS, SCHEDULER_LOGS'],
 ['NFR-10','운영 환경','프론트엔드(Next.js)·백엔드(NestJS)를 PM2로 상시 운영하고 HTTPS 리버스 프록시를 통해 접속한다.','ecosystem.config.js'],
 ['NFR-11','품질 인증 대응','IATF 16949 대응 문서(관리계획서, FAI, PPAP, 변경점, 내부심사, CAPA)를 시스템에서 관리한다.','quality 모듈'],
]
d.raw(table(['번호','구분','요구 내용','근거'],[[dc(a),b,c,x] for a,b,c,x in NFR],raw=True))
d.h2('5. 제약사항 및 가정')
d.raw('<ul><li>데이터베이스는 Oracle이며 TypeORM CLI 대신 Raw SQL/oracle-db 커넥터 경로로 DDL·DML을 적용한다.</li><li>스키마 변경 시 마이그레이션 SQL과 ERD 문서(docs/database/schema-erd.md)를 함께 갱신한다.</li><li>본 요구사항은 현행 시스템에서 역산한 것으로, 요구 우선순위는 업무 흐름상 위치로 부여했다.</li></ul>')
d.h2('6. 요구사항 추적 매트릭스')
d.p('요구사항 번호와 이후 산출물의 대응 관계이다. 모듈 단위로 요약했으며 화면 단위 연결은 동일 번호(REQ=FUN=SCR)로 확인한다.')
rows=[]
for m in mods:
    sc=m['screens'];
    if not sc: continue
    rows.append([f'<a class="id" href="#m-{m["short"]}">{sc[0]["req"]} ~ {sc[-1]["req"][-3:]}</a>',m['label'],f'<a class="id" href="02-design.html#f-{m["short"]}">{sc[0]["fun"]} ~ {sc[-1]["fun"][-3:]}</a>',f'<a class="id" href="02-design.html#t-{m["short"]}">TBL-{m["short"]}-01 ~</a>' if TBLS[m['code']] else '-',idlink(f'TST-{m["short"]}-001'),idlink(f'MUS-{m["short"]}')])
d.raw(table(['요구사항','모듈','기능·화면','테이블','시험','매뉴얼'],rows,raw=True))
d.save(NAV)

# ================= 2. 개발 설계서 =================
g=Doc('02-design.html','HNS-MES-DS-001','개발 설계서','HANES MES — To-Be 기능 정의서 · 화면 설계서 · DB 설계서','요구사항을 구현한 시스템의 아키텍처, 기능, 화면, 데이터 구조를 정의한다.')
g.h2('1. 설계 개요')
g.p('요구사항 정의서(HNS-MES-RQ-001)의 REQ를 구현 단위로 전개한 설계서이다. 기능(FUN)·화면(SCR)·테이블(TBL)을 REQ와 동일한 번호 체계로 연결한다.')
g.h2('2. 시스템 아키텍처')
g.h3('2.1 기술 스택',toc=False)
g.raw(table(['구분','구성'],[
 ['모노레포','Turborepo + pnpm (apps/frontend, apps/backend, packages/shared)'],
 ['프론트엔드','Next.js App Router, TypeScript, 탭 유지(TabKeepAlive) 구조, PDA 전용 화면(/pda)'],
 ['백엔드','NestJS, TypeORM + Raw SQL(Oracle helper), REST API'],
 ['데이터베이스','Oracle Database (사이트 JSHANES)'],
 ['운영','PM2 (hanes-frontend / hanes-backend / hanes-proxy), GitHub Actions 자동 배포'],
 ['현장 연동','Print Agent(라벨 출력), 바코드/QR 스캔, PDA, 설비 통신 프로토콜'],
]))
g.h3('2.2 런타임 구조',toc=False)
g.raw('<div class="flow"><span>브라우저 / PDA</span><i>→</i><span>HTTPS 프록시(443)</span><i>→</i><span>Next.js 프론트엔드(3100)</span><i>→</i><span>NestJS API(3003)</span><i>→</i><span>도메인 서비스</span><i>→</i><span>Oracle DB</span></div>')
g.h3('2.3 백엔드 모듈 구성',toc=False)
g.raw(table(['백엔드 모듈','컨트롤러 수'],[[k,v] for k,v in sorted(D['bm'].items())]))
g.h2('3. 기능 정의 (To-Be)')
g.p('모듈별 기능 목록이다. 기능 설명은 화면 목적을 기준으로 하며, 대응 백엔드 모듈과 요구사항을 함께 표기한다.')
for m in mods:
    g.h3(f'3.{mods.index(m)+1} {m["label"]}',anchor=f'f-{m["short"]}')
    g.p('백엔드 모듈: '+', '.join(MODS[m['code']][2]))
    rows=[[dc(s['fun']),e(s['label']),e(s['purpose']),idlink(s['req']),idlink(s['scr'])] for s in m['screens']]
    g.raw(table(['기능번호','기능명','기능 설명','요구사항','화면'],rows,raw=True))
g.h2('4. 화면 설계')
g.h3('4.1 공통 화면 설계 기준')
g.raw(table(['항목','기준','근거'],[
 ['레이아웃','좌측 사이드바 메뉴 + 상단 탭(다중 화면 유지) + 본문. 메뉴는 RBAC 메뉴 코드로 노출 제어','docs/design/layout.md, navigation.md'],
 ['목록','공통 DataGrid(정렬·필터·합계·CSV 내보내기), 공통 일자/사용여부 필터','docs/design/data-grid.md'],
 ['입력','코드성 값은 공통코드·기준정보 선택(ComCodeSelect 등), 바코드는 BarcodeScanInput','docs/design/forms.md, AGENTS.md §6'],
 ['알림·확인','alert/confirm/prompt 금지, 모달 컴포넌트 사용','docs/design/modals.md'],
 ['버튼·테마','공통 버튼 규격, 다크/라이트 테마, 상태는 ComCodeBadge','docs/design/buttons.md, theme.md'],
 ['즐겨찾기','사용자별 즐겨찾기 폴더(회사/사업장/사용자 단위 서버 저장)','menu-favorites'],
 ['도움말','화면별 투어/도움말, AI 챗 연계','tour-help, /help'],
]))
g.h3('4.2 화면 목록')
g.p(f'메뉴에 등록된 {len(SCREENS)}개 화면이다. 화면 경로는 Next.js 라우트이며 사용자 매뉴얼의 메뉴 경로와 일치한다.')
for m in mods:
    g.raw(f'<h3 id="s-{m["short"]}" style="font-size:14px">{e(m["label"])}</h3>')
    g.raw(table(['화면번호','화면명','메뉴코드','URL','메뉴 경로'],[[dc(s['scr']),e(s['label']),f'<code>{s["code"]}</code>',f'<code>{e(s["path"] or "-")}</code>',e(m['label']+(' > '+s['label'] if len(m['screens'])>1 or s['label']!=m['label'] else ''))] for s in m['screens']],raw=True))
g.h3('4.3 PDA 화면')
g.raw(table(['영역','경로','용도'],[['로그인/메뉴','/pda/login, /pda/menu','PDA 로그인과 업무 메뉴'],['자재','/pda/material/*','입하·입고·출고·실사 스캔'],['제품','/pda/product/*','제품 입고·이동·실사'],['출하','/pda/shipping, /pda/shipping-pallet, /pda/pallet-ship','박스·팔레트 출하 스캔'],['설비점검','/pda/equip-inspect','설비 일상점검 입력'],['설정','/pda/settings','PDA 환경 설정']]))
g.h2('5. DB 설계')
g.h3('5.1 설계 원칙',toc=False)
g.raw('<ul><li>업무 테이블은 COMPANY, PLANT_CD를 포함하는 멀티 테넌트 구조다.</li><li>ID/SEQ 채번은 SEQUENCE.NEXTVAL만 사용한다.</li><li>코드성 값은 COM_CODES(공통코드)로 관리하고 컬럼 도메인은 docs/database/column-domains.md를 따른다.</li><li>스키마 변경은 마이그레이션 SQL(488개 SQL 파일 관리)과 ERD 문서를 함께 갱신한다.</li><li>상세 컬럼·PK/FK 정의는 docs/database/schema-erd.md(자동 생성)를 기준으로 한다.</li></ul>')
g.h3('5.2 핵심 데이터 흐름',toc=False)
g.raw('<div class="flow"><span>PO</span><i>→</i><span>MAT_ARRIVALS / MAT_LOTS</span><i>→</i><span>IQC_LOGS</span><i>→</i><span>MAT_RECEIVINGS / MAT_STOCKS</span><i>→</i><span>MAT_ISSUES · WIP_MAT_STOCKS</span><i>→</i><span>JOB_ORDERS / PROD_RESULTS</span><i>→</i><span>FG_LABELS · INSPECT_RESULTS</span><i>→</i><span>BOX / PALLET</span><i>→</i><span>SHIPMENT_ORDERS</span></div>')
g.h3('5.3 테이블 목록')
g.p(f'테이블 카탈로그(docs/database/table-catalog.md) 기준 {len(D["tabs"])}개 테이블을 모듈별로 구분했다.')
for m in mods:
    if not TBLS[m['code']]: continue
    g.raw(f'<h3 id="t-{m["short"]}" style="font-size:14px">{e(m["label"])} ({len(TBLS[m["code"]])})</h3>')
    g.raw(table(['테이블번호','테이블명','설명','관련 요구'],[[dc(i),f'<code>{t}</code>',e(x),idlink(m['screens'][0]['req']) if m['screens'] else '-'] for i,t,x in TBLS[m['code']]],raw=True))
g.p('※ 관련 요구는 해당 모듈의 첫 요구번호이며, 테이블은 모듈 전체 요구사항에 공용된다. 모듈 분류는 테이블 이름 기준이며 기준정보(MST)에 일부 공용 테이블이 포함된다.')
g.h2('6. 인터페이스 설계')
g.raw(table(['구분','방식','관련 구성'],[
 ['웹 ↔ 서버','REST API (JWT 인증)','NestJS controllers, 프론트 services'],
 ['라벨 출력','Print Agent 연계, 라벨 템플릿(LABEL_TEMPLATES) 디자인·출력','print-agent, LABEL_PRINT_LOGS'],
 ['검사/측정 설비','설비 통신 프로토콜 정의 및 센서 데이터 수집','EQUIP_PROTOCOLS, SENSOR_DATA_LOGS, COMM_CONFIGS'],
 ['외부 시스템','인터페이스 송수신, 수동 전송, 이력/대시보드','interface 모듈, INTER_LOGS'],
 ['PDA','모바일 스캔 화면 + 동일 API','/pda/*'],
 ['AI','AI 챗, 테이블 카탈로그 기반 SQL 생성·검증, Page Tool 워크플로우','ai, ai-knowledge, ai-page-tools'],
]))
g.h2('7. 보안·권한 설계')
g.raw('<ul><li>인증: 로그인 시 JWT 발급, 만료시간 설정.</li><li>인가: 메뉴 코드(RBAC) 단위 역할별 권한, 관리자 전용 기능(스케줄러 등)은 서버에서 ADMIN 검증.</li><li>감사: 화면 접근 이력과 인터페이스·스케줄러 로그 보존.</li><li>설정: 접속정보는 환경변수(.env)로 관리하며 저장소에 커밋하지 않는다.</li></ul>')
g.h2('8. 주요 설계 결정 (ADR)')
g.raw(table(['번호','결정'],[[a[:4],a[5:-3].replace('-',' ')] for a in info['adr']]))
g.h2('9. 설계 추적 매트릭스')
g.raw(table(['모듈','요구사항','기능','화면','테이블'],[[m['label'],f'<a class="id" href="01-requirements.html#m-{m["short"]}">{m["screens"][0]["req"]} ~</a>',f'<a class="id" href="#f-{m["short"]}">{m["screens"][0]["fun"]} ~</a>',f'<a class="id" href="#s-{m["short"]}">{m["screens"][0]["scr"]} ~</a>',(f'<a class="id" href="#t-{m["short"]}">TBL-{m["short"]}-01 ~ ({len(TBLS[m["code"]])})</a>' if TBLS[m['code']] else '-')] for m in mods if m['screens']],raw=True))
g.save(NAV)
print('ok',len(SCREENS))
