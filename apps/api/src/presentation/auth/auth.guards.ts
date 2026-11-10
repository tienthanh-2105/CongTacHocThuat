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
    this.removeExpiredAttempts();
    const username = this.usernameKey(request);
    const ipEntry = this.attempts.get(this.ipKey(request));
    const accountEntry = username ? this.attempts.get(this.accountIpKey(request, username)) : undefined;
    if ((ipEntry && ipEntry.count >= 300) || (accountEntry && accountEntry.count >= 10)) {
      throw new HttpException('Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  recordFailure(request: AuthRequest, username: string) {
    this.removeExpiredAttempts();
    this.increment(this.ipKey(request));
    const normalizedUsername = username.trim().toLocaleLowerCase('vi');
    if (normalizedUsername) this.increment(this.accountIpKey(request, normalizedUsername));
  }

  clearAccountIpFailures(request: AuthRequest, username: string) {
    const normalizedUsername = username.trim().toLocaleLowerCase('vi');
    if (normalizedUsername) this.attempts.delete(this.accountIpKey(request, normalizedUsername));
  }

  private usernameKey(request: AuthRequest) {
    const body = (request as AuthRequest & { body?: { username?: unknown } }).body;
    return typeof body?.username === 'string' ? body.username.trim().toLocaleLowerCase('vi') : '';
  }

  private ipKey(request: AuthRequest) {
    return `ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
  }

  private accountIpKey(request: AuthRequest, username: string) {
    return `account-ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}:${username}`;
  }

  private increment(key: string) {
    const now = Date.now();
    const existing = this.attempts.get(key);
    if (existing && existing.expiresAt > now) {
      existing.count++;
      return;
    }
    this.attempts.set(key, { count: 1, expiresAt: now + 15 * 60 * 1000 });
    while (this.attempts.size > 20_000) {
      const oldest = this.attempts.keys().next().value;
      if (!oldest) break;
      this.attempts.delete(oldest);
    }
  }

  private removeExpiredAttempts() {
    const now = Date.now();
    for (const [key, entry] of this.attempts) if (entry.expiresAt <= now) this.attempts.delete(key);
  }
}
