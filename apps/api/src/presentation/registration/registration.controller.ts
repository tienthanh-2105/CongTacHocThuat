import {
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';

@ApiTags('registrations')
@ApiCookieAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(
    @Inject(RegistrationService)
    private readonly service: RegistrationService,
  ) {}

  @Get('support-assignments/:activityId')
  @ApiOperation({ summary: 'Xem danh sách các lớp được phân bổ cổ vũ/hỗ trợ của hoạt động' })
  @ApiResponse({ status: 200, description: 'Danh sách các lớp phân công cổ vũ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoạt động' })
  getSupportAssignments(
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.service.getSupportAssignments(activityId);
  }
}
