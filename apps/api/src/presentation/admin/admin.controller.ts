import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from '../../business/admin/admin.service';
import type { AuthRequest } from '../auth/auth.http';
import { PermissionGuard, RequirePermission } from '../auth/permissions.guard';
import { SessionGuard } from '../auth/auth.guards';
import {
  CreateCompetitionCommitteeDto,
  CreateManagedUserDto,
  CreatePlanDto,
  ReviewPlanDto,
  UpdateManagedUserDto,
  UpdateRolePermissionsDto,
} from './admin.dto';

@ApiTags('member-1-management')
@ApiCookieAuth()
@Controller('management')
@UseGuards(SessionGuard, PermissionGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly service: AdminService) {}

  @Get('users')
  @RequirePermission('Quản Trị Hệ Thống')
  @ApiOperation({ summary: 'Tìm kiếm tài khoản và người dùng' })
  listUsers(@Query('q') search?: string) {
    return this.service.listUsers(search);
  }

  @Post('users')
  @RequirePermission('Quản Trị Hệ Thống')
  @ApiOperation({ summary: 'Tạo hồ sơ người dùng và tài khoản đăng nhập' })
  createUser(@Body() dto: CreateManagedUserDto) {
    return this.service.createUser(dto);
  }

  @Patch('users/:id')
  @RequirePermission('Quản Trị Hệ Thống')
  @ApiOperation({ summary: 'Sửa thông tin, vai trò, trạng thái hoặc đặt lại mật khẩu' })
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateManagedUserDto) {
    return this.service.updateUser(id, dto);
  }

  @Get('roles')
  @RequirePermission('Quản Trị Hệ Thống')
  @ApiOperation({ summary: 'Danh sách vai trò cùng các quyền được gán' })
  listRoles() {
    return this.service.listRoles();
  }

  @Get('permissions')
  @RequirePermission('Quản Trị Hệ Thống')
  @ApiOperation({ summary: 'Danh mục quyền' })
  listPermissions() {
    return this.service.listPermissions();
  }

  @Put('roles/:id/permissions')
  @RequirePermission('Quản Trị Hệ Thống')
  @ApiOperation({ summary: 'Thay ma trận quyền của một vai trò' })
  updateRolePermissions(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRolePermissionsDto) {
    return this.service.updateRolePermissions(id, dto.quyenIds);
  }

  @Get('plans')
  @RequirePermission('Quản Lý Kế Hoạch')
  @ApiOperation({ summary: 'Danh sách kế hoạch học thuật' })
  listPlans() {
    return this.service.listPlans();
  }

  @Get('plans/:id')
  @RequirePermission('Quản Lý Kế Hoạch')
  @ApiOperation({ summary: 'Chi tiết kế hoạch và lịch sử duyệt' })
  getPlan(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPlan(id);
  }

  @Post('plans')
  @RequirePermission('Quản Lý Kế Hoạch')
  @ApiOperation({ summary: 'Lập kế hoạch học thuật ở trạng thái Dự thảo' })
  createPlan(@Req() request: AuthRequest, @Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto, request.auth!.userId);
  }

  @Patch('plans/:id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('Quản Lý Kế Hoạch')
  @ApiOperation({ summary: 'Gửi kế hoạch Dự thảo hoặc Cần bổ sung để xét duyệt' })
  submitPlan(@Param('id', ParseIntPipe) id: number, @Req() request: AuthRequest) {
    return this.service.submitPlan(id, request.auth!.userId);
  }

  @Patch('plans/:id/review')
  @RequirePermission('Phê Duyệt Kế Hoạch')
  @ApiOperation({ summary: 'Duyệt, từ chối hoặc yêu cầu bổ sung kế hoạch' })
  reviewPlan(@Param('id', ParseIntPipe) id: number, @Req() request: AuthRequest, @Body() dto: ReviewPlanDto) {
    return this.service.reviewPlan(id, request.auth!.userId, dto);
  }

  @Get('competitions')
  @RequirePermission('Quản Lý Hoạt Động')
  @ApiOperation({ summary: 'Cuộc thi và trạng thái kế hoạch liên quan' })
  listCompetitions() {
    return this.service.listCompetitions();
  }

  @Get('competitions/:id/committees')
  @RequirePermission('Quản Lý Hoạt Động')
  @ApiOperation({ summary: 'Danh sách ban và thành viên của cuộc thi' })
  listCompetitionBoards(@Param('id', ParseIntPipe) id: number) {
    return this.service.listCompetitionBoards(id);
  }

  @Post('competitions/:id/committees')
  @RequirePermission('Quản Lý Hoạt Động')
  @ApiOperation({ summary: 'Thành lập ban cuộc thi thuộc kế hoạch đã được duyệt' })
  createCompetitionBoard(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCompetitionCommitteeDto) {
    return this.service.createCompetitionBoard(id, dto);
  }
}
