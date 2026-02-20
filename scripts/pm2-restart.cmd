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
timeout /t 2 /nobreak >nul

:: logs 폴더 생성
if not exist "C:\Project\HANES\logs" mkdir "C:\Project\HANES\logs"

:: ecosystem.config.js로 HANES 프로세스만 시작
cd /d C:\Project\HANES
pm2 start ecosystem.config.js --update-env

:: 현재 상태 저장
pm2 save

echo [%date% %time%] HANES PM2 restart completed
pm2 list
