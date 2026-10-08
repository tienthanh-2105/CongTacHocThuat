import { Module } from '@nestjs/common';
import { DatabaseModule } from '../data/database.module';
import { AuthController } from '../presentation/auth/auth.controller';
import { AuthService } from '../business/auth/auth.service';
import { AuthOriginGuard, LoginRateGuard, SessionGuard } from '../presentation/auth/auth.guards';
@Module({ imports: [DatabaseModule], controllers: [AuthController], providers: [AuthService, SessionGuard, AuthOriginGuard, LoginRateGuard], exports: [AuthService, SessionGuard] })
export class AuthModule {}
