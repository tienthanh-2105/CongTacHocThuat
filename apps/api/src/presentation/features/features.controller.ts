import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeaturesService } from '../../business/features/features.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { Req } from '@nestjs/common';
import { CreateExpenseDto, CreateSeminarDto } from './features.dto';

@ApiTags('mobile')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('mobile')
export class MobileController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Hồ sơ sinh viên, lớp, khoa và tổng điểm rèn luyện' })
  profile(@Req() request: AuthRequest) { return this.service.getProfile(request.auth!); }

  @Get('my-activities')
  @ApiOperation({ summary: 'Lịch sử hoạt động đã đăng ký của sinh viên hiện tại' })
  activities(@Req() request: AuthRequest) { return this.service.getMyActivities(request.auth!); }

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
  list() { return this.service.listSeminars(); }

  @Post()
  @ApiOperation({ summary: 'Tạo seminar và hoạt động học thuật liên kết (cán bộ khoa/giảng viên)' })
  create(@Req() request: AuthRequest, @Body() dto: CreateSeminarDto) {
    void request; void dto; throw new BadRequestException('Lập đề xuất Seminar trong Hoạt động học thuật, bản chi phí và kế hoạch tổ chức; chỉ công bố sau khi khoa và CTSV ký');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết seminar' })
  get(@Param('id', ParseIntPipe) id: number) { return this.service.getSeminar(id); }

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
}

@ApiTags('settlements')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(@Inject(FeaturesService) private readonly service: FeaturesService) {}

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

  @Get('activities/:activityId')
  @ApiOperation({ summary: 'Báo cáo hoạt động: đăng ký, điểm danh, chi phí và kết quả đã công bố' })
  getActivity(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) activityId: number) {
    return this.service.getActivityReport(request.auth!, activityId);
  }
}
