DECLARE
  v_prod_plan_count NUMBER;

  PROCEDURE add_item(
    p_code         VARCHAR2,
    p_name         VARCHAR2,
    p_type         VARCHAR2,
    p_product_type VARCHAR2,
    p_spec         VARCHAR2,
    p_unit         VARCHAR2 DEFAULT 'EA',
    p_lead_time    NUMBER DEFAULT 3,
    p_safety_stock NUMBER DEFAULT 0,
    p_lot_qty      NUMBER DEFAULT 1,
    p_box_qty      NUMBER DEFAULT 50,
    p_iqc_flag     VARCHAR2 DEFAULT 'Y',
    p_pack_unit    VARCHAR2 DEFAULT 'BOX',
    p_location     VARCHAR2 DEFAULT 'WH-MAIN',
    p_split        VARCHAR2 DEFAULT 'Y'
  ) IS
  BEGIN
    INSERT INTO ITEM_MASTERS (
      ITEM_CODE, ITEM_NAME, PART_NO, CUST_PART_NO, ITEM_TYPE, PRODUCT_TYPE,
      SPEC, REV, UNIT, LEAD_TIME, SAFETY_STOCK,
      LOT_UNIT_QTY, BOX_QTY, IQC_FLAG, TACT_TIME, EXPIRY_DATE, REMARK,
      USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, PACK_UNIT,
      STORAGE_LOCATION, TOLERANCE_RATE, IS_SPLITTABLE, SAMPLE_QTY,
      INSPECT_METHOD, CREATED_AT, UPDATED_AT
    ) VALUES (
      p_code, p_name, p_code, p_code, p_type, p_product_type,
      p_spec, 'A', p_unit, p_lead_time, p_safety_stock,
      p_lot_qty, p_box_qty, p_iqc_flag, 0, 0, 'HANES harness seed data',
      'Y', '40', '1000', 'seed', 'seed', p_pack_unit,
      p_location, 5, p_split, NULL,
      CASE WHEN p_iqc_flag = 'Y' THEN 'SAMPLING' ELSE NULL END,
      SYSTIMESTAMP, SYSTIMESTAMP
    );
  END;

  PROCEDURE add_bom(
    p_parent VARCHAR2,
    p_child  VARCHAR2,
    p_qty    NUMBER,
    p_seq    NUMBER,
    p_oper   VARCHAR2 DEFAULT 'ASSY',
    p_group  VARCHAR2 DEFAULT 'MAIN'
  ) IS
  BEGIN
    INSERT INTO BOM_MASTERS (
      PARENT_ITEM_CODE, CHILD_ITEM_CODE, QTY_PER, SEQ, REVISION,
      BOM_GRP, OPER, SIDE, ECO_NO, VALID_FROM, VALID_TO, REMARK,
      USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
    ) VALUES (
      p_parent, p_child, p_qty, p_seq, 'A',
      p_group, p_oper, NULL, 'SEED-20260526', DATE '2026-01-01', NULL,
      'HANES harness seed BOM', 'Y', '40', '1000', 'seed', 'seed',
      SYSTIMESTAMP, SYSTIMESTAMP
    );
  END;
