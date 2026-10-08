import html,re,json,glob,os
import os,subprocess
R=os.environ.get('HANES_ROOT') or subprocess.run(['git','rev-parse','--show-toplevel'],capture_output=True,text=True).stdout.strip()
WORK=os.environ.get('HD_WORK','/tmp/hanes_deliverables')
os.makedirs(WORK,exist_ok=True)
OUT=os.environ.get('HD_OUT') or f'{R}/docs/reports/deliverables'
D=json.load(open(os.path.join(WORK,'data.json')))
TODAY='2026-10-08'
PROJ='HANES MES (JSHANES 사업장)'
e=html.escape

# 모듈 코드 -> (약어, 설명, 백엔드 모듈)
MODS={
 'DASHBOARD':('DSH','경영·현장 핵심 지표를 한 화면에 모아 보여주는 대시보드',['dashboard']),
 'WORKFLOW':('WFL','자재→생산→품질→출하 업무 흐름을 지도 형태로 안내하는 워크플로우 허브',['workflow']),
 'MONITORING':('MON','생산·품질·재고·작업지시·설비·SPC 현황판(전광판)',['monitoring']),
 'MASTER':('MST','품목·BOM·공정·라우팅·거래처·창고·작업자·공통코드·라벨 등 기준정보와 기준정보 검증',['master']),
 'MATERIAL':('MAT','자재 입하·IQC(수입검사)·라벨·입고·재고·출고·실사·LOT 관리',['material']),
 'PRODUCT_INVENTORY':('INV','완제품 재고, 실사, 제품 보류 관리',['inventory']),
 'PRODUCT_MGMT':('PMG','제품 수불 및 제품 단위 이력 관리',['inventory','production']),
 'PURCHASING':('PUR','자재 발주(PO) 등록 및 발주 현황 관리',['material']),
 'PRODUCTION':('PRD','생산계획·작업지시·실적(키오스크)·키팅·투입·재공재고·라벨 관리',['production']),
 'INSPECTION':('INS','통전·내전압·리크·토크·비전·릴레이 등 공정 검사 결과 관리',['quality']),
 'QUALITY':('QUA','IQC·OQC·AQL·불량·SPC·FAI·PPAP·내부심사·CAPA·변경점·관리계획서 등 품질 관리',['quality']),
 'EQUIPMENT':('EQP','설비 마스터·일상/정기 점검·PM·금형·설비 이력',['equipment']),
 'GAUGE_MGMT':('GAU','계측기 마스터 및 교정 이력 관리',['equipment']),
 'SHIPPING':('SHP','출하지시·박스·팔레트·출하·반품 관리 (PDA 연계)',['shipping']),
 'SALES':('SAL','고객 수주 관리',['shipping']),
 'CUSTOMS':('CUS','보세 수입신고·보세 LOT·사용량 보고',['customs']),
 'CONSUMABLES':('CON','금형·치공구·공구 등 소모품 입출고·장착·수명 관리',['consumables']),
 'OUTSOURCING':('OUT','외주 발주·불출·입고 관리',['outsourcing']),
 'SCENARIO':('SCN','화면 업무 시나리오 자동 실행(검증) 도구',['ai-scenarios']),
 'INTERFACE':('IFC','외부 시스템 인터페이스 송수신 이력 및 수동 전송',['interface']),
 'SYSTEM':('SYS','사용자·권한·메뉴·시스템설정·스케줄러·로그·문서·AI 등 시스템 관리',['system','user','role','auth','scheduler','menu-categories','menu-favorites','ai','ai-knowledge','ai-page-tools','print-agent']),
}
CORE={'MASTER','MATERIAL','PRODUCT_INVENTORY','PRODUCT_MGMT','PURCHASING','PRODUCTION','INSPECTION','QUALITY','SHIPPING','SALES'}

