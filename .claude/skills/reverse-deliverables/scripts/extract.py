import re,json,glob,os,subprocess
import os,subprocess
R=os.environ.get('HANES_ROOT') or subprocess.run(['git','rev-parse','--show-toplevel'],capture_output=True,text=True).stdout.strip()
WORK=os.environ.get('HD_WORK','/tmp/hanes_deliverables')
os.makedirs(WORK,exist_ok=True)
ko=json.load(open(f'{R}/apps/frontend/src/locales/ko.json',encoding='utf-8'))['menu']
def lab(k): return ko.get(k.replace('menu.','',1),k)
# menu
mods=[];cur=None
for line in open(f'{R}/apps/frontend/src/config/menuConfig.ts',encoding='utf-8'):
    m=re.match(r'^    code: "(\w+)"',line)
    if m: cur={'code':m.group(1),'label':None,'path':None,'screens':[]};mods.append(cur);continue
    m=re.match(r'^    labelKey: "([^"]+)"',line)
    if m and cur: cur['label']=lab(m.group(1));continue
    m=re.match(r'^    path: "([^"]+)"',line)
    if m and cur: cur['path']=m.group(1);continue
    m=re.search(r'\{ code: "(\w+)", labelKey: "([^"]+)"(?:, path: "([^"]+)")?',line)
    if m and cur: cur['screens'].append({'code':m.group(1),'label':lab(m.group(2)),'path':m.group(3)})
# top-level single-line modules w/o children are those with path and no screens -> treat as screen
# business logic docs by menu code
bl={}
for f in glob.glob(f'{R}/docs/business-logics/*.md'):
    t=open(f,encoding='utf-8-sig').read()
    code=os.path.basename(f)[:-3]
    p=None
    m=re.search(r'(?:화면 목적|목적)\*{0,2}\s*\|\s*([^|\n]+)\|',t)
    if m:p=m.group(1).strip()
    if not p:
        m=re.search(r'## 1\. 화면 개요\s*\n+([^\n|#`>][^\n]+)',t)
        if m:p=re.sub(r'[*`]','',m.group(1)).strip()
    if p and len(p)>110: p=p[:108].rstrip()+'…'
    bl[code]=p
# tables
tabs=[];t=open(f'{R}/docs/database/table-catalog.md',encoding='utf-8-sig').read()
for m in re.finditer(r'^## (\w+) — (.+)$',t,re.M): tabs.append((m.group(1),m.group(2).strip()))
# backend modules + controllers
bm={}
for d in sorted(glob.glob(f'{R}/apps/backend/src/modules/*')):
    n=os.path.basename(d)
    bm[n]=len(glob.glob(d+'/**/*.controller.ts',recursive=True))
ents=len(glob.glob(f'{R}/apps/backend/src/entities/**/*.entity.ts',recursive=True)) or len(glob.glob(f'{R}/apps/backend/src/**/*.entity.ts',recursive=True))
def sh(c): return subprocess.run(c,shell=True,cwd=R,capture_output=True,text=True).stdout.strip()
info={'pages':int(sh("find apps/frontend/src/app -name page.tsx | wc -l")),
 'entities':ents,'migrations':int(sh("find . -name '*.sql' -not -path '*/node_modules/*' | wc -l")),
 'specs':int(sh("find apps -name '*.spec.ts' -not -path '*/node_modules/*' | wc -l")),
 'tests':int(sh("find apps -name '*.test.*' -not -path '*/node_modules/*' | wc -l")),
 'scen':int(sh("find . -path ./node_modules -prune -o -name '*.json' -path '*scenario*' -print | wc -l")),
 'commits':int(sh("git log --oneline | wc -l")),'first':sh("git log --reverse --format=%ad --date=short | head -1"),'last':sh("git log -1 --format=%ad --date=short"),'head':sh("git log -1 --format=%h"),
 'reports':sorted(os.path.basename(x) for x in glob.glob(f'{R}/docs/reports/*.md')),
 'plans':sorted(os.path.basename(x) for x in glob.glob(f'{R}/docs/plans/*.md')),
 'adr':sorted(os.path.basename(x) for x in glob.glob(f'{R}/docs/adr/*.md'))}
json.dump({'mods':mods,'bl':bl,'tabs':tabs,'bm':bm,'info':info},open(os.path.join(WORK,'data.json'),'w'),ensure_ascii=False,indent=1)
print(len(mods),sum(len(m['screens']) for m in mods),len(tabs),len(bl),info)
for m in mods: print(m['code'],m['label'],len(m['screens']))
