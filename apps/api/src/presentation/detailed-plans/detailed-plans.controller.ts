import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { DetailedPlansService } from '../../business/detailed-plans/detailed-plans.service';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { ReviewDetailedPlanDto, SaveDetailedPlanDto } from './detailed-plans.dto';

@ApiTags('detailed-plans') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('detailed-plans')
export class DetailedPlansController {
  constructor(@Inject(DetailedPlansService) private readonly service: DetailedPlansService) {}
  @Get() list(@Req() request: AuthRequest) { return this.service.list(request.auth!); }
  @Get(':activityId') get(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) id: number) { return this.service.get(request.auth!, id); }
  @Put(':activityId') save(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) id: number, @Body() dto: SaveDetailedPlanDto) { return this.service.save(request.auth!, id, dto); }
  @Post(':activityId/submit') submit(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) id: number) { return this.service.submit(request.auth!, id); }
  @Patch(':activityId/review') review(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) id: number, @Body() dto: ReviewDetailedPlanDto) { return this.service.review(request.auth!, id, dto); }
  @Post(':activityId/publish') publish(@Req() request: AuthRequest, @Param('activityId', ParseIntPipe) id: number) { return this.service.publish(request.auth!, id); }
}
