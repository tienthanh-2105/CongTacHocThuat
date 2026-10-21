import { Controller, Get, Inject, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly service: RegistrationService) {}

  @Get('manage/:activityId')
  @ApiOperation({ summary: 'Ban tổ chức / Cán bộ xem toàn bộ danh sách đăng ký của một hoạt động' })
  @ApiResponse({ status: 200, description: 'Danh sách chi tiết thí sinh và đội thi đăng ký' })
  getRegistrationsByActivity(@Param('activityId', ParseIntPipe) activityId: number) {
    return this.service.getRegistrationsByActivity(activityId);
  }
}
