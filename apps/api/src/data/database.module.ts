import { HealthRepository } from './health.repository';
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { AuthRepository } from './auth.repository';
@Module({ providers: [DatabaseService, AuthRepository, HealthRepository], exports: [DatabaseService, AuthRepository, HealthRepository] })
export class DatabaseModule {}

