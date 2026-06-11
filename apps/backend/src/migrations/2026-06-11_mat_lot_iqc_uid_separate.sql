DECLARE
  -- MAT_LOTS sample seed UID separation from IQC_LOGS.
  -- IQC_LOGS keeps the inspected MAT_UID values; inventory-side seed rows move
  -- to MLT-* values so material lot screens do not look like the same inspected lots.
  PROCEDURE move_lot_uid(p_old_uid VARCHAR2, p_new_uid VARCHAR2) IS
    v_old_refs NUMBER := 0;
    v_new_refs NUMBER := 0;
  BEGIN
    SELECT SUM(cnt)
      INTO v_old_refs
      FROM (
        SELECT COUNT(*) cnt FROM MAT_LOTS WHERE MAT_UID = p_old_uid
        UNION ALL
        SELECT COUNT(*) cnt FROM MAT_STOCKS WHERE MAT_UID = p_old_uid
        UNION ALL
        SELECT COUNT(*) cnt FROM STOCK_TRANSACTIONS WHERE MAT_UID = p_old_uid
      );

    SELECT SUM(cnt)
      INTO v_new_refs
      FROM (
        SELECT COUNT(*) cnt FROM MAT_LOTS WHERE MAT_UID = p_new_uid
        UNION ALL
        SELECT COUNT(*) cnt FROM MAT_STOCKS WHERE MAT_UID = p_new_uid
        UNION ALL
        SELECT COUNT(*) cnt FROM STOCK_TRANSACTIONS WHERE MAT_UID = p_new_uid
      );

    IF v_old_refs > 0 AND v_new_refs > 0 THEN
      RAISE_APPLICATION_ERROR(
        -20001,
        'Cannot move MAT_UID because both old and new inventory refs exist: ' || p_old_uid || ' -> ' || p_new_uid
      );
    END IF;

    UPDATE STOCK_TRANSACTIONS
       SET MAT_UID = p_new_uid
     WHERE MAT_UID = p_old_uid;

    UPDATE MAT_STOCKS
       SET MAT_UID = p_new_uid
     WHERE MAT_UID = p_old_uid;

    UPDATE MAT_LOTS
       SET MAT_UID = p_new_uid,
           UPDATED_AT = SYSTIMESTAMP,
           UPDATED_BY = 'seed-fix'
     WHERE MAT_UID = p_old_uid;
  END move_lot_uid;
BEGIN
  move_lot_uid('VH1-RM260526-00007', 'MLT-RM260526-00007');
  move_lot_uid('VH1-RM260603-00003', 'MLT-RM260603-00003');
  move_lot_uid('VH1-RM260605-00002', 'MLT-RM260605-00002');
  move_lot_uid('VH1-RM260607-00001', 'MLT-RM260607-00001');
END;
/
