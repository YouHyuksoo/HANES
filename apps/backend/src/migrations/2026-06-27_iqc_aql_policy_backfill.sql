-- 기존 품목마스터의 IQC AQL 정책 누락 정합성 보정
-- 무검사(SKIP/NONE)는 정책 없이 허용하고, 유검사로 해석되는 IQC 대상 품목만 기본 정책을 부여한다.

UPDATE ITEM_MASTERS
   SET IQC_AQL_POLICY_CODE = 'AQLP-II-1.0-2.5'
 WHERE USE_YN = 'Y'
   AND NVL(IQC_FLAG, 'Y') = 'Y'
   AND IQC_AQL_POLICY_CODE IS NULL
   AND NVL(INSPECT_METHOD, 'FULL') NOT IN ('SKIP', 'NONE');

COMMIT;
