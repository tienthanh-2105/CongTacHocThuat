import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { WorkflowService } from '../../business/workflow/workflow.service';
import { ActivityChangeDto, AdjustTrainingPointDto, AwardTrainingPointDto, CheckInDto, CompetitionResultDto, CreateAttendanceCodeDto, CreatePlanActivityDto, CreatePlanDto, CreateRoundDto, ReviewPlanDto, ScoreWorkDto, SubmitWorkDto, SeminarMaterialDto, CreateAccountDto, CreateStudentAccountDto, CreateStudentProfileDto, CreateLinkedStudentProfileDto, ChangeAccountRoleDto, LinkAccountStudentProfileDto, ResetAccountPasswordDto, SetAccountStatusDto, ManualAttendanceDto } from './workflow.dto';

@ApiTags('admin-accounts') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(@Inject(WorkflowService) private readonly service: WorkflowService) {}
  @Get() list(@Req() r:AuthRequest){return this.service.listAccounts(r.auth!);}
  @Get('roles') roles(@Req() r:AuthRequest){return this.service.listAccountRoles(r.auth!);}
  @Get('student-profiles') studentProfiles(@Req() r:AuthRequest){return this.service.listUnlinkedStudentProfiles(r.auth!);}
  @Get('unlinked-student-accounts') unlinkedStudentAccounts(@Req() r:AuthRequest){return this.service.listUnlinkedStudentAccounts(r.auth!);}
  @Get('student-classes') studentClasses(@Req() r:AuthRequest){return this.service.listStudentClasses(r.auth!);}
  @Get('student-records') studentRecords(@Req() r:AuthRequest){return this.service.listStudentRecords(r.auth!);}
  @Post('student-profiles') createStudentProfile(@Req() r:AuthRequest,@Body() dto:CreateStudentProfileDto){return this.service.createStudentProfile(r.auth!,dto);}
  @Post('student') createStudentAccount(@Req() r:AuthRequest,@Body() dto:CreateStudentAccountDto){return this.service.createStudentAccount(r.auth!,dto);}
  @Post('student/with-account') createLinkedStudentProfile(@Req() r:AuthRequest,@Body() dto:CreateLinkedStudentProfileDto){return this.service.createLinkedStudentProfile(r.auth!,dto);}
  @Post() create(@Req() r:AuthRequest,@Body() dto:CreateAccountDto){return this.service.createAccount(r.auth!,dto.username,dto.password,dto.roleId,dto.maNgDung);}
  @Patch(':id/password') resetPassword(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:ResetAccountPasswordDto){return this.service.resetAccountPassword(r.auth!,id,dto.password);}
  @Patch(':id/role') changeRole(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:ChangeAccountRoleDto){return this.service.changeAccountRole(r.auth!,id,dto.roleId);}
  @Patch(':id/profile') linkStudentProfile(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:LinkAccountStudentProfileDto){return this.service.linkAccountStudentProfile(r.auth!,id,dto.maNgDung);}
  @Patch(':id/status') setStatus(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:SetAccountStatusDto){return this.service.setAccountStatus(r.auth!,id,dto.active);}
  @Delete(':id/permanent') deletePermanently(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.deleteAccountPermanently(r.auth!,id);}
  @Delete(':id') remove(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.deactivateAccount(r.auth!,id);}
}

@ApiTags('workflow') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('plans')
export class PlansController {
  constructor(@Inject(WorkflowService) private readonly service: WorkflowService) {}
  @Get() @ApiOperation({summary:'Danh sách kế hoạch năm học'}) list(@Req() r:AuthRequest){return this.service.listPlans(r.auth!);}
  @Get(':id') get(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.getPlan(r.auth!,id);}
  @Post() @ApiOperation({summary:'Tạo kế hoạch khoa/Bộ môn ở trạng thái dự thảo'}) create(@Req() r:AuthRequest,@Body() dto:CreatePlanDto){return this.service.createPlan(r.auth!,dto);}
  @Post(':id/activities') @ApiOperation({summary:'Thêm hoạt động và dự toán vào kế hoạch'}) activity(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:CreatePlanActivityDto){return this.service.addPlanActivity(r.auth!,id,dto);}
  @Post('details/:detailId/publish') @ApiOperation({summary:'Tạo hoạt động từ hạng mục kế hoạch đã duyệt'}) publish(@Req() r:AuthRequest,@Param('detailId',ParseIntPipe) id:number){return this.service.publishPlanActivity(r.auth!,id);}
  @Post(':id/submit') @ApiOperation({summary:'Trình kế hoạch để duyệt'}) submit(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.submitPlan(r.auth!,id);}
  @Patch(':id/review') @ApiOperation({summary:'Duyệt, yêu cầu bổ sung hoặc từ chối kế hoạch theo cấp'}) review(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:ReviewPlanDto){return this.service.reviewPlan(r.auth!,id,dto);}
}

