import { Body, Controller, Inject, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';
import { UpdateRegistrationStatusDto } from './registration.dto';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly service: RegistrationService) {}

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ban tổ chức duyệt hoặc từ chối đơn đăng ký tham gia' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn đăng ký' })
  updateRegistrationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRegistrationStatusDto,
  ) {
    return this.service.updateRegistrationStatus(id, dto.trangThai);
  }
}
