export interface CalibrationRow {
  calibrationNo: string;
  gaugeCode: string;
  gaugeName: string;
  calibrationDate: string;
  calibrationType: string;
  calibrator: string;
  calibrationOrg: string;
  result: string;
  measuredValue: string | null;
  referenceValue: string | null;
  deviation: string | null;
  uncertainty: string | null;
  certificateNo: string | null;
}
