import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../database.service';
import type { SessionContext } from '../../../business/auth/auth.types';

type AccountRow = { id: string; username: string; name: string; passwordHash: string; passwordVersion: number; active: boolean; role: string };
const accountSelect = `SELECT a.matk::text AS id, a.tendangnhap AS username,
 COALESCE(n.hoten,a.tendangnhap) AS name, a.matkhau AS "passwordHash",
 a.pbmatkhau AS "passwordVersion",
 (a.trangthai='Hoạt động' AND (n.mangdung IS NULL OR n.trangthai='Hoạt động')) AS active,
 r.tenvaitro AS role
 FROM public.taikhoan a JOIN public.vaitro r ON r.mavaitro=a.mavaitro
 LEFT JOIN public.nguoidung n ON n.mangdung=a.mangdung`;
function account(row: AccountRow) { return { ...row, roles: [{ role: { code: row.role } }] }; }

@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async findUserByUsername(username: string) {
    const result = await this.db.pool.query<AccountRow>(accountSelect+' WHERE a.tendangnhap=$1', [username]);
    return result.rows[0] ? account(result.rows[0]) : null;
  }
  async findUserById(id: string) {
    const result = await this.db.pool.query<AccountRow>(accountSelect+' WHERE a.matk=$1', [id]);
    return result.rows[0] ? account(result.rows[0]) : null;
  }
  async createSession(tokenHash: string, userId: string, passwordVersion: number, expiresAt: Date) {
    await this.db.pool.query('INSERT INTO public.phiendangnhap(maphien,mabamtoken,matk,pbmatkhau,hethanluc) VALUES($1,$2,$3,$4,$5)', [randomUUID(), tokenHash, userId, passwordVersion, expiresAt]);
  }
  async findSession(tokenHash: string) {
    const result = await this.db.pool.query<{ id: string; userId: string; passwordVersion: number; expiresAt: Date }>('SELECT maphien AS id,matk::text AS "userId",pbmatkhau AS "passwordVersion",hethanluc AS "expiresAt" FROM public.phiendangnhap WHERE mabamtoken=$1', [tokenHash]);
    const session=result.rows[0];
    if(!session) return null;
    const user=await this.findUserById(session.userId);
    return user ? { ...session, user } : null;
  }
  async deleteSession(tokenHash: string) { await this.db.pool.query('DELETE FROM public.phiendangnhap WHERE mabamtoken=$1', [tokenHash]); }
  async changePassword(context: SessionContext, user: { id: string }, passwordHash: string) {
    const client=await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the account first so simultaneous password changes cannot both succeed.
      const locked=await client.query(accountSelect+' WHERE a.matk=$1 FOR UPDATE OF a', [user.id]);
      const current=locked.rows[0] as AccountRow | undefined;
      if(!current?.active || current.passwordVersion!==context.passwordVersion) throw new UnauthorizedException('Tài khoản đã thay đổi, vui lòng đăng nhập lại');
      const session=await client.query('SELECT maphien FROM public.phiendangnhap WHERE maphien=$1 AND matk=$2 AND pbmatkhau=$3 AND hethanluc>now() FOR UPDATE', [context.sessionId,user.id,context.passwordVersion]);
      if(!session.rowCount) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
      await client.query('UPDATE public.taikhoan SET matkhau=$1,pbmatkhau=pbmatkhau+1 WHERE matk=$2', [passwordHash,user.id]);
      await client.query('DELETE FROM public.phiendangnhap WHERE matk=$1', [user.id]);
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}

