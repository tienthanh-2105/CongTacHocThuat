import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/auth.http';
import { CompetitionWorkflowService } from '../../business/workflow/competition-workflow.service';
import { CompetitionAwardDto, CompetitionRoundDto, GradedCompetitionResultDto, RoundAssignmentDto, RoundExamDto, RoundRegistrationDto, RoundScoreDto, RoundStatusDto, RoundSubmissionDto } from './competition-workflow.dto';

@ApiTags('competition-workflow') @ApiBearerAuth() @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('competition-workflow')
export class CompetitionWorkflowController {
  constructor(@Inject(CompetitionWorkflowService) private readonly service: CompetitionWorkflowService) {}
  @Get('competitions') competitions(@Req() r:AuthRequest){return this.service.competitions(r.auth!);}
  @Get('competitions/:id') competition(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.competition(r.auth!,id);}
  @Post('competitions/:id/rounds') createRound(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:CompetitionRoundDto){return this.service.createRound(r.auth!,id,dto);}
  @Post('competitions/:id/awards') award(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:CompetitionAwardDto){return this.service.createAward(r.auth!,id,dto);}
  @Post('competitions/:id/results') result(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:GradedCompetitionResultDto){return this.service.createResult(r.auth!,id,dto);}
  @Get('rounds/:id') round(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.round(r.auth!,id);}
  @Post('rounds/:id/assignments') assign(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:RoundAssignmentDto){return this.service.assignRound(r.auth!,id,dto);}
  @Patch('rounds/:id/status') status(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:RoundStatusDto){return this.service.setRoundStatus(r.auth!,id,dto);}
  @Post('rounds/:id/register') register(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:RoundRegistrationDto){return this.service.registerRound(r.auth!,id,dto);}
  @Put('rounds/:id/exam') exam(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:RoundExamDto){return this.service.saveExam(r.auth!,id,dto);}
  @Post('rounds/:id/exam/release') release(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.releaseExam(r.auth!,id);}
  @Post('rounds/:id/submissions') submit(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:RoundSubmissionDto){return this.service.submitWork(r.auth!,id,dto);}
  @Patch('submissions/:id/score') score(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() dto:RoundScoreDto){return this.service.scoreWork(r.auth!,id,dto);}
  @Post('results/:id/publish') publish(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.publishResult(r.auth!,id);}
}
