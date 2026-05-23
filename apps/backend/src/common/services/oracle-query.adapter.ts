import { Injectable } from '@nestjs/common';
import { OracleService } from './oracle.service';

export type OracleInParams = Record<string, unknown>;

@Injectable()
export class OracleQueryAdapter {
  constructor(private readonly oracle: OracleService) {}

  async fetchCursor<T = Record<string, unknown>>(
    packageName: string,
    procName: string,
    inParams?: OracleInParams,
  ): Promise<T[]> {
    return this.oracle.callProc<T>(packageName, procName, inParams);
  }

  async fetchCursors<T = Record<string, unknown>>(
    packageName: string,
    procName: string,
    cursorNames: string[],
    inParams?: OracleInParams,
  ): Promise<Record<string, T[]>> {
    return this.oracle.callProcMultiCursor<T>(
      packageName,
      procName,
      cursorNames,
      inParams,
    );
  }
}
