@echo off
:: =============================================================
:: HANES MES PM2 재시작 스크립트
:: GitHub Actions에서 schtasks로 호출됨
::
:: 핵심: pm2 kill 사용 금지! (다른 프로젝트에 영향)
:: hanes-frontend, hanes-backend 이름으로만 제어
:: =============================================================

set PM2_HOME=C:\Users\Administrator\.pm2

echo [%date% %time%] HANES PM2 restart started

:: 기존 HANES 프로세스만 중지/삭제 (다른 프로젝트 무관)
pm2 delete hanes-frontend 2>nul
pm2 delete hanes-backend 2>nul
pm2 delete hanes-proxy 2>nul
timeout /t 2 /nobreak >nul

:: pm2 delete 는 등록만 지운다. 남은 자식 프로세스 트리가 포트를 계속 물고 있으면
:: 새 프로세스가 EADDRINUSE 로 죽고 좀비가 포트를 서비스한다(TCP 는 붙는데 HTTP 무응답).
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Project\HANES\scripts\free-hanes-ports.ps1
if errorlevel 1 (
  echo [ERROR] HANES 포트를 비우지 못했습니다. 위 메시지를 확인하세요.
  exit /b 1
)

:: logs 폴더 생성
if not exist "C:\Project\HANES\logs" mkdir "C:\Project\HANES\logs"

:: ecosystem.config.js로 HANES 프로세스만 시작
cd /d C:\Project\HANES
pm2 start ecosystem.config.js --update-env

:: 현재 상태 저장
pm2 save

echo [%date% %time%] HANES PM2 restart completed
pm2 list
