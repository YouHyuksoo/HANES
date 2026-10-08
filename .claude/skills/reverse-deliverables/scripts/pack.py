"""산출물 HTML을 전달용 zip 과 Artifact 메인 페이지(page.html)로 묶는다.
사용: python3 pack.py [산출물폴더] [출력폴더]"""
import os,re,sys,shutil,subprocess
R=os.environ.get('HANES_ROOT') or subprocess.run(['git','rev-parse','--show-toplevel'],capture_output=True,text=True).stdout.strip()
src=sys.argv[1] if len(sys.argv)>1 else f'{R}/docs/reports/deliverables'
out=sys.argv[2] if len(sys.argv)>2 else '/tmp/hanes_deliverables/pack'
os.makedirs(out,exist_ok=True)
pk=f'{out}/HANES_MES_산출물'
shutil.rmtree(pk,ignore_errors=True); shutil.copytree(src,pk)
open(f'{pk}/README.txt','w',encoding='utf-8').write('HANES MES 산출물\n\nindex.html 을 브라우저로 열면 전체 목록과 추적 매트릭스가 보입니다.\n파일들은 같은 폴더에 두어야 문서 간 링크가 동작합니다.\n')
shutil.make_archive(f'{out}/HANES_MES_deliverables','zip',out,'HANES_MES_산출물')
t=open(f'{src}/index.html',encoding='utf-8').read()
title=re.search(r'<title>.*?</title>',t,re.S).group(0); style=re.search(r'<style>.*?</style>',t,re.S).group(0); body=re.search(r'<body>(.*)</body>',t,re.S).group(1)
open(f'{out}/page.html','w',encoding='utf-8').write(title+'\n'+style+'\n'+body)
print('zip:',f'{out}/HANES_MES_deliverables.zip','\nartifact page:',f'{out}/page.html')
