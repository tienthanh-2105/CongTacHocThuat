import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/data/database.service';

test('Auth API with SQL Server', async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const db = app.get(DatabaseService);
  const username = `test.${randomUUID().slice(0, 8)}`;
  const originalPassword = randomUUID();
  const newPassword = randomUUID();
  let id: string | undefined;
  const base = `${await app.getUrl()}/api/v1/auth`;

  async function request(endpoint: string, body?: unknown, cookie?: string, origin?: string) {
    return fetch(`${base}/${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  async function login(password = originalPassword) {
    const response = await request('login', { username, password });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie')!.split(';')[0];
  }

  try {
    const roles = await db.query<{ MaVaiTro: number }>('SELECT TOP 1 MaVaiTro FROM VAITRO ORDER BY MaVaiTro');
    if (!roles.length) throw new Error('Create at least one role before testing');
    const result = await db.query<{ MaTK: number }>(
      'INSERT INTO TAIKHOAN(MaVaiTro, TenDangNhap, MatKhau) OUTPUT INSERTED.MaTK VALUES(@p1, @p2, @p3)',
      [roles[0].MaVaiTro, username, await hash(originalPassword, 12)],
    );
    id = String(result[0].MaTK);

    await t.test('validates input, forbids extra fields and passwords exceeding 72 UTF-8 bytes', async () => {
      assert.equal((await request('login', { username: '', password: originalPassword })).status, 400);
      assert.equal((await request('login', { username, password: originalPassword, role: 'ADMIN' })).status, 400);
      assert.equal((await request('login', { username, password: '😀'.repeat(20) })).status, 400);
    });

    await t.test('unknown, wrong-password and locked accounts return 401', async () => {
      assert.equal((await request('login', { username: 'missing.' + randomUUID().slice(0, 8), password: originalPassword })).status, 401);
      assert.equal((await request('login', { username, password: 'wrong' })).status, 401);
      await db.query("UPDATE TAIKHOAN SET TrangThai = N'Khóa' WHERE MaTK = @p1", [id]);
      assert.equal((await request('login', { username, password: originalPassword })).status, 401);
      await db.query("UPDATE TAIKHOAN SET TrangThai = N'Hoạt động' WHERE MaTK = @p1", [id]);
    });

    await t.test('login returns safe fields, cookie and only hashed token in database', async () => {
      const response = await request('login', { username: ' ' + username + ' ', password: originalPassword });
      assert.equal(response.status, 200);
      const body = (await response.json()) as any;
      assert.equal(body.user.username, username);
      assert.equal(body.user.passwordHash, undefined);
      assert.equal(body.token, undefined);
      const cookie = response.headers.get('set-cookie')!;
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      const token = cookie.split(';')[0].split('=')[1];
      const rows = await db.query<{ MaBamToken: string }>('SELECT MaBamToken FROM PHIENDANGNHAP WHERE MaTK = @p1', [id]);
      assert.ok(rows.every((r) => r.MaBamToken.trim() !== token));
      assert.equal((await request('me', undefined, cookie.split(';')[0])).status, 200);
      assert.equal((await request('me')).status, 401);
    });

    await t.test('logout revokes the session and can be repeated', async () => {
      const cookie = await login();
      assert.equal((await request('logout', {}, cookie)).status, 204);
      assert.equal((await request('me', undefined, cookie)).status, 401);
      assert.equal((await request('logout', {}, cookie)).status, 204);
    });

    await t.test('expired sessions and disabled accounts are rejected', async () => {
      const cookie = await login();
      await db.query('UPDATE PHIENDANGNHAP SET HetHanLuc = DATEADD(second, -1, SYSDATETIMEOFFSET()) WHERE MaTK = @p1', [id]);
      assert.equal((await request('me', undefined, cookie)).status, 401);
      const next = await login();
      await db.query("UPDATE TAIKHOAN SET TrangThai = N'Khóa' WHERE MaTK = @p1", [id]);
      assert.equal((await request('me', undefined, next)).status, 401);
      await db.query("UPDATE TAIKHOAN SET TrangThai = N'Hoạt động' WHERE MaTK = @p1", [id]);
    });

    await t.test('password change validates input and revokes all sessions', async () => {
      const first = await login();
      const second = await login();
      assert.equal((await request('change-password', { currentPassword: 'wrong', newPassword }, first)).status, 400);
      assert.equal((await request('change-password', { currentPassword: originalPassword, newPassword: originalPassword }, first)).status, 400);
      assert.equal((await request('change-password', { currentPassword: originalPassword, newPassword: 'short' }, first)).status, 400);
      assert.equal((await request('change-password', { currentPassword: originalPassword, newPassword }, first)).status, 200);
      assert.equal((await request('me', undefined, second)).status, 401);
      assert.equal((await request('login', { username, password: originalPassword })).status, 401);
      assert.equal((await request('me', undefined, await login(newPassword))).status, 200);
    });

    await t.test('cross-origin mutations and unauthenticated password changes are denied', async () => {
      assert.equal((await request('login', { username, password: newPassword }, undefined, 'https://untrusted.invalid')).status, 403);
      assert.equal((await request('logout', {}, undefined, 'https://untrusted.invalid')).status, 403);
      assert.equal((await request('change-password', { currentPassword: newPassword, newPassword: originalPassword })).status, 401);
    });

    await t.test('repeated login attempts are rate limited', async () => {
      let limited = false;
      for (let i = 0; i < 21; i++) {
        if ((await request('login', { username, password: 'wrong' })).status === 429) {
          limited = true;
          break;
        }
      }
      assert.ok(limited);
    });
  } finally {
    if (id) {
      await db.query('DELETE FROM PHIENDANGNHAP WHERE MaTK = @p1', [id]);
      await db.query('DELETE FROM TAIKHOAN WHERE MaTK = @p1', [id]);
    }
    await app.close();
  }
});
