import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DepartmentPlansService } from '../../business/workflow/department-plans.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';

class ProposalDto {
  @Type(() => Number) @IsInt() @Min(1) maBM!: number;
  @IsString() @IsNotEmpty() @MaxLength(20) namHoc!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) tenCuocThi!: string;
  @IsString() @IsNotEmpty() noiDung!: string;
  @Type(() => Number) @IsNumber() @Min(0) duTruKinhPhi!: number;
}
class ReviewDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) ghiChu?: string;
}
class AttachDto { @Type(() => Number) @IsInt() @Min(1) maKeHoach!: number; }

@ApiTags('department-competition-plans') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('department-plans')
export class DepartmentPlansController {
  constructor(@Inject(DepartmentPlansService) private readonly service: DepartmentPlansService) {}
  @Get('my-departments') departments(@Req() r: AuthRequest) { return this.service.departments(r.auth!); }
  @Get('board-members') members(@Req() r: AuthRequest) { return this.service.boardMembers(r.auth!); }
  @Get() list(@Req() r: AuthRequest) { return this.service.list(r.auth!); }
  @Post() create(@Req() r: AuthRequest, @Body() dto: ProposalDto) { return this.service.create(r.auth!,dto); }
  @Patch(':id') update(@Req() r: AuthRequest, @Param('id',ParseIntPipe) id: number, @Body() dto: ProposalDto) { return this.service.update(r.auth!,id,dto); }
  @Post(':id/submit') submit(@Req() r: AuthRequest, @Param('id',ParseIntPipe) id: number) { return this.service.submit(r.auth!,id); }
  @Patch(':id/head-review') headReview(@Req() r: AuthRequest, @Param('id',ParseIntPipe) id: number, @Body() dto: ReviewDto) { return this.service.reviewByHead(r.auth!,id,dto.approve,dto.ghiChu); }
  @Get('faculty/queue') facultyQueue(@Req() r: AuthRequest) { return this.service.facultyQueue(r.auth!); }
  @Patch(':id/faculty-review') facultyReview(@Req() r: AuthRequest, @Param('id',ParseIntPipe) id: number, @Body() dto: ReviewDto) { return this.service.reviewByFaculty(r.auth!,id,dto.approve,dto.ghiChu); }
  @Patch(':id/attach') attach(@Req() r: AuthRequest, @Param('id',ParseIntPipe) id: number, @Body() dto: AttachDto) { return this.service.attachToFacultyPlan(r.auth!,id,dto.maKeHoach); }
}