@ApiTags('competition-rounds') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('competition-rounds')
export class CompetitionRoundsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Get(':competitionId') list(@Param('competitionId',ParseIntPipe) id:number){return this.service.listRounds(id);}
  @Post() create(@Req() r:AuthRequest,@Body() dto:CreateRoundDto){return this.service.createRound(r.auth!,dto);}
  @Get(':id/submissions') submissions(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.listSubmissions(r.auth!,id);}
  @Post(':id/submissions') submit(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:SubmitWorkDto){return this.service.submitWork(r.auth!,id,dto);}
}

@ApiTags('submissions') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Patch(':id/score') score(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:ScoreWorkDto){return this.service.scoreWork(r.auth!,id,dto);}
}

@ApiTags('competition-results') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('competitions')
export class CompetitionResultsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Get(':competitionId/results') results(@Param('competitionId',ParseIntPipe) id:number){return this.service.getCompetitionResults(id);}
  @Post(':competitionId/results') create(@Req() r:AuthRequest,@Param('competitionId',ParseIntPipe) id:number,@Body() dto:CompetitionResultDto){return this.service.createCompetitionResult(r.auth!,id,dto);}
  @Patch('results/:resultId/publish') publish(@Req() r:AuthRequest,@Param('resultId',ParseIntPipe) id:number){return this.service.publishCompetitionResult(r.auth!,id);}
}

@ApiTags('training-points') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('training-points')
export class TrainingPointsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Post() award(@Req() r:AuthRequest,@Body() dto:AwardTrainingPointDto){return this.service.awardPoint(r.auth!,dto);}
  @Post(':id/adjust') adjust(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:AdjustTrainingPointDto){return this.service.adjustPoint(r.auth!,id,dto);}
  @Patch(':id/approve') approve(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.reviewPoint(r.auth!,id,'approve');}
  @Patch(':id/reject') reject(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.reviewPoint(r.auth!,id,'reject');}
}

@ApiTags('attendance') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Post('activities/:activityId/qr') create(@Req() r:AuthRequest,@Param('activityId',ParseIntPipe) id:number,@Body() dto:CreateAttendanceCodeDto){return this.service.createAttendanceCode(r.auth!,id,dto.expiresAt);}
  @Post('check-in') checkIn(@Req() r:AuthRequest,@Body() dto:CheckInDto){return this.service.checkIn(r.auth!,dto.code);}
  @Post('manual') manual(@Req() r:AuthRequest,@Body() dto:ManualAttendanceDto){return this.service.manualAttendance(r.auth!,dto.maDK);}
}

@ApiTags('notifications') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('notifications')
export class UserNotificationsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Get('mine') mine(@Req() r:AuthRequest){return this.service.notifications(r.auth!);}
}

@ApiTags('reports') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('reports')
export class SummaryReportsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Get('summary') summary(@Req() r:AuthRequest,@Query('from') from?:string,@Query('to') to?:string){return this.service.reportSummary(r.auth!,from,to);}
  @Get('training-points') trainingPoints(@Req() r:AuthRequest,@Query('semester') semester?:string,@Query('academicYear') year?:string){return this.service.reportTrainingPoints(r.auth!,semester,year);}
}

@ApiTags('seminars') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('seminars')
export class SeminarMaterialsController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Post(':seminarId/materials') add(@Req() r:AuthRequest,@Param('seminarId',ParseIntPipe) id:number,@Body() dto:SeminarMaterialDto){return this.service.addSeminarMaterial(r.auth!,id,dto);}
}

@ApiTags('registrations') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('activities')
export class WaitlistController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Get(':activityId/waitlist') list(@Req() r:AuthRequest,@Param('activityId',ParseIntPipe) id:number){return this.service.listWaitlist(r.auth!,id);}
  @Post(':activityId/waitlist/promote-next') promote(@Req() r:AuthRequest,@Param('activityId',ParseIntPipe) id:number){return this.service.promoteWaitlist(r.auth!,id);}
}

@ApiTags('activities') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('activities')
export class ActivityChangesController {
  constructor(@Inject(WorkflowService) private readonly service:WorkflowService){}
  @Patch(':activityId/time-change') change(@Req() r:AuthRequest,@Param('activityId',ParseIntPipe) id:number,@Body() dto:ActivityChangeDto){return this.service.changeActivityAndNotify(r.auth!,id,dto);}
}
