export const pfmeaColumns = [
  ['ROW_SEQ', '순번'], ['PROCESS_FUNCTION', '공정 기능'], ['REQUIREMENT', '요구사항'], ['FAILURE_MODE', '잠재 고장형태'],
  ['FAILURE_EFFECT', '잠재 영향'], ['SEVERITY', 'S'], ['SPECIAL_CHAR_CODE', '특별특성'], ['FAILURE_CAUSE', '잠재 원인'],
  ['PREVENTION_CONTROL', '현 예방관리'], ['OCCURRENCE', 'O'], ['DETECTION_CONTROL', '현 검출관리'], ['DETECTION', 'D'],
  ['RPN', 'RPN'], ['RECOMMENDED_ACTION', '권고조치'], ['RESPONSIBLE_ORG', '책임조직'], ['RESPONSIBLE_PERSON', '책임자'],
  ['TARGET_DATE', '목표일'], ['COMPLETED_ACTION', '완료조치'], ['COMPLETION_DATE', '완료일'], ['ACTION_SEVERITY', '조치 S'],
  ['ACTION_OCCURRENCE', '조치 O'], ['ACTION_DETECTION', '조치 D'], ['ACTION_RPN', '조치 RPN'],
] as const;
