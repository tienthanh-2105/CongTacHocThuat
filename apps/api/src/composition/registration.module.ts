import { Module } from '@nestjs/common';
import { DatabaseModule } from '../data/database.module';
import { AuthModule } from './auth.module';
import { RegistrationController } from '../presentation/registration/registration.controller';
import { RegistrationService } from '../business/registration/registration.service';
import { RegistrationRepository } from '../data/repositories/registration/registration.repository';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, RegistrationRepository],
  exports: [RegistrationService, RegistrationRepository],
})
export class RegistrationModule {}
