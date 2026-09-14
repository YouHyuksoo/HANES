// jest-oracle.json 으로 실행할 때만 실 Oracle 스모크를 켠다.
// (cross-env 의존성 없이 플랫폼 중립으로 플래그를 세우기 위한 setup 파일)
process.env.RUN_ORACLE_SMOKE = '1';