# 테이블 -> 모듈
TRULES=[
 (r'^(MAT_ARRIVAL|MAT_LOTS|MAT_RECEIVINGS|MAT_STOCKS|MAT_ISSUE|MAT_ISSUES)','MATERIAL'),
 (r'^PURCHASE_ORDER','PURCHASING'),
 (r'^(PHYSICAL_INV|INV_ADJ|STOCK_TRANSACTIONS|PRODUCT_STOCKS)','PRODUCT_INVENTORY'),
 (r'^PRODUCT_TRANSACTIONS','PRODUCT_MGMT'),
 (r'^(JOB_|PROD_PLANS|PROD_RESULTS|SIMULATION|WIP_MAT|FG_LABELS|SG_LABELS|PRODUCT_GENEALOGY|TRACE_LOGS)','PRODUCTION'),
 (r'^(INSPECT_RESULTS|SAMPLE_INSPECT|INSPECT_SAMPLE|INSPECT_AIDS)','INSPECTION'),
 (r'^(AQL_|IQC_|DEFECT_|OQC_|FAI_|PPAP_|AUDIT_|CAPA_|CHANGE_ORDERS|CONTROL_PLAN|CUSTOMER_COMPLAINTS|REWORK_|SPC_|LIMIT_SAMPLE|TRAINING_)','QUALITY'),
 (r'^(EQUIP_|PM_|MOLD_|SELF_INSPECT|SENSOR_DATA|COMM_CONFIGS|REPAIR_)','EQUIPMENT'),
 (r'^(GAUGE_|CALIBRATION_)','GAUGE_MGMT'),
 (r'^(SHIPMENT_|BOX_MASTERS|PALLET_MASTERS)','SHIPPING'),
 (r'^CUSTOMER_ORDER','SALES'),
 (r'^CUSTOMS_','CUSTOMS'),
 (r'^CONSUMABLE_','CONSUMABLES'),
 (r'^SUBCON_','OUTSOURCING'),
 (r'^INTER_LOGS','INTERFACE'),
 (r'^(SYS_CONFIGS|SCHEDULER_|MENU_|ACTIVITY_LOGS|IMPR_REQUESTS|DOCUMENT_MASTERS|PDA_ROLE|NUM_RULE|SEQ_RULES)','SYSTEM'),
]
def tmod(t):
    for rx,m in TRULES:
        if re.search(rx,t): return m
    return 'MASTER'

# 화면 번호 부여
SCREENS=[]  # dict(mod, short, no, req, fun, scr, code, label, path, purpose)
mods=[]
for m in D['mods']:
    sc=m['screens'] or ([{'code':m['code'],'label':m['label'],'path':m['path']}] if m['path'] else [])
    mods.append({**m,'screens':sc,'short':MODS[m['code']][0],'desc':MODS[m['code']][1]})
for m in mods:
    for i,s in enumerate(m['screens'],1):
        n=f'{m["short"]}-{i:03d}'
        pur=D['bl'].get(s['code'])
        s.update(no=n,req='REQ-'+n,fun='FUN-'+n,scr='SCR-'+n,mod=m['code'],short=m['short'],
                 purpose=pur or f'{m["label"]} 업무의 {s["label"]} 처리(조회·등록·수정 등)',
                 hasdoc=s['code'] in D['bl'])
        SCREENS.append(s)
TBLS={}  # mod -> list(id,name,desc)
for m in mods: TBLS[m['code']]=[]
for t,desc in D['tabs']:
    mc=tmod(t); TBLS[mc].append([None,t,desc])
for m in mods:
    for i,row in enumerate(TBLS[m['code']],1): row[0]=f'TBL-{m["short"]}-{i:02d}'
TBLMAP={r[1]:r for v in TBLS.values() for r in v}

# CSS / 페이지
CSS='''
:root{--bg:#fff;--fg:#1f2933;--mut:#5f6b7a;--line:#d8dee6;--head:#eef3f9;--pri:#1f4e8c;--alt:#f7f9fc;--tip:#e8f5e9;--warn:#fff4d6;--code:#f0f4f8}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#14181d;--fg:#e4e8ee;--mut:#9aa6b4;--line:#2f3844;--head:#1d2733;--pri:#7fb0ee;--alt:#191f26;--tip:#17301d;--warn:#3a3112;--code:#1d2733;color-scheme:dark}}
:root[data-theme=dark]{--bg:#14181d;--fg:#e4e8ee;--mut:#9aa6b4;--line:#2f3844;--head:#1d2733;--pri:#7fb0ee;--alt:#191f26;--tip:#17301d;--warn:#3a3112;--code:#1d2733;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 -apple-system,"Malgun Gothic","Apple SD Gothic Neo",sans-serif}
.wrap{display:flex;max-width:1280px;margin:0 auto}
nav.toc{position:sticky;top:0;align-self:flex-start;height:100vh;overflow:auto;width:290px;flex:none;padding:20px 12px 40px 16px;border-right:1px solid var(--line);font-size:13px}
nav.toc a{display:block;color:var(--fg);text-decoration:none;padding:2px 0}nav.toc a:hover{color:var(--pri)}nav.toc .l3{padding-left:14px;color:var(--mut)}nav.toc .t{font-weight:700;color:var(--pri);margin-bottom:8px}
main{flex:1;min-width:0;padding:28px 36px 80px}
h1{font-size:26px;color:var(--pri);margin:0 0 6px}h2{font-size:20px;border-bottom:2px solid var(--pri);padding-bottom:4px;margin:38px 0 12px;color:var(--pri)}h3{font-size:16px;margin:24px 0 8px}
table{border-collapse:collapse;width:100%;margin:10px 0 18px;font-size:13px}th,td{border:1px solid var(--line);padding:5px 8px;vertical-align:top;text-align:left}th{background:var(--head)}tbody tr:nth-child(even){background:var(--alt)}
.tblwrap{overflow-x:auto}.mut{color:var(--mut)}code{background:var(--code);padding:1px 5px;border-radius:3px;font-size:12.5px}
a.id{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--pri);text-decoration:none;white-space:nowrap}a.id:hover{text-decoration:underline}
.box{padding:10px 14px;border-radius:6px;margin:12px 0;border:1px solid var(--line)}.tip{background:var(--tip)}.warn{background:var(--warn)}
.meta td:first-child{width:150px;background:var(--head);font-weight:600}
.top{font-size:13px;margin-bottom:14px}.top a{color:var(--pri)}
details{margin:8px 0}summary{cursor:pointer;font-weight:600}
pre{background:var(--code);padding:10px 12px;border-radius:6px;overflow:auto;font-size:12.5px}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}.flow span{border:1px solid var(--pri);border-radius:6px;padding:3px 9px;background:var(--head);font-size:13px}.flow i{color:var(--mut);font-style:normal}
@media(max-width:860px){nav.toc{display:none}main{padding:18px 16px 60px}}
@media print{nav.toc{display:none}main{padding:0}h2{break-after:avoid}}
'''
def idlink(i):
    """추적번호 -> 문서 링크"""
    p=i.split('-')[0]
    f={'REQ':'01-requirements.html','FUN':'02-design.html','SCR':'02-design.html','TBL':'02-design.html','TST':'03-trial-report.html','MUS':'04-user-manual.html'}[p]
    return f'<a class="id" href="{f}#{i}">{i}</a>'
