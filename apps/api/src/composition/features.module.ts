import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { RegistrationModule } from './registration.module';
import { DatabaseModule } from '../data/database.module';
import { ActivitiesController, ExpensesController, MobileController, SeminarsController, SettlementsController, NotificationsController, ReportsController } from '../presentation/features/features.controller';
import { FeaturesRepository } from '../data/repositories/features/features.repository';
import { FeaturesService } from '../business/features/features.service';
import { WorkflowService } from '../business/workflow/workflow.service';
import { ActivityChangesController, AdminAccountsController, AttendanceController, CompetitionResultsController, CompetitionRoundsController, PlansController, SeminarMaterialsController, SubmissionsController, SummaryReportsController, TrainingPointsController, UserNotificationsController, WaitlistController } from '../presentation/workflow/workflow.controller';

@Module({
  imports: [DatabaseModule, AuthModule, RegistrationModule],
  controllers: [MobileController, NotificationsController, UserNotificationsController, ActivitiesController, WaitlistController, ActivityChangesController, SeminarsController, SeminarMaterialsController, ExpensesController, SettlementsController, ReportsController, PlansController, CompetitionRoundsController, SubmissionsController, CompetitionResultsController, TrainingPointsController, AttendanceController, SummaryReportsController, AdminAccountsController],
  providers: [FeaturesRepository, FeaturesService, WorkflowService],
})
export class FeaturesModule {}
