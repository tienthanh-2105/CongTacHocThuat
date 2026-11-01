import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { AuthRepository } from '../../data/auth.repository';
import type { ChangePasswordInput, LoginInput } from './auth.types';
import type { CurrentUser, SessionContext } from './auth.types';
import { tokenDigest } from './token';

const invalidCredentials = () => new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
// Valid bcrypt hash: wrong email still incurs the same password comparison cost.
const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxjYDT1HWb9LmLQfUvZOeWR2O5u';

function matchesLegacySha256(password: string, passwordHash: string): boolean {
  if (!/^[a-f\d]{64}$/i.test(passwordHash)) return false;
  const stored = Buffer.from(passwordHash, 'hex');
  const candidate = createHash('sha256').update(password, 'utf8').digest();
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

@Injectable()
export class AuthService {
  constructor(@Inject(AuthRepository) private readonly repository: AuthRepository, @Inject(ConfigService) private readonly config: ConfigService) {}
  get lifetimeSeconds(): number { return this.config.get<number>('SESSION_TTL_SECONDS') ?? 28800; }
  get secureCookie(): boolean { return this.config.get<string>('NODE_ENV') === 'production'; }

  async login(dto: LoginInput): Promise<{ token: string; user: CurrentUser; expiresAt: Date }> {
    let user = await this.repository.findUserByUsername(dto.username);
    const bcryptValid = await compare(dto.password, user?.passwordHash ?? dummyHash);
    if (!user || !user.active) throw invalidCredentials();
    if (!bcryptValid) {
      if (!matchesLegacySha256(dto.password, user.passwordHash)) throw invalidCredentials();
      const upgradedHash = await hash(dto.password, 12);
      const upgraded = await this.repository.upgradeLegacyPasswordHash(user.id, user.passwordHash, upgradedHash);
      if (upgraded) {
        user.passwordHash = upgradedHash;
      } else {
        // Another login or password change may have updated the row concurrently.
        const refreshed = await this.repository.findUserById(user.id);
        if (!refreshed?.active || !await compare(dto.password, refreshed.passwordHash)) throw invalidCredentials();
        user = refreshed;
      }
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.lifetimeSeconds * 1000);
    // The version is checked on every request, including sessions created concurrently with a password change.
    await this.repository.createSession(tokenDigest(token), user.id, user.passwordVersion, expiresAt);
    return { token, expiresAt, user: { id: user.id, username: user.username, name: user.name, roles: user.roles.map(link => link.role.code), department: user.department, position: user.position ?? undefined } };
  }

  async authenticate(token: string | undefined): Promise<SessionContext> {
    if (!token) throw new UnauthorizedException('Bạn cần đăng nhập');
    const session = await this.repository.findSession(tokenDigest(token));
    if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.active || session.passwordVersion !== session.user.passwordVersion) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    const user = session.user;
    return { sessionId: session.id, userId: user.id, passwordVersion: user.passwordVersion, user: { id: user.id, username: user.username, name: user.name, roles: user.roles.map(link => link.role.code), department: user.department, position: user.position ?? undefined } };
  }

  async logout(token: string | undefined) {
    if (token) await this.repository.deleteSession(tokenDigest(token));
  }

  async changePassword(context: SessionContext, dto: ChangePasswordInput) {
    const user = await this.repository.findUserById(context.userId);
    if (!user || !user.active || user.passwordVersion !== context.passwordVersion) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    if (!await compare(dto.currentPassword, user.passwordHash)) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    if (await compare(dto.newPassword, user.passwordHash)) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    const passwordHash = await hash(dto.newPassword, 12);
    await this.repository.changePassword(context, user, passwordHash);
  }
}
