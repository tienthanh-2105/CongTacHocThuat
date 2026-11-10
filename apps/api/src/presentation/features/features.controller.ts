import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeaturesService } from '../../business/features/features.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { Req } from '@nestjs/common';
import { CreateExpenseDto, CreateSeminarDto, CreateSettlementReportDto, RegisterPushDeviceDto, UnregisterPushDeviceDto, UpdateExpenseDto, UpdateSeminarDetailsDto } from './features.dto';
import { PushNotificationsService } from '../../business/features/push-notifications.service';

@ApiTags('mobile')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('mobile')
export class MobileController {
  constructor(
    @Inject(FeaturesService) private readonly service: FeaturesService,
    @Inject(PushNotificationsService) private readonly push: PushNotificationsService,
  ) {}

  @Post('devices')
  @ApiOperation({ summary: 'Đăng ký token thiết bị để nhận thông báo đẩy FCM' })
  registerPushDevice(@Req() request: AuthRequest, @Body() dto: RegisterPushDeviceDto) {
    return this.push.registerDevice(request.auth!.userId, dto.token, dto.platform || 'android');
  }

  @Post('devices/unregister')
  @ApiOperation({ summary: 'Hủy đăng ký thiết bị nhận thông báo đẩy FCM' })
  unregisterPushDevice(@Req() request: AuthRequest, @Body() dto: UnregisterPushDeviceDto) {
    return this.push.unregisterDevice(request.auth!.userId, dto.token);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Hồ sơ sinh viên, lớp, khoa và tổng điểm rèn luyện' })
  profile(@Req() request: AuthRequest) { return this.service.getProfile(request.auth!); }

  @Get('activities')
  @ApiOperation({ summary: 'Hoạt động đã công bố; CoTheDangKy cho biết hoạt động đã đủ điều kiện đăng ký mobile' })
  activities(@Req() request: AuthRequest) { return this.service.getMobileActivities(request.auth!); }

  @Get('topics')
  @ApiOperation({ summary: 'Danh sách đề tài thuộc các cuộc thi đã công bố dành cho sinh viên mobile' })
  topics(@Req() request: AuthRequest) { return this.service.getMobileTopics(request.auth!); }

  @Get('notifications')
  @ApiOperation({ summary: 'Tin tức và thông báo dành cho sinh viên trên mobile' })
  notifications(@Req() request: AuthRequest) { return this.service.getMobileNotifications(request.auth!); }

  @Get('my-activities')
  @ApiOperation({ summary: 'Lịch sử hoạt động đã đăng ký của sinh viên hiện tại' })
  myActivities(@Req() request: AuthRequest) { return this.service.getMyActivities(request.auth!); }

  @Get('my-training-points')
  @ApiOperation({ summary: 'Tổng điểm và chi tiết điểm rèn luyện hiện có' })
  trainingPoints(@Req() request: AuthRequest) { return this.service.getMyTrainingPoints(request.auth!); }
}

@ApiTags('notifications')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Get('my-reminders')
  @ApiOperation({ summary: 'Hoạt động đã đăng ký sắp diễn ra trong 7 ngày tới' })
  reminders(@Req() request: AuthRequest) { return this.service.getReminders(request.auth!); }
}

@ApiTags('activities')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách cuộc thi, seminar và hoạt động sắp diễn ra' })
  list() { return this.service.listActivities(); }
}

@ApiTags('seminars')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('seminars')
export class SeminarsController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách seminar và thông tin hoạt động' })
  list(@Req() request: AuthRequest, @Query('source') source?: string) {
    return this.service.listSeminars(request.auth!, source === 'management');
  }

  @Post()
  @ApiOperation({ summary: 'Tạo bản nháp seminar và hoạt động học thuật liên kết' })
  create(@Req() request: AuthRequest, @Body() dto: CreateSeminarDto) {
    return this.service.createSeminar(request.auth!, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết seminar' })
  get(@Param('id', ParseIntPipe) id: number) { return this.service.getSeminar(id); }
  @Patch(':id')
  update(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeminarDetailsDto) {
    return this.service.updateSeminar(request.auth!, id, dto);
  }

  @Post(':id/register')
  @ApiOperation({ summary: 'Sinh viên đăng ký tham gia seminar' })
  register(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.registerSeminar(request.auth!, id);
  }
}

@ApiTags('expenses')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi nhận khoản chi và tạo/cập nhật hồ sơ quyết toán nháp' })
  create(@Req() request: AuthRequest, @Body() dto: CreateExpenseDto) {
    return this.service.createExpense(request.auth!, dto);
  }

  @Patch(':id')
  update(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.service.updateExpense(request.auth!, id, dto);
  }
}

@ApiTags('settlements')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Get('activities')
  @ApiOperation({ summary: 'Danh sách hoạt động người dùng được phép quyết toán' })
  listActivities(@Req() request: AuthRequest) {
    return this.service.listSettlementActivities(request.auth!);
  }

  @Get(':activityId')
  @ApiOperation({ summary: 'Hồ sơ quyết toán và danh sách chi phí thực tế của hoạt động' })
  get(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) activityId: number) {
    return this.service.getSettlement(request.auth!, activityId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Khoa duyệt hồ sơ quyết toán' })
  approve(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.approveSettlement(request.auth!, id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Người lập gửi hồ sơ quyết toán nháp để khoa duyệt' })
  submit(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.submitSettlement(request.auth!, id);
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('reports')
export class ReportsController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Get('settlements')
  @ApiOperation({ summary: 'Danh sách báo cáo quyết toán đã lập' })
  listSettlementReports(@Req() request: AuthRequest) {
    return this.service.listSettlementReports(request.auth!);
  }

  @Get('settlements/activities')
  @ApiOperation({ summary: 'Danh sách hoạt động được phép lập báo cáo quyết toán' })
  listSettlementReportActivities(@Req() request: AuthRequest) {
    return this.service.listSettlementReportActivities(request.auth!);
  }

  @Post('settlements')
  @ApiOperation({ summary: 'Lập báo cáo quyết toán cho hoạt động' })
  createSettlementReport(@Req() request: AuthRequest, @Body() dto: CreateSettlementReportDto) {
    return this.service.createSettlementReport(request.auth!, dto);
  }

  @Get('activities/:activityId')
  @ApiOperation({ summary: 'Báo cáo hoạt động: đăng ký, điểm danh, chi phí và kết quả đã công bố' })
  getActivity(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) activityId: number) {
    return this.service.getActivityReport(request.auth!, activityId);
  }
}
