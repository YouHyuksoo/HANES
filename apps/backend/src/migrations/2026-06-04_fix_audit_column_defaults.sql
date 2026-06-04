BEGIN
  -- =========================================================================
  -- 2026-06-04_fix_audit_column_defaults.sql
  -- -------------------------------------------------------------------------
  -- 목적: 감사 컬럼(CREATED_AT/UPDATED_AT)이 NOT NULL인데 DB DEFAULT가 없어서
  --       INSERT 시 ORA-01400(NULL 삽입 불가)이 발생하는 문제를 일괄 해결한다.
  --
  -- 근본 원인:
  --   TypeORM 0.3.x Oracle 드라이버는 @CreateDateColumn/@UpdateDateColumn 값을
  --   JS에서 채우지 않는다(해당 로직은 mongodb 드라이버 전용 분기에만 존재).
  --   값이 undefined인 채 단건 Oracle INSERT가 빌드되면 InsertQueryBuilder는
  --   컬럼에 리터럴 'DEFAULT' 키워드를 출력하므로, 실제 DB 컬럼에 DEFAULT가 없으면
  --   NULL이 들어가 NOT NULL 제약 위반(ORA-01400)이 발생한다.
  --   => 이 스키마는 감사 컬럼 값을 "DB 컬럼 DEFAULT SYSTIMESTAMP"에 의존한다.
  --      재생성/리네임 과정에서 DEFAULT가 누락된 테이블들을 컨벤션에 맞게 보정한다.
  --
  -- 동작:
  --   CREATED_AT/UPDATED_AT 이면서 NOT NULL & DEFAULT 없는 컬럼을 찾아 각각
  --   DEFAULT SYSTIMESTAMP 를 부여한다. 기존 행/타입/NULL 허용 여부는 변경하지
  --   않으며(향후 INSERT 기본값만), 멱등이라 재실행해도 무해하다.
  --
  -- 작성 시점(2026-06-04) JSHANES(test 스키마)에서 보정된 33개 테이블 / 64개 컬럼:
  --   BOM_MASTERS, BOX_MASTERS, COMM_CONFIGS, COMPANY_MASTERS, COM_CODES,
  --   CONSUMABLE_LOGS(CREATED_AT만), CONSUMABLE_MASTERS, CUSTOMER_ORDERS,
  --   CUSTOMER_ORDER_ITEMS, DEPARTMENT_MASTERS, EQUIP_INSPECT_ITEM_MASTERS,
  --   EQUIP_INSPECT_LOGS, EQUIP_MASTERS, INSPECT_RESULTS(CREATED_AT만),
  --   IQC_GROUPS, IQC_PART_LINKS, ITEM_MASTERS, JOB_ORDERS, PALLET_MASTERS,
  --   PARTNER_MASTERS, PROCESS_MAPS, PROCESS_MASTERS, PROCESS_QUALITY_CONDITIONS,
  --   PROD_LINE_MASTERS, PURCHASE_ORDERS, ROLES, ROUTING_GROUPS, ROUTING_PROCESSES,
  --   SHIPMENT_LOGS, SYS_CONFIGS, USERS, WAREHOUSES, WORKER_MASTERS
  -- =========================================================================
  FOR c IN (
    SELECT table_name, column_name
    FROM   user_tab_columns
    WHERE  column_name IN ('CREATED_AT', 'UPDATED_AT')
    AND    nullable = 'N'
    AND    data_default IS NULL
  ) LOOP
    EXECUTE IMMEDIATE
      'ALTER TABLE "' || c.table_name || '" MODIFY ("' || c.column_name || '" DEFAULT SYSTIMESTAMP)';
  END LOOP;
END;
/
