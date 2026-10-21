import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';
import { AssignSupportDto } from './registration.dto';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly service: RegistrationService) {}

  @Post('support-assignment')
  @HttpCode(201)
  @ApiOperation({ summary: 'Khoa / Ban tổ chức phân bổ chỉ tiêu sinh viên cổ vũ/hỗ trợ về các Lớp' })
  @ApiResponse({ status: 201, description: 'Phân bổ chỉ tiêu thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoạt động' })
  assignSupport(@Body() dto: AssignSupportDto) {
    return this.service.assignSupport(dto);
  }
}