BEGIN
  SELECT COUNT(*) INTO v_prod_plan_count FROM PROD_PLANS;
  IF v_prod_plan_count > 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'Cannot reset ITEM_MASTERS: PROD_PLANS has rows.');
  END IF;

  DELETE FROM BOM_MASTERS;
  DELETE FROM ITEM_MASTERS;

  add_item('FG-HNS-001', 'Engine Room Harness', 'FINISHED', 'HARNESS', 'Engine room main wire harness', 'EA', 5, 20, 1, 10, 'N');
  add_item('FG-HNS-002', 'Instrument Panel Harness', 'FINISHED', 'HARNESS', 'IP cockpit wire harness', 'EA', 5, 20, 1, 10, 'N');
  add_item('FG-HNS-003', 'Door Main Harness', 'FINISHED', 'HARNESS', 'Front door main wire harness', 'EA', 4, 20, 1, 10, 'N');
  add_item('FG-HNS-004', 'Roof Harness', 'FINISHED', 'HARNESS', 'Roof lamp and antenna harness', 'EA', 4, 20, 1, 10, 'N');
  add_item('FG-HNS-005', 'Seat Harness', 'FINISHED', 'HARNESS', 'Power seat control harness', 'EA', 4, 20, 1, 10, 'N');
  add_item('FG-HNS-006', 'Battery Cable Harness', 'FINISHED', 'HARNESS', 'Battery cable and ground harness', 'EA', 5, 15, 1, 10, 'N');
  add_item('FG-HNS-007', 'Tail Lamp Harness', 'FINISHED', 'HARNESS', 'Rear lamp wire harness', 'EA', 4, 20, 1, 10, 'N');
  add_item('FG-HNS-008', 'HVAC Harness', 'FINISHED', 'HARNESS', 'HVAC control wire harness', 'EA', 4, 20, 1, 10, 'N');
  add_item('FG-HNS-009', 'ABS Sensor Harness', 'FINISHED', 'HARNESS', 'Wheel speed sensor harness', 'EA', 4, 20, 1, 10, 'N');
  add_item('FG-HNS-010', 'Camera Harness', 'FINISHED', 'HARNESS', 'Camera and ADAS harness', 'EA', 4, 20, 1, 10, 'N');

  add_item('WIP-HNS-001', 'Engine Room Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-001', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-002', 'IP Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-002', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-003', 'Door Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-003', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-004', 'Roof Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-004', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-005', 'Seat Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-005', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-006', 'Battery Cable Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-006', 'EA', 3, 25, 1, 20, 'N');
  add_item('WIP-HNS-007', 'Tail Lamp Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-007', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-008', 'HVAC Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-008', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-009', 'ABS Sensor Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-009', 'EA', 3, 30, 1, 20, 'N');
  add_item('WIP-HNS-010', 'Camera Sub Harness', 'SEMI_PRODUCT', 'SUB_ASSY', 'Sub assembly for FG-HNS-010', 'EA', 3, 30, 1, 20, 'N');

  add_item('RM-WIRE-001', 'TXL Wire 0.35 Red', 'RAW_MATERIAL', 'WIRE', 'TXL 0.35SQ red automotive wire', 'M', 7, 500, 100, 1000, 'Y', 'ROLL', 'WH-RM-WIRE');
  add_item('RM-WIRE-002', 'TXL Wire 0.50 Black', 'RAW_MATERIAL', 'WIRE', 'TXL 0.50SQ black automotive wire', 'M', 7, 500, 100, 1000, 'Y', 'ROLL', 'WH-RM-WIRE');
  add_item('RM-WIRE-003', 'AVSS Wire 0.75 Blue', 'RAW_MATERIAL', 'WIRE', 'AVSS 0.75SQ blue automotive wire', 'M', 7, 500, 100, 1000, 'Y', 'ROLL', 'WH-RM-WIRE');
  add_item('RM-WIRE-004', 'Shield Cable 2C', 'RAW_MATERIAL', 'WIRE', 'Shielded 2 core signal cable', 'M', 10, 200, 50, 500, 'Y', 'ROLL', 'WH-RM-WIRE');
  add_item('RM-TERM-001', 'Terminal Receptacle 0.64', 'RAW_MATERIAL', 'TERMINAL', '0.64 series receptacle terminal', 'EA', 10, 5000, 1000, 5000, 'Y', 'BAG', 'WH-RM-TERM');
  add_item('RM-TERM-002', 'Terminal Tab 2.8', 'RAW_MATERIAL', 'TERMINAL', '2.8 series tab terminal', 'EA', 10, 3000, 1000, 5000, 'Y', 'BAG', 'WH-RM-TERM');
  add_item('RM-CONN-001', 'Connector Housing 12P', 'RAW_MATERIAL', 'CONNECTOR', '12 pole connector housing', 'EA', 14, 500, 100, 1000, 'Y', 'BOX', 'WH-RM-CONN');
  add_item('RM-CONN-002', 'Connector Housing 24P', 'RAW_MATERIAL', 'CONNECTOR', '24 pole connector housing', 'EA', 14, 500, 100, 1000, 'Y', 'BOX', 'WH-RM-CONN');
  add_item('RM-CONN-003', 'Waterproof Connector 6P', 'RAW_MATERIAL', 'CONNECTOR', 'Waterproof 6 pole connector housing', 'EA', 14, 300, 100, 1000, 'Y', 'BOX', 'WH-RM-CONN');
  add_item('RM-SEAL-001', 'Wire Seal 0.64', 'RAW_MATERIAL', 'SEAL', 'Wire seal for 0.64 terminal', 'EA', 10, 3000, 1000, 5000, 'Y', 'BAG', 'WH-RM-CONN');
  add_item('RM-CLIP-001', 'Harness Clip', 'RAW_MATERIAL', 'CLIP', 'Plastic harness fixing clip', 'EA', 7, 1000, 200, 2000, 'Y', 'BAG', 'WH-RM-COMP');
  add_item('RM-TAPE-001', 'PVC Tape 19mm', 'RAW_MATERIAL', 'TAPE', 'Black PVC harness wrapping tape', 'M', 7, 300, 10, 100, 'Y', 'ROLL', 'WH-RM-COMP');
  add_item('RM-TUBE-001', 'Corrugated Tube 7mm', 'RAW_MATERIAL', 'TUBE', 'Split corrugated tube 7mm', 'M', 7, 300, 50, 500, 'Y', 'ROLL', 'WH-RM-COMP');
  add_item('RM-LABEL-001', 'Barcode Label', 'RAW_MATERIAL', 'LABEL', 'Product barcode label', 'EA', 5, 1000, 1000, 5000, 'Y', 'BOX', 'WH-RM-LABEL');
  add_item('RM-FUSE-001', 'Inline Fuse Holder', 'RAW_MATERIAL', 'ELECTRIC', 'Inline fuse holder assembly', 'EA', 14, 200, 50, 500, 'Y', 'BOX', 'WH-RM-ELEC');
  add_item('RM-GROM-001', 'Rubber Grommet', 'RAW_MATERIAL', 'GROMMET', 'Body pass-through rubber grommet', 'EA', 14, 200, 50, 500, 'Y', 'BOX', 'WH-RM-COMP');

  add_bom('FG-HNS-001', 'WIP-HNS-001', 1, 10, 'FINAL');
  add_bom('FG-HNS-001', 'RM-CONN-002', 1, 20, 'FINAL');
  add_bom('FG-HNS-001', 'RM-CLIP-001', 6, 30, 'FINAL');
  add_bom('FG-HNS-001', 'RM-TAPE-001', 3.5, 40, 'FINAL');
  add_bom('FG-HNS-001', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-002', 'WIP-HNS-002', 1, 10, 'FINAL');
  add_bom('FG-HNS-002', 'RM-CONN-002', 2, 20, 'FINAL');
  add_bom('FG-HNS-002', 'RM-CLIP-001', 8, 30, 'FINAL');
  add_bom('FG-HNS-002', 'RM-TAPE-001', 4, 40, 'FINAL');
  add_bom('FG-HNS-002', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-003', 'WIP-HNS-003', 1, 10, 'FINAL');
  add_bom('FG-HNS-003', 'RM-CONN-001', 2, 20, 'FINAL');
  add_bom('FG-HNS-003', 'RM-CLIP-001', 5, 30, 'FINAL');
  add_bom('FG-HNS-003', 'RM-TUBE-001', 1.2, 40, 'FINAL');
  add_bom('FG-HNS-003', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-004', 'WIP-HNS-004', 1, 10, 'FINAL');
  add_bom('FG-HNS-004', 'RM-CONN-001', 1, 20, 'FINAL');
  add_bom('FG-HNS-004', 'RM-CLIP-001', 7, 30, 'FINAL');
  add_bom('FG-HNS-004', 'RM-TAPE-001', 2.5, 40, 'FINAL');
  add_bom('FG-HNS-004', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-005', 'WIP-HNS-005', 1, 10, 'FINAL');
  add_bom('FG-HNS-005', 'RM-CONN-001', 2, 20, 'FINAL');
  add_bom('FG-HNS-005', 'RM-CLIP-001', 4, 30, 'FINAL');
  add_bom('FG-HNS-005', 'RM-TAPE-001', 2, 40, 'FINAL');
  add_bom('FG-HNS-005', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-006', 'WIP-HNS-006', 1, 10, 'FINAL');
  add_bom('FG-HNS-006', 'RM-FUSE-001', 1, 20, 'FINAL');
  add_bom('FG-HNS-006', 'RM-GROM-001', 1, 30, 'FINAL');
  add_bom('FG-HNS-006', 'RM-TUBE-001', 1.8, 40, 'FINAL');
  add_bom('FG-HNS-006', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-007', 'WIP-HNS-007', 1, 10, 'FINAL');
  add_bom('FG-HNS-007', 'RM-CONN-003', 2, 20, 'FINAL');
  add_bom('FG-HNS-007', 'RM-SEAL-001', 12, 30, 'FINAL');
  add_bom('FG-HNS-007', 'RM-CLIP-001', 4, 40, 'FINAL');
  add_bom('FG-HNS-007', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-008', 'WIP-HNS-008', 1, 10, 'FINAL');
  add_bom('FG-HNS-008', 'RM-CONN-001', 2, 20, 'FINAL');
  add_bom('FG-HNS-008', 'RM-CLIP-001', 5, 30, 'FINAL');
  add_bom('FG-HNS-008', 'RM-TAPE-001', 2.5, 40, 'FINAL');
  add_bom('FG-HNS-008', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-009', 'WIP-HNS-009', 1, 10, 'FINAL');
  add_bom('FG-HNS-009', 'RM-CONN-003', 2, 20, 'FINAL');
  add_bom('FG-HNS-009', 'RM-SEAL-001', 8, 30, 'FINAL');
  add_bom('FG-HNS-009', 'RM-TUBE-001', 1.5, 40, 'FINAL');
  add_bom('FG-HNS-009', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('FG-HNS-010', 'WIP-HNS-010', 1, 10, 'FINAL');
  add_bom('FG-HNS-010', 'RM-WIRE-004', 2.5, 20, 'FINAL');
  add_bom('FG-HNS-010', 'RM-CONN-003', 2, 30, 'FINAL');
  add_bom('FG-HNS-010', 'RM-CLIP-001', 5, 40, 'FINAL');
  add_bom('FG-HNS-010', 'RM-LABEL-001', 1, 50, 'FINAL');

  add_bom('WIP-HNS-001', 'RM-WIRE-001', 4.2, 10, 'CUT');
  add_bom('WIP-HNS-001', 'RM-WIRE-002', 3.8, 20, 'CUT');
  add_bom('WIP-HNS-001', 'RM-TERM-001', 16, 30, 'CRIMP');
  add_bom('WIP-HNS-001', 'RM-SEAL-001', 8, 40, 'CRIMP');
  add_bom('WIP-HNS-001', 'RM-CONN-001', 2, 50, 'ASSY');

  add_bom('WIP-HNS-002', 'RM-WIRE-001', 5, 10, 'CUT');
  add_bom('WIP-HNS-002', 'RM-WIRE-003', 4.5, 20, 'CUT');
  add_bom('WIP-HNS-002', 'RM-TERM-001', 20, 30, 'CRIMP');
  add_bom('WIP-HNS-002', 'RM-CONN-002', 1, 40, 'ASSY');
  add_bom('WIP-HNS-002', 'RM-TUBE-001', 1.5, 50, 'ASSY');

  add_bom('WIP-HNS-003', 'RM-WIRE-002', 3.2, 10, 'CUT');
  add_bom('WIP-HNS-003', 'RM-WIRE-003', 2.4, 20, 'CUT');
  add_bom('WIP-HNS-003', 'RM-TERM-001', 12, 30, 'CRIMP');
  add_bom('WIP-HNS-003', 'RM-CONN-001', 1, 40, 'ASSY');

  add_bom('WIP-HNS-004', 'RM-WIRE-001', 2.5, 10, 'CUT');
  add_bom('WIP-HNS-004', 'RM-WIRE-002', 2.5, 20, 'CUT');
  add_bom('WIP-HNS-004', 'RM-TERM-001', 10, 30, 'CRIMP');
  add_bom('WIP-HNS-004', 'RM-CONN-001', 1, 40, 'ASSY');

  add_bom('WIP-HNS-005', 'RM-WIRE-002', 3, 10, 'CUT');
  add_bom('WIP-HNS-005', 'RM-WIRE-003', 2, 20, 'CUT');
  add_bom('WIP-HNS-005', 'RM-TERM-002', 8, 30, 'CRIMP');
  add_bom('WIP-HNS-005', 'RM-CONN-001', 1, 40, 'ASSY');

  add_bom('WIP-HNS-006', 'RM-WIRE-003', 2.8, 10, 'CUT');
  add_bom('WIP-HNS-006', 'RM-WIRE-004', 1.5, 20, 'CUT');
  add_bom('WIP-HNS-006', 'RM-TERM-002', 6, 30, 'CRIMP');
  add_bom('WIP-HNS-006', 'RM-FUSE-001', 1, 40, 'ASSY');

  add_bom('WIP-HNS-007', 'RM-WIRE-001', 2.6, 10, 'CUT');
  add_bom('WIP-HNS-007', 'RM-WIRE-002', 2.6, 20, 'CUT');
  add_bom('WIP-HNS-007', 'RM-TERM-001', 12, 30, 'CRIMP');
  add_bom('WIP-HNS-007', 'RM-CONN-003', 1, 40, 'ASSY');

  add_bom('WIP-HNS-008', 'RM-WIRE-001', 3.1, 10, 'CUT');
  add_bom('WIP-HNS-008', 'RM-WIRE-003', 2.7, 20, 'CUT');
  add_bom('WIP-HNS-008', 'RM-TERM-001', 14, 30, 'CRIMP');
  add_bom('WIP-HNS-008', 'RM-CONN-001', 1, 40, 'ASSY');

  add_bom('WIP-HNS-009', 'RM-WIRE-004', 2, 10, 'CUT');
  add_bom('WIP-HNS-009', 'RM-TERM-001', 8, 20, 'CRIMP');
  add_bom('WIP-HNS-009', 'RM-SEAL-001', 8, 30, 'CRIMP');
  add_bom('WIP-HNS-009', 'RM-CONN-003', 1, 40, 'ASSY');

  add_bom('WIP-HNS-010', 'RM-WIRE-004', 3.5, 10, 'CUT');
  add_bom('WIP-HNS-010', 'RM-TERM-001', 10, 20, 'CRIMP');
  add_bom('WIP-HNS-010', 'RM-SEAL-001', 10, 30, 'CRIMP');
  add_bom('WIP-HNS-010', 'RM-CONN-003', 1, 40, 'ASSY');
END;
/
