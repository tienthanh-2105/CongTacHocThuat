import { CompetitionWorkflowService } from '../business/workflow/competition-workflow.service';
import { CompetitionWorkflowController } from '../presentation/workflow/competition-workflow.controller';
import { DepartmentPlansService } from '../business/workflow/department-plans.service';
import { DepartmentPlansController } from '../presentation/workflow/department-plans.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { RegistrationModule } from './registration.module';
import { DatabaseModule } from '../data/database.module';
import { ActivitiesController, ExpensesController, MobileController, SeminarsController, SettlementsController, NotificationsController, ReportsController } from '../presentation/features/features.controller';
import { FeaturesRepository } from '../data/repositories/features/features.repository';
import { FeaturesService } from '../business/features/features.service';
import { WorkflowService } from '../business/workflow/workflow.service';
import { DetailedPlansService } from '../business/detailed-plans/detailed-plans.service';
import { DetailedPlansController } from '../presentation/detailed-plans/detailed-plans.controller';
import { AcademicActivitiesController, ActivityChangesController, AdminAccountsController, AttendanceController, CompetitionResultsController, CompetitionRoundsController, PlansController, SeminarMaterialsController, SubmissionsController, SummaryReportsController, TrainingPointsController, UserNotificationsController, WaitlistController } from '../presentation/workflow/workflow.controller';

@Module({
  imports: [DatabaseModule, AuthModule, RegistrationModule],
  controllers: [DepartmentPlansController, CompetitionWorkflowController, MobileController, NotificationsController, UserNotificationsController, ActivitiesController, WaitlistController, ActivityChangesController, SeminarsController, SeminarMaterialsController, ExpensesController, SettlementsController, ReportsController, PlansController, CompetitionRoundsController, SubmissionsController, CompetitionResultsController, TrainingPointsController, AttendanceController, SummaryReportsController, AdminAccountsController, AcademicActivitiesController, DetailedPlansController],
  providers: [DepartmentPlansService, CompetitionWorkflowService, FeaturesRepository, FeaturesService, WorkflowService, DetailedPlansService],
})
export class FeaturesModule {}
