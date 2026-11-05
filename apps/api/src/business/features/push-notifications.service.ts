import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { DatabaseService } from '../../data/database.service';

type PendingPush = {
  MaThongBao: number;
  MaTK: number;
  TieuDe: string | null;
  NoiDung: string | null;
};

@Injectable()
export class PushNotificationsService implements OnModuleInit, OnModuleDestroy {
  private messaging?: Messaging;
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const credentialsPath = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    if (!credentialsPath) {
      console.info('FCM chưa bật: cấu hình GOOGLE_APPLICATION_CREDENTIALS để gửi push.');
      return;
    }
    try {
      const app = getApps()[0] ?? initializeApp({
        credential: applicationDefault(),
        projectId: this.config.get<string>('FIREBASE_PROJECT_ID'),
      });
      this.messaging = getMessaging(app);
      this.timer = setInterval(() => void this.deliverPending(), 5000);
      this.timer.unref();
      void this.deliverPending();
      console.info('Firebase Cloud Messaging đã sẵn sàng.');
    } catch (error) {
      console.error('Không khởi tạo được Firebase Admin SDK:', error);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async registerDevice(accountId: string, token: string, platform: string) {
    await this.db.query(`
      MERGE dbo.FCM_DEVICE WITH (HOLDLOCK) AS target
      USING (SELECT @p1 AS Token) AS source ON target.Token = source.Token
      WHEN MATCHED THEN UPDATE SET MaTK=@p2, NenTang=@p3, CapNhatLuc=SYSDATETIMEOFFSET()
      WHEN NOT MATCHED THEN INSERT(Token,MaTK,NenTang) VALUES(@p1,@p2,@p3);
    `, [token, accountId, platform]);
    return { success: true };
  }

  async unregisterDevice(accountId: string, token: string) {
    await this.db.query('DELETE FROM dbo.FCM_DEVICE WHERE Token=@p1 AND MaTK=@p2', [token, accountId]);
    return { success: true };
  }

  private async deliverPending() {
    if (!this.messaging || this.processing) return;
    this.processing = true;
    try {
      const rows = await this.db.query<PendingPush>(`
        SELECT TOP (50) q.MaThongBao,q.MaTK,t.TieuDe,t.NoiDung
        FROM dbo.FCM_NOTIFICATION_QUEUE q
        JOIN dbo.THONGBAO t ON t.MaThongBao=q.MaThongBao
        WHERE q.TrangThai=N'Cho gui' AND q.TaoLuc >= DATEADD(day,-3,SYSDATETIMEOFFSET())
        ORDER BY q.TaoLuc,q.MaThongBao
      `);
      for (const row of rows) await this.deliverOne(row);
      await this.db.query(`
        UPDATE dbo.FCM_NOTIFICATION_QUEUE SET TrangThai=N'Het han'
        WHERE TrangThai=N'Cho gui' AND TaoLuc < DATEADD(day,-3,SYSDATETIMEOFFSET())
      `);
    } catch (error) {
      console.error('Không xử lý được hàng đợi FCM:', error);
    } finally {
      this.processing = false;
    }
  }

  private async deliverOne(row: PendingPush) {
    if (!this.messaging) return;
    const devices = await this.db.query<{ Token: string }>(
      'SELECT Token FROM dbo.FCM_DEVICE WHERE MaTK=@p1', [row.MaTK],
    );
    if (!devices.length) return;
    const result = await this.messaging.sendEachForMulticast({
      tokens: devices.map((device) => device.Token),
      notification: {
        title: row.TieuDe || 'Thông báo học thuật',
        body: row.NoiDung || 'Bạn có thông báo mới.',
      },
      data: { notificationId: String(row.MaThongBao) },
      android: { priority: 'high', notification: { channelId: 'academic_inbox' } },
    });
    const invalidTokens = result.responses.flatMap((response, index) => {
      const code = response.error?.code;
      return !response.success && (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') ? [devices[index].Token] : [];
    });
    if (invalidTokens.length) {
      for (const token of invalidTokens) await this.db.query('DELETE FROM dbo.FCM_DEVICE WHERE Token=@p1', [token]);
    }
    if (result.successCount > 0) {
      await this.db.query(`UPDATE dbo.FCM_NOTIFICATION_QUEUE
        SET TrangThai=N'Da gui',GuiLuc=SYSDATETIMEOFFSET(),Loi=NULL WHERE MaThongBao=@p1`, [row.MaThongBao]);
      return;
    }
    const error = result.responses.find((response) => response.error)?.error;
    await this.db.query(`UPDATE dbo.FCM_NOTIFICATION_QUEUE
      SET SoLanThu=SoLanThu+1,
          TrangThai=CASE WHEN SoLanThu >= 4 THEN N'Loi' ELSE N'Cho gui' END,
          Loi=@p2
      WHERE MaThongBao=@p1`, [row.MaThongBao, error?.message?.slice(0, 1000) ?? 'FCM delivery failed']);
  }
}
