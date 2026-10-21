import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../data/database.service';
import type { AuthRequest } from './auth.http';

const REQUIRED_PERMISSION = 'academic.required-permission';

export const RequirePermission = (permission: string) => SetMetadata(REQUIRED_PERMISSION, permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const userId = request.auth?.userId;
    if (!userId) throw new ForbiddenException('Không xác định được tài khoản hiện tại');

    const rows = await this.database.query<{ allowed: number }>(
      `SELECT TOP (1) 1 AS allowed
       FROM TAIKHOAN a
       JOIN VAITRO_QUYEN rp ON rp.MaVT = a.MaVaiTro
       JOIN PHANQUYEN p ON p.MaQuyen = rp.MaQuyen
       WHERE a.MaTK = @p1 AND a.TrangThai = N'Hoạt động' AND p.TenQuyen = @p2`,
      [userId, permission],
    );
    if (!rows.length) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    return true;
  }
}
