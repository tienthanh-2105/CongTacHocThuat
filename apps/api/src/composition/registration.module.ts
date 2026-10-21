import { Module } from '@nestjs/common';
import { RegistrationController } from '../presentation/registration/registration.controller';
import { RegistrationService } from '../business/registration/registration.service';
import { RegistrationRepository } from '../data/repositories/registration/registration.repository';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, RegistrationRepository],
  exports: [RegistrationService],
})
export class RegistrationModule {}
