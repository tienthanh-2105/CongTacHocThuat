import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { RegisterIndividualDto } from './registration.dto';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly service: RegistrationService) {}

  @Post('individual')
  @HttpCode(201)
  @ApiOperation({ summary: 'Thí sinh/Sinh viên đăng ký tham gia hoạt động/cuộc thi theo cá nhân' })
  @ApiResponse({ status: 201, description: 'Đăng ký tham gia thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ, hoạt động hết hạn hoặc đã đủ số lượng' })
  @ApiResponse({ status: 409, description: 'Sinh viên đã đăng ký tham gia hoạt động này trước đó' })
  registerIndividual(@Req() request: AuthRequest, @Body() dto: RegisterIndividualDto) {
    return this.service.registerIndividual(request.auth!.userId, dto);
  }
}
