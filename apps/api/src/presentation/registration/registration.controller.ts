import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { RegisterTeamDto } from './registration.dto';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly service: RegistrationService) {}

  @Post('team')
  @HttpCode(201)
  @ApiOperation({ summary: 'Đăng ký tham gia cuộc thi theo đội thi (Trưởng đội + các thành viên)' })
  @ApiResponse({ status: 201, description: 'Đăng ký đội thi thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc trùng lặp trưởng đội' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc thi hoặc MSSV thành viên' })
  @ApiResponse({ status: 409, description: 'Tên đội đã tồn tại hoặc có thành viên đã thuộc đội khác' })
  registerTeam(@Req() request: AuthRequest, @Body() dto: RegisterTeamDto) {
    return this.service.registerTeam(request.auth!.userId, dto);
  }
}
