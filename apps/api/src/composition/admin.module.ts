import { Module } from '@nestjs/common';
import { AdminService } from '../business/admin/admin.service';
import { AdminRepository } from '../data/repositories/admin/admin.repository';
import { AdminController } from '../presentation/admin/admin.controller';
import { PermissionGuard } from '../presentation/auth/permissions.guard';
import { AuthModule } from './auth.module';
import { DatabaseModule } from '../data/database.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, PermissionGuard],
})
export class AdminModule {}