def table(head,rows,raw=False,cls=''):
    h=''.join(f'<th>{x}</th>' for x in head)
    b=''.join('<tr>'+''.join(f'<td>{c if raw else e(str(c))}</td>' for c in r)+'</tr>' for r in rows)
    return f'<div class="tblwrap"><table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'

class Doc:
    def __init__(s,fname,docno,title,sub,purpose):
        s.f,s.no,s.title,s.sub,s.purpose=fname,docno,title,sub,purpose;s.body=[];s.toc=[];s.n=0
    def h2(s,t,anchor=None):
        s.n+=1;a=anchor or f'sec{s.n}';s.toc.append((2,a,t));s.body.append(f'<h2 id="{a}">{e(t)}</h2>')
    def h3(s,t,anchor=None,toc=True):
        s.n+=1;a=anchor or f'sub{s.n}'
        if toc: s.toc.append((3,a,t))
        s.body.append(f'<h3 id="{a}">{e(t)}</h3>')
    def p(s,t,raw=False): s.body.append(f'<p>{t if raw else e(t)}</p>')
    def raw(s,t): s.body.append(t)
    def box(s,t,k='tip'): s.body.append(f'<div class="box {k}">{t}</div>')
    def save(s,docs_nav):
        meta=table(['항목','내용'],[
            ['문서번호',s.no],['문서명',s.title],['프로젝트',PROJ],['문서버전','v1.0'],['작성일',TODAY],
            ['작성 방식','현행 시스템(소스·DB·기존 문서) 기준 역산 작성'],['기준 커밋',D['info']['head']],['목적',s.purpose]],cls='meta')
        rev=table(['버전','일자','작성자','변경 내용'],[['v1.0',TODAY,'HANES MES 개발팀','최초 작성(역산 산출)']])
        toc=''.join(f'<a class="l{l}" href="#{a}">{e(t)}</a>' for l,a,t in s.toc)
        nav=' · '.join(f'<a href="{f}">{n}</a>' for f,n in docs_nav)
        page=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(s.title)}</title><style>{CSS}</style></head><body><div class="wrap">
<nav class="toc"><div class="t">{e(s.title)}</div><a href="#info">문서 정보 · 개정이력</a>{toc}</nav>
<main><div class="top">{nav}</div><h1>{e(s.title)}</h1><div class="mut">{e(s.sub)}</div>
<h2 id="info">문서 정보 · 개정이력</h2>{meta}{rev}
{''.join(s.body)}</main></div></body></html>'''
        os.makedirs(OUT,exist_ok=True)
        open(f'{OUT}/{s.f}','w',encoding='utf-8').write(page)

NAV=[('index.html','산출물 목록'),('01-requirements.html','요구사항 정의서'),('02-design.html','개발 설계서'),('03-trial-report.html','시험 운영 결과 보고서'),('04-user-manual.html','사용자 매뉴얼'),('05-operator-manual.html','전산 운영자 매뉴얼')]
def anchor_cell(i): return f'<span id="{i}"></span>{idlink(i)}'
