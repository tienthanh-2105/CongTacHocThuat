import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';
import type { SessionContext } from '../../../business/auth/auth.types';

type AccountRow = {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  passwordVersion: number;
  active: boolean;
  role: string;
  department: string | null;
};

const accountSelect = `SELECT 
  CAST(a.MaTK AS VARCHAR(50)) AS id, 
  a.TenDangNhap AS username,
  COALESCE(n.HoTen, a.TenDangNhap) AS name, 
  a.MatKhau AS passwordHash,
  a.PBMatKhau AS passwordVersion,
  CASE 
    WHEN a.TrangThai = N'Hoạt động' AND (n.MaNgDung IS NULL OR n.TrangThai = N'Hoạt động') 
    THEN CAST(1 AS BIT) 
    ELSE CAST(0 AS BIT) 
  END AS active,
  r.TenVaiTro AS role,
  COALESCE(
    (SELECT STRING_AGG(bm2.TenBM, N', ') WITHIN GROUP (ORDER BY bm2.MaBM) 
     FROM GIANGVIEN_BOMON gb2 JOIN BOMON bm2 ON bm2.MaBM = gb2.MaBM 
     WHERE gb2.MaGV = gv.MaGV),
    bm.TenBM,
    k.TenKhoa,
    N'Khoa CNTT'
  ) AS department
FROM TAIKHOAN a 
JOIN VAITRO r ON r.MaVaiTro = a.MaVaiTro
LEFT JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung
LEFT JOIN GIANGVIEN gv ON gv.MaNgDung = n.MaNgDung
LEFT JOIN BOMON bm ON bm.MaBM = gv.MaBM
LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = n.MaNgDung
LEFT JOIN KHOA k ON k.MaKhoa = cb.MaKhoa`;

function account(row: AccountRow) {
  const roleCodes: Record<string, string> = {
    'QUANTRIVIEN': 'ADMIN',
    'CANBOKHOA': 'CANBOKHOA',
    'GIANGVIEN': 'GIANGVIEN',
    'SINHVIEN': 'SINHVIEN',
    'PHONGKHCN': 'PHONGKHCN',
    'BANGIAMHIEU': 'HIEUTRUONG',
    'PHONGCTSV': 'PHONGCTSV',
  };
  const normalized = row.role.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return { ...row, department: row.department ?? undefined, roles: [{ role: { code: roleCodes[normalized] ?? normalized } }] };
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findUserByUsername(username: string) {
    const rows = await this.db.query<AccountRow>(`${accountSelect} WHERE a.TenDangNhap = @p1`, [username]);
    return rows[0] ? account(rows[0]) : null;
  }

  async upgradeLegacyPasswordHash(userId: string, legacyHash: string, passwordHash: string): Promise<boolean> {
    const rows = await this.db.query(
      'UPDATE TAIKHOAN SET MatKhau = @p3 WHERE MaTK = @p1 AND MatKhau = @p2',
      [userId, legacyHash, passwordHash],
    );
    return rows.length > 0;
  }

  async findUserById(id: string) {
    const rows = await this.db.query<AccountRow>(`${accountSelect} WHERE a.MaTK = @p1`, [id]);
    return rows[0] ? account(rows[0]) : null;
  }

  async createSession(tokenHash: string, userId: string, passwordVersion: number, expiresAt: Date) {
    await this.db.query(
      'INSERT INTO PHIENDANGNHAP(MaPhien, MaBamToken, MaTK, PBMatKhau, HetHanLuc) VALUES(@p1, @p2, @p3, @p4, @p5)',
      [randomUUID(), tokenHash, userId, passwordVersion, expiresAt],
    );
  }

  async findSession(tokenHash: string) {
    const rows = await this.db.query<{ id: string; userId: string; passwordVersion: number; expiresAt: Date }>(
      'SELECT CAST(MaPhien AS VARCHAR(50)) AS id, CAST(MaTK AS VARCHAR(50)) AS userId, PBMatKhau AS passwordVersion, HetHanLuc AS expiresAt FROM PHIENDANGNHAP WHERE MaBamToken = @p1',
      [tokenHash],
    );
    const session = rows[0];
    if (!session) return null;
    const user = await this.findUserById(session.userId);
    return user ? { ...session, user } : null;
  }

  async deleteSession(tokenHash: string) {
    await this.db.query('DELETE FROM PHIENDANGNHAP WHERE MaBamToken = @p1', [tokenHash]);
  }

  async changePassword(context: SessionContext, user: { id: string }, passwordHash: string) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const lockReq = new sql.Request(transaction);
      lockReq.input('userId', user.id);
      const lockedQuery = `${accountSelect.replace('FROM TAIKHOAN a', 'FROM TAIKHOAN a WITH (UPDLOCK, ROWLOCK)')} WHERE a.MaTK = @userId`;
      const locked = await lockReq.query<AccountRow>(lockedQuery);
      const current = locked.recordset[0];
      if (!current?.active || current.passwordVersion !== context.passwordVersion) {
        throw new UnauthorizedException('Tài khoản đã thay đổi, vui lòng đăng nhập lại');
      }

      const sessionReq = new sql.Request(transaction);
      sessionReq.input('sessionId', context.sessionId);
      sessionReq.input('userId', user.id);
      sessionReq.input('passwordVersion', context.passwordVersion);
      const session = await sessionReq.query(
        'SELECT MaPhien FROM PHIENDANGNHAP WITH (UPDLOCK, ROWLOCK) WHERE MaPhien = @sessionId AND MaTK = @userId AND PBMatKhau = @passwordVersion AND HetHanLuc > SYSDATETIMEOFFSET()',
      );
      if (!session.recordset.length) {
        throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
      }

      const updateReq = new sql.Request(transaction);
      updateReq.input('passwordHash', passwordHash);
      updateReq.input('userId', user.id);
      await updateReq.query('UPDATE TAIKHOAN SET MatKhau = @passwordHash, PBMatKhau = PBMatKhau + 1 WHERE MaTK = @userId');

      const delReq = new sql.Request(transaction);
      delReq.input('userId', user.id);
      await delReq.query('DELETE FROM PHIENDANGNHAP WHERE MaTK = @userId');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
