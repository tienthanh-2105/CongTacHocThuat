import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly service: RegistrationService) {}

  @Get('my-registrations')
  @ApiOperation({ summary: 'Sinh viên xem danh sách các hoạt động/cuộc thi mình đã đăng ký' })
  @ApiResponse({ status: 200, description: 'Danh sách các lượt đăng ký của sinh viên hiện tại' })
  getMyRegistrations(@Req() request: AuthRequest) {
    return this.service.getMyRegistrations(request.auth!.userId);
  }
}
