/**
 * @file controllers/db-connection.controller.ts
 * @description DB 접속 설정 API (관리자 전용)
 *
 * DB 비밀번호를 다루므로 모든 엔드포인트에 ADMIN 권한을 요구한다.
 * 조회 응답에도 비밀번호 원문은 포함하지 않는다.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { DbConnectionService } from '../services/db-connection.service';
import { DbConnectionInputDto } from '../dto/db-connection.dto';

@ApiTags('시스템관리 - DB 접속 설정')
@Controller('system/db-connection')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class DbConnectionController {
  constructor(private readonly dbConnectionService: DbConnectionService) {}

  @Get()
  @ApiOperation({ summary: '현재 DB 접속 설정 조회 (비밀번호 마스킹)' })
  getCurrent() {
    return ResponseUtil.success(this.dbConnectionService.getCurrent());
  }

  @Get('status')
  @ApiOperation({ summary: '재시작 필요 여부 조회' })
  getStatus() {
    return ResponseUtil.success(this.dbConnectionService.getStatus());
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '입력값으로 접속 테스트' })
  async test(@Body() dto: DbConnectionInputDto) {
    return ResponseUtil.success(await this.dbConnectionService.testConnection(dto));
  }

  @Put()
  @ApiOperation({ summary: '접속 설정 저장 (접속 테스트 통과 시에만)' })
  async save(@Body() dto: DbConnectionInputDto) {
    return ResponseUtil.success(await this.dbConnectionService.save(dto));
  }

  @Post('restart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '백엔드 프로세스 재시작' })
  async restart() {
    return ResponseUtil.success(await this.dbConnectionService.restart());
  }
}
