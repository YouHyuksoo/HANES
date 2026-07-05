# Backend SQL Migrations

이 디렉토리의 `.sql` 파일은 TypeORM `migrations:run` 으로 자동 실행되지 **않습니다**.
운영자가 직접 적용해야 하며, 누락 시 backend 가 시퀀스/인덱스 부재로 `ORA-02289` 등의 런타임 에러를 일으킵니다.

## 적용 절차

```powershell
pnpm --filter @harness/backend exec oracle-db apply src/migrations/<file>.sql --site JSHANES
```

또는 직접 SQL\*Plus / SQL Developer 로 실행합니다.

## 스키마 문서 갱신 필수

테이블, 컬럼, PK, FK, UK, CHECK 제약, 컬럼 기본값, 컬럼 주석, `COM_CODES` 기반 코드 도메인을 변경하는 마이그레이션을 추가하거나 적용하면 반드시 아래 명령으로 DB 스키마/ERD 문서를 갱신합니다.

```powershell
python tools/generate_db_schema_doc.py
```

갱신 대상:

- `docs/database/schema-erd.md`

스키마 변경 작업은 마이그레이션 SQL만으로 완료된 것으로 보지 않습니다. 문서 갱신 결과를 같은 작업 범위에 포함하고, 검증 로그에 문서 재생성 명령을 남깁니다.

## 실행 순서

| Order | File | Purpose |
|------:|------|---------|
| 1 | `2026-05-26_create_log_sequences.sql` | 로그 테이블/스케줄러 ID/IQC 템플릿 채번을 위한 Oracle sequence 생성 |
| 2 | `2026-05-26_physical_inv_session_uniq.sql` | PHYSICAL_INV_SESSIONS partial unique index — 단일 IN_PROGRESS 보장 |
| 3 | `2026-05-26_seed_iqc_and_reset_inventory_flow.sql` | IQC 시드 + 입출고 flow 데이터 reset (Codex T-006) |
| 4 | `2026-05-26_reset_hanes_item_bom_seed.sql` | ITEM_MASTERS / BOM_MASTERS 시드 reset (Codex T-005) |

## 적용 시점 주의 (cutover race)

`2026-05-26_create_log_sequences.sql` 은 각 sequence 의 `START WITH` 를 `MAX(SEQ) + 1` 로 계산합니다.
구 코드(`NVL(MAX(SEQ)) + 1` client-side 채번)가 실행 중인 상태에서 마이그를 돌리면 다음과 같이 충돌이 날 수 있습니다.

```
t0  SELECT MAX(SEQ)+1 INTO v_start;     -- v_start = 501
t1  (구 코드 인스턴스) INSERT SEQ=501;   -- 동시 발행
t2  CREATE SEQUENCE START WITH 501;
t3  (신 코드 인스턴스) NEXTVAL = 501;    -- 충돌! ORA-00001
```

안전 절차:

1. 신 코드 배포 직전, **모든 구 코드 인스턴스를 정지하거나 write off** 한다.
2. 본 마이그를 실행한다.
3. 신 코드를 기동한다.

무중단 배포가 필요한 환경에서는 application-level write lock 또는 짧은 maintenance window 를 잡아 INSERT 를 잠시 멈춘 뒤 실행해야 합니다.

## 미적용 환경 감지

backend 가 sequence 미존재 환경에 배포되면 첫 INSERT 시점에 다음과 같은 에러가 발생합니다.

```
ORA-02289: sequence does not exist
```

배포 후 smoke test 로 다음을 확인하세요:

- 단건 INTER_LOGS 기록 발생 시 정상 응답
- ConsumableLabel `confirmReceiving` 정상 응답
- IQC 템플릿 신규 생성 정상 응답
