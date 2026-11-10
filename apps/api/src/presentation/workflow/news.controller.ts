import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { NewsService } from '../../business/workflow/news.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';

export class NewsDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) maHD?: number;
  @IsString() @IsNotEmpty() @MaxLength(250) tieuDe!: string;
  @IsString() @IsNotEmpty() noiDung!: string;
}
export class NewsStatusDto {
  @IsIn(['Đã công bố','Đã ẩn']) trangThai!: 'Đã công bố' | 'Đã ẩn';
}
@ApiTags('news') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('news')
export class NewsController {
  constructor(@Inject(NewsService) private readonly service: NewsService) {}
  @Get() list(@Req() request: AuthRequest) { return this.service.list(request.auth!); }
  @Get('activities') activities(@Req() request: AuthRequest) { return this.service.activities(request.auth!); }
  @Get('activities/:activityId/announcement')
  latestPublishedAnnouncement(@Param('activityId', ParseIntPipe) activityId: number) {
    return this.service.latestPublishedAnnouncement(activityId);
  }
  @Post() create(@Req() request: AuthRequest, @Body() dto: NewsDto) { return this.service.save(request.auth!, dto); }
  @Put(':id') update(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: NewsDto) { return this.service.save(request.auth!, dto, id); }
  @Patch(':id/status') status(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() dto: NewsStatusDto) { return this.service.status(request.auth!, id, dto.trangThai); }
}
