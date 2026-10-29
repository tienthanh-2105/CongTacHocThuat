import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '../../business/registration/registration.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import {
  AssignSupportDto,
  JoinCompetitionTeamDto,
  RegisterIndividualDto,
  RegisterTeamDto,
  UpdateRegistrationStatusDto,
} from './registration.dto';

@ApiTags('registrations')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('registrations')
@UseGuards(SessionGuard)
export class RegistrationController {
  constructor(
    @Inject(RegistrationService)
    private readonly service: RegistrationService,
  ) {}

  @Post('individual')
  @HttpCode(201)
  @ApiOperation({ summary: 'Thí sinh/Sinh viên đăng ký tham gia hoạt động/cuộc thi theo cá nhân' })
  @ApiResponse({ status: 201, description: 'Đăng ký tham gia thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ, hoạt động hết hạn hoặc đã đủ số lượng' })
  @ApiResponse({ status: 409, description: 'Sinh viên đã đăng ký tham gia hoạt động này trước đó' })
  registerIndividual(
    @Req() request: AuthRequest,
    @Body() dto: RegisterIndividualDto,
  ) {
    return this.service.registerIndividual(request.auth!.userId, dto);
  }

  @Post('team')
  @HttpCode(201)
  @ApiOperation({ summary: 'Đăng ký tham gia cuộc thi theo đội thi (Trưởng đội + các thành viên)' })
  @ApiResponse({ status: 201, description: 'Đăng ký đội thi thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc trùng lặp trưởng đội' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc thi hoặc MSSV thành viên' })
  @ApiResponse({ status: 409, description: 'Tên đội đã tồn tại hoặc có thành viên đã thuộc đội khác' })
  registerTeam(
    @Req() request: AuthRequest,
    @Body() dto: RegisterTeamDto,
  ) {
    return this.service.registerTeam(request.auth!.userId, dto);
  }

  @Post('team/join')
  @HttpCode(201)
  @ApiOperation({ summary: 'Sinh viên tham gia đội thi hiện có bằng mã đội' })
  joinTeam(@Req() request: AuthRequest, @Body() dto: JoinCompetitionTeamDto) {
    return this.service.joinCompetitionTeam(request.auth!.userId, dto);
  }

  @Get('my-registrations')
  @ApiOperation({ summary: 'Sinh viên xem danh sách các hoạt động/cuộc thi mình đã đăng ký' })
  @ApiResponse({ status: 200, description: 'Danh sách các lượt đăng ký của sinh viên hiện tại' })
  getMyRegistrations(@Req() request: AuthRequest) {
    return this.service.getMyRegistrations(request.auth!.userId);
  }

  @Get('manage/:activityId')
  @ApiOperation({ summary: 'Ban tổ chức / Cán bộ xem toàn bộ danh sách đăng ký của một hoạt động' })
  @ApiResponse({ status: 200, description: 'Danh sách chi tiết thí sinh và đội thi đăng ký' })
  getRegistrationsByActivity(
    @Req() request: AuthRequest,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.service.getRegistrationsByActivity(request.auth!, activityId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ban tổ chức duyệt hoặc từ chối đơn đăng ký tham gia' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn đăng ký' })
  updateRegistrationStatus(
    @Req() request: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRegistrationStatusDto,
  ) {
    return this.service.updateRegistrationStatus(request.auth!, id, dto.trangThai);
  }

  @Post('support-assignment')
  @HttpCode(201)
  @ApiOperation({ summary: 'Khoa / Ban tổ chức phân bổ chỉ tiêu sinh viên cổ vũ/hỗ trợ về các Lớp' })
  @ApiResponse({ status: 201, description: 'Phân bổ chỉ tiêu thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoạt động' })
  assignSupport(@Req() request: AuthRequest, @Body() dto: AssignSupportDto) {
    return this.service.assignSupport(request.auth!, dto);
  }

  @Get('support-assignments/:activityId')
  @ApiOperation({ summary: 'Xem danh sách các lớp được phân bổ cổ vũ/hỗ trợ của hoạt động' })
  @ApiResponse({ status: 200, description: 'Danh sách các lớp phân công cổ vũ' })
  getSupportAssignments(
    @Req() request: AuthRequest,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.service.getSupportAssignments(request.auth!, activityId);
  }
}
