-- 4M 변경점관리 시드 데이터 (COMPANY: 40, PLANT: VNHNS)
-- 실제 품목(91200-AB100, AVS-050-BK 등)을 참조한 현실적 데이터

-- 1. COMPLETED: 전선 규격 변경 (자재 변경, 긴급)
INSERT INTO CHANGE_ORDERS (
  CHANGE_NO, CHANGE_TYPE, TITLE, DESCRIPTION, REASON, RISK_ASSESSMENT,
  AFFECTED_ITEMS, AFFECTED_PROCESSES, PRIORITY, STATUS,
  REQUESTED_BY, REQUESTED_AT, REVIEWER_CODE, REVIEWED_AT, REVIEW_COMMENT,
  APPROVER_CODE, APPROVED_AT, EFFECTIVE_DATE, COMPLETION_DATE,
  COMPANY, PLANT, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  'ECN-20260301-001', 'MATERIAL',
  'Engine Room Harness Wire Spec Change (AVS 0.5sq to 0.85sq)',
  '91200-AB100 Engine Room Harness Assy power circuit wire change from AVS-050-BK to AVS-085-RD. Purpose: resolve heat generation due to insufficient current capacity.',
  'Customer (Hyundai Motor) field claim received. Heat generation in power circuit during summer engine room temperature rise. Wire spec upgrade needed for current margin.',
  'Risk Level: Medium. Wire OD increase (1.6mm to 2.0mm) requires grommet clearance verification. Existing connector housing (CH-090-6P) compatibility confirmed.',
  'AVS-050-BK, AVS-085-RD, 91200-AB100, SUB-EH-MAIN',
  'L1-CUTTING, L1-CRIMPING, L1-ASSEMBLY',
  'HIGH', 'COMPLETED',
  'admin@hanes.com', TIMESTAMP '2026-03-01 09:00:00',
  'admin@hanes.com', TIMESTAMP '2026-03-02 14:30:00', 'IQC test passed. Wire compatibility confirmed.',
  'admin@hanes.com', TIMESTAMP '2026-03-03 10:00:00',
  DATE '2026-03-10', DATE '2026-03-15',
  '40', 'VNHNS', 'admin@hanes.com', 'admin@hanes.com',
  TIMESTAMP '2026-03-01 09:00:00', TIMESTAMP '2026-03-15 16:00:00'
)
