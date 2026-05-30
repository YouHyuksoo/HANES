DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
    FROM user_constraints
   WHERE table_name = 'DEFECT_LOGS'
     AND constraint_type = 'P';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE DEFECT_LOGS ADD CONSTRAINT PK_DEFECT_LOGS PRIMARY KEY (OCCUR_TIME, SEQ)';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
    FROM user_constraints
   WHERE table_name = 'LABEL_PRINT_LOGS'
     AND constraint_type = 'P';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE LABEL_PRINT_LOGS MODIFY (PRINTED_AT NOT NULL)';
    EXECUTE IMMEDIATE 'ALTER TABLE LABEL_PRINT_LOGS ADD CONSTRAINT PK_LABEL_PRINT_LOGS PRIMARY KEY (PRINTED_AT, SEQ)';
  END IF;
END;
/

DECLARE
  v_pk_count NUMBER;
  v_unique_name user_constraints.constraint_name%TYPE;
BEGIN
  SELECT COUNT(*)
    INTO v_pk_count
    FROM user_constraints
   WHERE table_name = 'PROD_PLANS'
     AND constraint_type = 'P';

  IF v_pk_count = 0 THEN
    BEGIN
      SELECT cons.constraint_name
        INTO v_unique_name
        FROM user_constraints cons
       WHERE cons.table_name = 'PROD_PLANS'
         AND cons.constraint_type = 'U'
         AND 1 = (
           SELECT COUNT(*)
             FROM user_cons_columns cols
            WHERE cols.constraint_name = cons.constraint_name
              AND cols.table_name = cons.table_name
              AND cols.column_name = 'PLAN_NO'
         )
         AND NOT EXISTS (
           SELECT 1
             FROM user_constraints child
            WHERE child.r_constraint_name = cons.constraint_name
         )
         AND ROWNUM = 1;

      EXECUTE IMMEDIATE 'ALTER TABLE PROD_PLANS DROP CONSTRAINT ' || v_unique_name;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        NULL;
    END;

    EXECUTE IMMEDIATE 'ALTER TABLE PROD_PLANS ADD CONSTRAINT PK_PROD_PLANS PRIMARY KEY (PLAN_NO)';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
    FROM user_constraints
   WHERE table_name = 'TRACE_LOGS'
     AND constraint_type = 'P';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE TRACE_LOGS ADD CONSTRAINT PK_TRACE_LOGS PRIMARY KEY (TRACE_TIME, SEQ)';
  END IF;
END;
/

DECLARE
  v_pk_count NUMBER;
  v_unique_name user_constraints.constraint_name%TYPE;
BEGIN
  SELECT COUNT(*)
    INTO v_pk_count
    FROM user_constraints
   WHERE table_name = 'VENDOR_MASTERS'
     AND constraint_type = 'P';

  IF v_pk_count = 0 THEN
    BEGIN
      SELECT cons.constraint_name
        INTO v_unique_name
        FROM user_constraints cons
       WHERE cons.table_name = 'VENDOR_MASTERS'
         AND cons.constraint_type = 'U'
         AND 1 = (
           SELECT COUNT(*)
             FROM user_cons_columns cols
            WHERE cols.constraint_name = cons.constraint_name
              AND cols.table_name = cons.table_name
              AND cols.column_name = 'VENDOR_CODE'
         )
         AND NOT EXISTS (
           SELECT 1
             FROM user_constraints child
            WHERE child.r_constraint_name = cons.constraint_name
         )
         AND ROWNUM = 1;

      EXECUTE IMMEDIATE 'ALTER TABLE VENDOR_MASTERS DROP CONSTRAINT ' || v_unique_name;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        NULL;
    END;

    EXECUTE IMMEDIATE 'ALTER TABLE VENDOR_MASTERS ADD CONSTRAINT PK_VENDOR_MASTERS PRIMARY KEY (VENDOR_CODE)';
  END IF;
END;
/
