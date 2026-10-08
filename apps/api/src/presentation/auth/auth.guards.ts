import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../business/auth/auth.service';
import { AuthRequest, sessionToken } from './auth.http';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.auth = await this.auth.authenticate(sessionToken(request));
    return true;
  }
}

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '')) return true;
    const origin = request.headers.origin;
    const allowed = [this.config.get<string>('WEB_ORIGIN'), this.config.get<string>('API_ORIGIN')];
    if ((origin && !allowed.includes(origin)) || request.headers['sec-fetch-site'] === 'cross-site') throw new ForbiddenException('Nguồn gửi yêu cầu không được phép');
    return true;
  }
}

@Injectable()
export class LoginRateGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const now = Date.now();
    for (const [key, entry] of this.attempts) if (entry.expiresAt <= now) this.attempts.delete(key);
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const entry = this.attempts.get(key) ?? { count: 0, expiresAt: now + 15 * 60 * 1000 };
    if (entry.count >= 20 || (!this.attempts.has(key) && this.attempts.size >= 10000)) throw new HttpException('Quá nhiều lần thử đăng nhập, vui lòng thử lại sau', HttpStatus.TOO_MANY_REQUESTS);
    entry.count++;
    this.attempts.set(key, entry);
    return true;
  }
}
