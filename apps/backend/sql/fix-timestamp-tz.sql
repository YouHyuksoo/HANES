DECLARE
  v_cnt NUMBER;
BEGIN
  FOR rec IN (
    SELECT table_name, column_name
    FROM user_tab_columns
    WHERE data_type LIKE '%TIME ZONE%'
    ORDER BY table_name, column_name
  ) LOOP
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM "' || rec.table_name || '" WHERE ROWNUM <= 1' INTO v_cnt;
    IF v_cnt = 0 THEN
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE "' || rec.table_name || '" MODIFY ("' || rec.column_name || '" TIMESTAMP(6))';
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSE
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE "' || rec.table_name || '" ADD ("' || rec.column_name || '_TMP" TIMESTAMP(6))';
        EXECUTE IMMEDIATE 'UPDATE "' || rec.table_name || '" SET "' || rec.column_name || '_TMP" = CAST("' || rec.column_name || '" AS TIMESTAMP)';
        EXECUTE IMMEDIATE 'ALTER TABLE "' || rec.table_name || '" DROP COLUMN "' || rec.column_name || '"';
        EXECUTE IMMEDIATE 'ALTER TABLE "' || rec.table_name || '" RENAME COLUMN "' || rec.column_name || '_TMP" TO "' || rec.column_name || '"';
        COMMIT;
      EXCEPTION WHEN OTHERS THEN
        ROLLBACK;
      END;
    END IF;
  END LOOP;
END;
