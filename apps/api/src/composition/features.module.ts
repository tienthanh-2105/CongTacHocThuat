import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { RegistrationModule } from './registration.module';
import { DatabaseModule } from '../data/database.module';
import { ExpensesController, MobileController, SeminarsController, SettlementsController, NotificationsController, ReportsController } from '../presentation/features/features.controller';
import { FeaturesRepository } from '../data/repositories/features/features.repository';
import { FeaturesService } from '../business/features/features.service';

@Module({
  imports: [DatabaseModule, AuthModule, RegistrationModule],
  controllers: [MobileController, NotificationsController, SeminarsController, ExpensesController, SettlementsController, ReportsController],
  providers: [FeaturesRepository, FeaturesService],
})
export class FeaturesModule {}
