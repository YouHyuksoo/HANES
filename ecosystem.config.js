/**
 * @file ecosystem.config.js
 * @description PM2 프로세스 관리 설정 - HANES MES (Frontend + Backend)
 *
 * 초보자 가이드:
 * - 시작: pm2 start ecosystem.config.js
 * - 재시작: pm2 restart hanes-frontend hanes-backend
 * - 중지: pm2 stop hanes-frontend hanes-backend
 * - 로그: pm2 logs hanes-frontend / pm2 logs hanes-backend
 *
 * 주의: pm2 kill 사용 금지! (같은 서버의 다른 프로젝트도 죽음)
 * 반드시 프로세스 이름(hanes-frontend, hanes-backend)으로 제어할 것
 */
module.exports = {
  apps: [
    {
      name: "hanes-frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      cwd: "C:\\Project\\HANES\\apps\\frontend",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
      watch: false,
      max_memory_restart: "1G",
      error_file: "C:\\Project\\HANES\\logs\\frontend-error.log",
      out_file: "C:\\Project\\HANES\\logs\\frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
    },
    {
      name: "hanes-backend",
      script: "dist/main.js",
      cwd: "C:\\Project\\HANES\\apps\\backend",
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
      watch: false,
      max_memory_restart: "1G",
      error_file: "C:\\Project\\HANES\\logs\\backend-error.log",
      out_file: "C:\\Project\\HANES\\logs\\backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
    },
  ],
};
