import { Inject, Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';

export interface StudentInfo {
  MaSV: number;
  MSSV: string;
  MaLop: number;
  HoTen: string;
  TenLop: string;
}

export interface ActivityInfo {
  MaHD: number;
  TenHoatDong: string;
  TgBatDau: Date;
  TgKetThuc: Date;
  HanDangKy: Date | null;
  DiaDiem: string | null;
  SLToiDa: number | null;
  TrangThai: string;
}

export interface CompetitionInfo {
  MaCThi: number;
  MaHD: number;
  TenCuocThi: string;
  HinhThucThi: string | null;
  TheLe: string;
  TenHoatDong: string;
  HanDangKy: Date | null;
  TrangThai: string;
}

export interface RegistrationRecord {
  MaDK: number;
  MaHD: number;
  TenHoatDong: string;
  DiaDiem: string | null;
  TgBatDau: Date;
  TgKetThuc: Date;
  NgayDK: Date;
  HinhThuc: string;
  TrangThai: string;
  TenDoi: string | null;
  VaiTroDoi: string | null;
}

export interface ActivityRegistrationDetail {
  MaDK: number;
  MaHD: number;
  MaSV: number;
  MSSV: string;
  HoTen: string;
  Email: string | null;
  SDT: string | null;
  TenLop: string;
  NgayDK: Date;
  HinhThuc: string;
  NguonDK: string;
  TrangThai: string;
  TenDoi: string | null;
  VaiTroDoi: string | null;
}

export interface SupportAssignmentRecord {
  MaCoVu: number;
  MaHD: number;
  MaLop: number;
  TenLop: string;
  SoLuong: number;
  LoaiPhanCong: string;
  NhiemVu: string | null;
  NgayPhCong: Date | null;
  TrangThai: string | null;
}

@Injectable()
export class RegistrationRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findStudentByUserId(userId: string | number): Promise<StudentInfo | null> {
    const rows = await this.db.query<StudentInfo>(
      `SELECT s.MaSV, s.MSSV, s.MaLop, n.HoTen, l.TenLop
       FROM TAIKHOAN a
       JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung
       JOIN SINHVIEN s ON s.MaNgDung = n.MaNgDung
       JOIN LOP l ON l.MaLop = s.MaLop
       WHERE a.MaTK = @p1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findStudentByMssv(mssv: string): Promise<StudentInfo | null> {
    const rows = await this.db.query<StudentInfo>(
      `SELECT s.MaSV, s.MSSV, s.MaLop, n.HoTen, l.TenLop
       FROM SINHVIEN s
       JOIN NGUOIDUNG n ON n.MaNgDung = s.MaNgDung
       JOIN LOP l ON l.MaLop = s.MaLop
       WHERE s.MSSV = @p1`,
      [mssv],
    );
    return rows[0] ?? null;
  }

  async findActivityById(maHD: number): Promise<ActivityInfo | null> {
    const rows = await this.db.query<ActivityInfo>(
      `SELECT MaHD, TenHoatDong, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai
       FROM HOATDONGHOCTHUAT
       WHERE MaHD = @p1`,
      [maHD],
    );
    return rows[0] ?? null;
  }

  async findCompetitionById(maCThi: number): Promise<CompetitionInfo | null> {
    const rows = await this.db.query<CompetitionInfo>(
      `SELECT c.MaCThi, c.MaHD, c.TenCuocThi, c.HinhThucThi, c.TheLe, h.TenHoatDong, h.TgDuKien AS HanDangKy, h.TrangThai
       FROM CUOCTHI c
       JOIN HOATDONGHOCTHUAT h ON h.MaHD = c.MaHD
       WHERE c.MaCThi = @p1`,
      [maCThi],
    );
    return rows[0] ?? null;
  }

  async findRegistration(maHD: number, maSV: number) {
    const rows = await this.db.query(
      `SELECT MaDK, MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai
       FROM DKTHAMGIA
       WHERE MaHD = @p1 AND MaSV = @p2`,
      [maHD, maSV],
    );
    return rows[0] ?? null;
  }

  async countRegistrations(maHD: number): Promise<number> {
    const rows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM DKTHAMGIA
       WHERE MaHD = @p1 AND TrangThai NOT IN (N'Từ chối', N'Đã hủy')`,
      [maHD],
    );
    return rows[0]?.total ?? 0;
  }

  async addToWaitlist(maHD: number, maSV: number): Promise<{ MaCho: number; ViTri: number }> {
    const rows = await this.db.query<{ MaCho: number; ViTri: number }>(
      `DECLARE @id BIGINT;
       IF EXISTS (SELECT 1 FROM HANGDOICHODANGKY WITH (UPDLOCK,HOLDLOCK) WHERE MaHD=@p1 AND MaSV=@p2 AND TrangThai IN (N'Đã hủy'))
         UPDATE HANGDOICHODANGKY SET TrangThai=N'Đang chờ',DangKyLuc=SYSDATETIMEOFFSET() WHERE MaHD=@p1 AND MaSV=@p2;
       ELSE IF NOT EXISTS (SELECT 1 FROM HANGDOICHODANGKY WITH (UPDLOCK,HOLDLOCK) WHERE MaHD=@p1 AND MaSV=@p2)
         INSERT INTO HANGDOICHODANGKY(MaHD,MaSV) VALUES(@p1,@p2);
       SELECT TOP(1) @id=MaCho FROM HANGDOICHODANGKY WHERE MaHD=@p1 AND MaSV=@p2 AND TrangThai IN(N'Đang chờ',N'Đã mời');
       SELECT @id AS MaCho, (SELECT COUNT(*) FROM HANGDOICHODANGKY WHERE MaHD=@p1 AND TrangThai=N'Đang chờ' AND MaCho<=@id) AS ViTri;`,
      [maHD, maSV],
    );
    return rows[0];
  }

  async createIndividualRegistration(
    maHD: number,
    maSV: number,
    hinhThuc: string,
    nguonDK = "Sinh viên",
    trangThai = "Đã đăng ký",
  ): Promise<{ MaDK: number; NgayDK: Date }> {
    const rows = await this.db.query<{ MaDK: number; NgayDK: Date }>(
      `INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
       OUTPUT INSERTED.MaDK, INSERTED.NgayDK
       VALUES(@p1, @p2, SYSDATETIME(), @p3, @p4, @p5)`,
      [maHD, maSV, hinhThuc, nguonDK, trangThai],
    );
    return rows[0];
  }

  async createRegistrationNotification(maDK:number) {
    await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
      SELECT tk.MaTK,dk.MaHD,N'Đăng ký thành công',N'Đăng ký hoạt động thành công',CONCAT(N'Bạn đã đăng ký: ',h.TenHoatDong)
      FROM DKTHAMGIA dk JOIN HOATDONGHOCTHUAT h ON h.MaHD=dk.MaHD JOIN SINHVIEN sv ON sv.MaSV=dk.MaSV JOIN TAIKHOAN tk ON tk.MaNgDung=sv.MaNgDung
      WHERE dk.MaDK=@p1`,[maDK]);
  }

  async registerIndividualWithinCapacity(maHD:number,maSV:number,hinhThuc:string):Promise<{waitlisted:true;MaCho:number;ViTri:number}|{waitlisted:false;MaDK:number;NgayDK:Date}|null> {
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const activity=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).query<{SLToiDa:number|null}>(`SELECT SLSVDuKien AS SLToiDa FROM HOATDONGHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@hd`)).recordset[0];
      if(!activity){await tx.rollback();return null;}
      const count=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).query<{total:number}>(`SELECT COUNT(*) total FROM DKTHAMGIA WHERE MaHD=@hd AND TrangThai NOT IN(N'Đã hủy',N'Từ chối')`)).recordset[0].total;
      if(activity.SLToiDa && activity.SLToiDa>0 && count>=activity.SLToiDa) {
        const existing=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('sv',sql.BigInt,maSV).query<{MaCho:number;TrangThai:string}>(`SELECT MaCho,TrangThai FROM HANGDOICHODANGKY WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@hd AND MaSV=@sv`)).recordset[0];
        let id=existing?.MaCho;
        if(existing && existing.TrangThai==='Đã hủy') await new sql.Request(tx).input('id',sql.BigInt,id).query(`UPDATE HANGDOICHODANGKY SET TrangThai=N'Đang chờ',DangKyLuc=SYSDATETIMEOFFSET() WHERE MaCho=@id`);
        else if(!existing) id=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('sv',sql.BigInt,maSV).query<{MaCho:number}>(`INSERT INTO HANGDOICHODANGKY(MaHD,MaSV) OUTPUT INSERTED.MaCho VALUES(@hd,@sv)`)).recordset[0].MaCho;
        const rank=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('id',sql.BigInt,id).query<{ViTri:number}>(`SELECT COUNT(*) ViTri FROM HANGDOICHODANGKY WHERE MaHD=@hd AND TrangThai=N'Đang chờ' AND MaCho<=@id`)).recordset[0].ViTri;
        await tx.commit(); return {waitlisted:true,MaCho:id,ViTri:rank};
      }
      const created=await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('sv',sql.BigInt,maSV).input('type',sql.NVarChar(30),hinhThuc)
        .query<{MaDK:number;NgayDK:Date}>(`INSERT INTO DKTHAMGIA(MaHD,MaSV,NgayDK,HinhThuc,NguonDK,TrangThai) OUTPUT INSERTED.MaDK,INSERTED.NgayDK VALUES(@hd,@sv,SYSDATETIME(),@type,N'Sinh viên',N'Đã đăng ký')`);
      await tx.commit(); return {waitlisted:false,...created.recordset[0]};
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }

  async queueTeamIfOverCapacity(maHD:number,studentIds:number[]):Promise<Array<{MaCho:number;ViTri:number}>|null> {
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const activity=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).query<{SLToiDa:number|null}>(`SELECT SLSVDuKien AS SLToiDa FROM HOATDONGHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@hd`)).recordset[0];
      if(!activity){await tx.rollback();return null;}
      const count=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).query<{total:number}>(`SELECT COUNT(*) total FROM DKTHAMGIA WHERE MaHD=@hd AND TrangThai NOT IN(N'Đã hủy',N'Từ chối')`)).recordset[0].total;
      if(!activity.SLToiDa || count+studentIds.length<=activity.SLToiDa){await tx.rollback();return null;}
      const result:Array<{MaCho:number;ViTri:number}> = [];
      for(const studentId of studentIds) {
        let existing=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('sv',sql.BigInt,studentId).query<{MaCho:number;TrangThai:string}>(`SELECT MaCho,TrangThai FROM HANGDOICHODANGKY WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@hd AND MaSV=@sv`)).recordset[0];
        if(existing?.TrangThai==='Đã hủy') await new sql.Request(tx).input('id',sql.BigInt,existing.MaCho).query(`UPDATE HANGDOICHODANGKY SET TrangThai=N'Đang chờ',DangKyLuc=SYSDATETIMEOFFSET() WHERE MaCho=@id`);
        if(!existing) existing=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('sv',sql.BigInt,studentId).query<{MaCho:number;TrangThai:string}>(`INSERT INTO HANGDOICHODANGKY(MaHD,MaSV) OUTPUT INSERTED.MaCho,INSERTED.TrangThai VALUES(@hd,@sv)`)).recordset[0];
        const rank=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('id',sql.BigInt,existing.MaCho).query<{ViTri:number}>(`SELECT COUNT(*) ViTri FROM HANGDOICHODANGKY WHERE MaHD=@hd AND TrangThai=N'Đang chờ' AND MaCho<=@id`)).recordset[0].ViTri;
        result.push({MaCho:existing.MaCho,ViTri:rank});
      }
      await tx.commit(); return result;
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }

  async createWaitlistedTeam(maCThi:number,maHD:number,teamName:string,captainId:number,memberIds:number[]):Promise<{maDoi:number;queue:Array<{MaCho:number;ViTri:number;MaSV:number}>}|null> {
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const capacity=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).query<{SLToiDa:number|null;Total:number}>(`SELECT h.SLSVDuKien,(SELECT COUNT(*) FROM DKTHAMGIA dk WHERE dk.MaHD=h.MaHD AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) Total FROM HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK) WHERE h.MaHD=@hd`)).recordset[0];
      if(!capacity){await tx.rollback();return null;}
      if(!capacity.SLToiDa || capacity.Total+memberIds.length+1<=capacity.SLToiDa){await tx.rollback();return null;}
      const team=(await new sql.Request(tx).input('competition',sql.BigInt,maCThi).input('name',sql.NVarChar(150),teamName).query<{MaDoi:number}>(`INSERT INTO DOITHI(MaCThi,TenDoi) OUTPUT INSERTED.MaDoi VALUES(@competition,@name)`)).recordset[0];
      const people=[captainId,...memberIds];
      for(let index=0;index<people.length;index++) {
        const student=people[index];
        await new sql.Request(tx).input('team',sql.BigInt,team.MaDoi).input('student',sql.BigInt,student).input('role',sql.NVarChar(30),index===0?'Trưởng đội':'Thành viên').query(`INSERT INTO THANHVIENDOI(MaDoi,MaSV,VaiTro,HoTen) SELECT @team,@student,@role,n.HoTen FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung WHERE s.MaSV=@student`);
        const queue=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('student',sql.BigInt,student).query<{MaCho:number}>(`INSERT INTO HANGDOICHODANGKY(MaHD,MaSV) OUTPUT INSERTED.MaCho VALUES(@hd,@student)`)).recordset[0];
        const rank=(await new sql.Request(tx).input('hd',sql.BigInt,maHD).input('id',sql.BigInt,queue.MaCho).query<{ViTri:number}>(`SELECT COUNT(*) ViTri FROM HANGDOICHODANGKY WHERE MaHD=@hd AND TrangThai=N'Đang chờ' AND MaCho<=@id`)).recordset[0].ViTri;
        const q=queue as {MaCho:number;MaSV:number;ViTri:number}; q.MaSV=student;q.ViTri=rank;
      }
      const result=await new sql.Request(tx).input('team',sql.BigInt,team.MaDoi).input('name',sql.NVarChar(150),teamName).input('competition',sql.BigInt,maCThi).query<{MaCho:number;ViTri:number;MaSV:number}>(`SELECT q.MaCho,ROW_NUMBER() OVER(ORDER BY q.DangKyLuc,q.MaCho) ViTri,q.MaSV FROM HANGDOICHODANGKY q JOIN THANHVIENDOI tv ON tv.MaSV=q.MaSV WHERE q.MaHD=(SELECT MaHD FROM CUOCTHI WHERE MaCThi=@competition) AND tv.MaDoi=@team ORDER BY q.DangKyLuc,q.MaCho`);
      await tx.commit();return {maDoi:team.MaDoi,queue:result.recordset};
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }

  async findTeamByName(maCThi: number, tenDoi: string) {
    const rows = await this.db.query(
      `SELECT MaDoi, TenDoi FROM DOITHI WHERE MaCThi = @p1 AND TenDoi = @p2`,
      [maCThi, tenDoi],
    );
    return rows[0] ?? null;
  }

  async findTeamById(maDoi: number) {
    const rows = await this.db.query<{
      MaDoi: number; MaCThi: number; TenDoi: string; MaHD: number;
      TenCuocThi: string; HanDangKy: Date | null; TrangThai: string;
    }>(
      `SELECT d.MaDoi, d.MaCThi, d.TenDoi, c.MaHD, c.TenCuocThi,
              h.TgDuKien AS HanDangKy, h.TrangThai
       FROM DOITHI d
       JOIN CUOCTHI c ON c.MaCThi = d.MaCThi
       JOIN HOATDONGHOCTHUAT h ON h.MaHD = c.MaHD
       WHERE d.MaDoi = @p1`,
      [maDoi],
    );
    return rows[0] ?? null;
  }

  async addStudentToTeam(maDoi: number, maHD: number, maSV: number):Promise<{waitlisted:boolean;maCho?:number;viTri?:number}> {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const capacity=(await new sql.Request(transaction).input('maHD',sql.BigInt,maHD).query<{SLToiDa:number|null;Total:number}>(`SELECT h.SLSVDuKien,(SELECT COUNT(*) FROM DKTHAMGIA dk WHERE dk.MaHD=h.MaHD AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) Total FROM HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK) WHERE h.MaHD=@maHD`)).recordset[0];
      const alreadyRegistered=(await new sql.Request(transaction).input('maHD',sql.BigInt,maHD).input('maSV',sql.BigInt,maSV).query(`SELECT 1 AS found FROM DKTHAMGIA WHERE MaHD=@maHD AND MaSV=@maSV AND TrangThai NOT IN(N'Đã hủy',N'Từ chối')`)).recordset.length>0;
      const memberRequest = new sql.Request(transaction);
      memberRequest.input('maDoi', maDoi);
      memberRequest.input('maSV', maSV);
      await memberRequest.query(
        `INSERT INTO THANHVIENDOI(MaDoi,MaSV,VaiTro,HoTen)
         SELECT @maDoi,@maSV,N'Thành viên',n.HoTen FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung WHERE s.MaSV=@maSV`,
      );

      if(!alreadyRegistered && capacity?.SLToiDa && capacity.Total>=capacity.SLToiDa) {
        const queued=await new sql.Request(transaction).input('maHD',sql.BigInt,maHD).input('maSV',sql.BigInt,maSV).query<{MaCho:number}>(`IF EXISTS(SELECT 1 FROM HANGDOICHODANGKY WHERE MaHD=@maHD AND MaSV=@maSV AND TrangThai=N'Đã hủy')
            UPDATE HANGDOICHODANGKY SET TrangThai=N'Đang chờ',DangKyLuc=SYSDATETIMEOFFSET() OUTPUT INSERTED.MaCho WHERE MaHD=@maHD AND MaSV=@maSV
          ELSE IF NOT EXISTS(SELECT 1 FROM HANGDOICHODANGKY WHERE MaHD=@maHD AND MaSV=@maSV)
            INSERT INTO HANGDOICHODANGKY(MaHD,MaSV) OUTPUT INSERTED.MaCho VALUES(@maHD,@maSV)
          ELSE SELECT MaCho FROM HANGDOICHODANGKY WHERE MaHD=@maHD AND MaSV=@maSV`);
        const queueId=queued.recordset[0].MaCho;
        const rank=(await new sql.Request(transaction).input('maHD',sql.BigInt,maHD).input('id',sql.BigInt,queueId).query<{ViTri:number}>(`SELECT COUNT(*) ViTri FROM HANGDOICHODANGKY WHERE MaHD=@maHD AND TrangThai=N'Đang chờ' AND MaCho<=@id`)).recordset[0].ViTri;
        await transaction.commit(); return {waitlisted:true,maCho:queueId,viTri:rank};
      }

      const registrationRequest = new sql.Request(transaction);
      registrationRequest.input('maHD', maHD);
      registrationRequest.input('maSV', maSV);
      await registrationRequest.query(
        `IF EXISTS (SELECT 1 FROM DKTHAMGIA WHERE MaHD = @maHD AND MaSV = @maSV)
           UPDATE DKTHAMGIA SET HinhThuc = N'Dự thi', NguonDK = N'Sinh viên', TrangThai = N'Đã đăng ký'
           WHERE MaHD = @maHD AND MaSV = @maSV
         ELSE
           INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
           VALUES(@maHD, @maSV, SYSDATETIME(), N'Dự thi', N'Sinh viên', N'Đã đăng ký')`,
      );
      await transaction.commit();
      return {waitlisted:false};
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findStudentTeamInCompetition(maCThi: number, maSV: number) {
    const rows = await this.db.query<{ MaDoi: number; TenDoi: string; VaiTro: string }>(
      `SELECT d.MaDoi, d.TenDoi, tv.VaiTro
       FROM DOITHI d
       JOIN THANHVIENDOI tv ON tv.MaDoi = d.MaDoi
       WHERE d.MaCThi = @p1 AND tv.MaSV = @p2`,
      [maCThi, maSV],
    );
    return rows[0] ?? null;
  }

  async createTeamWithMembers(
    maCThi: number,
    maHD: number,
    tenDoi: string,
    captainMaSV: number,
    memberMaSVs: number[],
  ): Promise<{ maDoi: number; tenDoi: string; totalMembers: number }> {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();

    try {
      const capacity=(await new sql.Request(transaction).input('maHD',sql.BigInt,maHD).query<{SLToiDa:number|null;Total:number}>(`SELECT h.SLSVDuKien,(SELECT COUNT(*) FROM DKTHAMGIA dk WHERE dk.MaHD=h.MaHD AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) Total FROM HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK) WHERE h.MaHD=@maHD`)).recordset[0];
      if(capacity?.SLToiDa && capacity.Total+1+memberMaSVs.length>capacity.SLToiDa) throw new BadRequestException('Chỉ tiêu vừa đủ trong lúc đăng ký; hãy gửi lại để vào danh sách chờ');
      // 1. Insert DOITHI
      const teamReq = new sql.Request(transaction);
      teamReq.input('maCThi', maCThi);
      teamReq.input('tenDoi', tenDoi);
      const teamRes = await teamReq.query<{ MaDoi: number }>(
        `INSERT INTO DOITHI(MaCThi, TenDoi)
         OUTPUT INSERTED.MaDoi
         VALUES(@maCThi, @tenDoi)`,
      );
      const maDoi = teamRes.recordset[0].MaDoi;

      // 2. Insert Captain into THANHVIENDOI
      const capReq = new sql.Request(transaction);
      capReq.input('maDoi', maDoi);
      capReq.input('maSV', captainMaSV);
      await capReq.query(
        `INSERT INTO THANHVIENDOI(MaDoi,MaSV,VaiTro,HoTen) SELECT @maDoi,@maSV,N'Trưởng đội',n.HoTen FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung WHERE s.MaSV=@maSV`,
      );

      // Register captain in DKTHAMGIA if not present
      const capDkReq = new sql.Request(transaction);
      capDkReq.input('maHD', maHD);
      capDkReq.input('maSV', captainMaSV);
      await capDkReq.query(
        `IF NOT EXISTS (SELECT 1 FROM DKTHAMGIA WHERE MaHD = @maHD AND MaSV = @maSV)
         BEGIN
           INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
           VALUES(@maHD, @maSV, SYSDATETIME(), N'Dự thi', N'Sinh viên', N'Đã đăng ký')
         END`,
      );

      // 3. Insert Members into THANHVIENDOI and DKTHAMGIA
      for (const memberMaSV of memberMaSVs) {
        const memReq = new sql.Request(transaction);
        memReq.input('maDoi', maDoi);
        memReq.input('maSV', memberMaSV);
        await memReq.query(
          `INSERT INTO THANHVIENDOI(MaDoi,MaSV,VaiTro,HoTen) SELECT @maDoi,@maSV,N'Thành viên',n.HoTen FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung WHERE s.MaSV=@maSV`,
        );

        const memDkReq = new sql.Request(transaction);
        memDkReq.input('maHD', maHD);
        memDkReq.input('maSV', memberMaSV);
        await memDkReq.query(
          `IF NOT EXISTS (SELECT 1 FROM DKTHAMGIA WHERE MaHD = @maHD AND MaSV = @maSV)
           BEGIN
             INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
             VALUES(@maHD, @maSV, SYSDATETIME(), N'Dự thi', N'Sinh viên', N'Đã đăng ký')
           END`,
        );
      }

      const noticeRequest=new sql.Request(transaction);
      noticeRequest.input('maHD',sql.BigInt,maHD);
      noticeRequest.input('teamId',sql.BigInt,maDoi);
      await noticeRequest.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
        SELECT DISTINCT tk.MaTK,h.MaHD,N'Đăng ký thành công',N'Đăng ký đội thi thành công',CONCAT(N'Bạn đã được đăng ký vào đội ',d.TenDoi,N' tham gia ',h.TenHoatDong)
        FROM DOITHI d JOIN CUOCTHI c ON c.MaCThi=d.MaCThi JOIN HOATDONGHOCTHUAT h ON h.MaHD=c.MaHD
        JOIN THANHVIENDOI tv ON tv.MaDoi=d.MaDoi JOIN SINHVIEN s ON s.MaSV=tv.MaSV JOIN TAIKHOAN tk ON tk.MaNgDung=s.MaNgDung
        WHERE d.MaDoi=@teamId AND h.MaHD=@maHD`);

      await transaction.commit();
      return { maDoi, tenDoi, totalMembers: 1 + memberMaSVs.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getMyRegistrations(maSV: number): Promise<RegistrationRecord[]> {
    const rows = await this.db.query<RegistrationRecord>(
      `SELECT 
        dk.MaDK, 
        dk.MaHD, 
        h.TenHoatDong, 
        h.DiaDiem, 
        h.TgDuKien, h.TgDuKien, 
        dk.NgayDK, 
        dk.HinhThuc, 
        dk.TrangThai, 
        d.TenDoi, 
        tv.VaiTro AS VaiTroDoi
      FROM DKTHAMGIA dk
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = dk.MaHD
      LEFT JOIN CUOCTHI c ON c.MaHD = h.MaHD
      LEFT JOIN THANHVIENDOI tv ON tv.MaSV = dk.MaSV
      LEFT JOIN DOITHI d ON d.MaDoi = tv.MaDoi AND d.MaCThi = c.MaCThi
      WHERE dk.MaSV = @p1
      ORDER BY dk.NgayDK DESC`,
      [maSV],
    );
    return rows;
  }

  async getRegistrationsByActivity(maHD: number): Promise<ActivityRegistrationDetail[]> {
    const rows = await this.db.query<ActivityRegistrationDetail>(
      `SELECT 
        dk.MaDK,
        dk.MaHD,
        dk.MaSV,
        s.MSSV,
        n.HoTen,
        n.Email,
        n.SDT,
        l.TenLop,
        dk.NgayDK,
        dk.HinhThuc,
        dk.NguonDK,
        dk.TrangThai,
        d.TenDoi,
        tv.VaiTro AS VaiTroDoi
      FROM DKTHAMGIA dk
      JOIN SINHVIEN s ON s.MaSV = dk.MaSV
      JOIN NGUOIDUNG n ON n.MaNgDung = s.MaNgDung
      JOIN LOP l ON l.MaLop = s.MaLop
      LEFT JOIN CUOCTHI c ON c.MaHD = dk.MaHD
      LEFT JOIN THANHVIENDOI tv ON tv.MaSV = s.MaSV
      LEFT JOIN DOITHI d ON d.MaDoi = tv.MaDoi AND d.MaCThi = c.MaCThi
      WHERE dk.MaHD = @p1
      ORDER BY dk.NgayDK DESC`,
      [maHD],
    );
    return rows;
  }

  async updateRegistrationStatus(maDK: number, trangThai: string): Promise<boolean> {
    const tx = new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const result = await new sql.Request(tx).input('maDK', sql.BigInt, maDK).input('trangThai', sql.NVarChar(30), trangThai)
        .query<{MaHD:number;MaSV:number}>(`UPDATE DKTHAMGIA SET TrangThai=@trangThai OUTPUT INSERTED.MaHD,INSERTED.MaSV WHERE MaDK=@maDK`);
      const row=result.recordset[0];
      if(!row){await tx.rollback();return false;}
      if(trangThai==='Đã hủy') {
        await new sql.Request(tx).input('hd',sql.BigInt,row.MaHD).input('sv',sql.BigInt,row.MaSV).query(`UPDATE HANGDOICHODANGKY SET TrangThai=N'Đã hủy' WHERE MaHD=@hd AND MaSV=@sv AND TrangThai=N'Đã đăng ký'`);
        const activity=(await new sql.Request(tx).input('hd',sql.BigInt,row.MaHD).query<{SLToiDa:number|null;Total:number;Type:string}>(
          `SELECT h.SLSVDuKien,(SELECT COUNT(*) FROM DKTHAMGIA d WHERE d.MaHD=h.MaHD AND d.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) Total,
            CASE WHEN EXISTS(SELECT 1 FROM CUOCTHI c WHERE c.MaHD=h.MaHD) THEN N'Dự thi' ELSE N'Tham gia' END Type
           FROM HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK) WHERE h.MaHD=@hd`)).recordset[0];
        if(activity && (!activity.SLToiDa || activity.Total<activity.SLToiDa)) {
          const next=(await new sql.Request(tx).input('hd',sql.BigInt,row.MaHD).query<{MaCho:number;MaSV:number}>(`SELECT TOP(1) MaCho,MaSV FROM HANGDOICHODANGKY WITH(UPDLOCK,READPAST,ROWLOCK) WHERE MaHD=@hd AND TrangThai=N'Đang chờ' ORDER BY DangKyLuc,MaCho`)).recordset[0];
          if(next) {
            await new sql.Request(tx).input('hd',sql.BigInt,row.MaHD).input('sv',sql.BigInt,next.MaSV).input('type',sql.NVarChar(30),activity.Type)
              .query(`INSERT INTO DKTHAMGIA(MaHD,MaSV,NgayDK,HinhThuc,NguonDK,TrangThai) VALUES(@hd,@sv,SYSDATETIME(),@type,N'Khoa',N'Đã đăng ký')`);
            await new sql.Request(tx).input('id',sql.BigInt,next.MaCho).query(`UPDATE HANGDOICHODANGKY SET TrangThai=N'Đã đăng ký' WHERE MaCho=@id`);
            await new sql.Request(tx).input('hd',sql.BigInt,row.MaHD).input('sv',sql.BigInt,next.MaSV).query(`
              INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
              SELECT t.MaTK,@hd,N'Đăng ký được xác nhận',N'Bạn đã được nhận vào hoạt động',CONCAT(N'Đã có chỗ cho bạn tham gia ',h.TenHoatDong)
              FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN HOATDONGHOCTHUAT h ON h.MaHD=@hd WHERE s.MaSV=@sv`);
          }
        }
      }
      await tx.commit(); return true;
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }

  async assignSupport(
    maHD: number,
    maLop: number,
    soLuong: number,
    loaiPhanCong: string,
    nhiemVu: string | null = null,
  ): Promise<void> {
    await this.db.pool
      .request()
      .input('maHD', maHD)
      .input('maLop', maLop)
      .input('soLuong', soLuong)
      .input('loaiPhanCong', loaiPhanCong)
      .input('nhiemVu', nhiemVu)
      .query(
        `IF EXISTS (SELECT 1 FROM PHANCONGCOVU WHERE MaHD = @maHD AND MaLop = @maLop)
         BEGIN
           UPDATE PHANCONGCOVU 
           SET SoLuong = @soLuong, LoaiPhanCong = @loaiPhanCong, NhiemVu = @nhiemVu, NgayPhCong = SYSDATETIME()
           WHERE MaHD = @maHD AND MaLop = @maLop
         END
         ELSE
         BEGIN
           INSERT INTO PHANCONGCOVU(MaHD, MaLop, SoLuong, LoaiPhanCong, NhiemVu, NgayPhCong, TrangThai)
           VALUES(@maHD, @maLop, @soLuong, @loaiPhanCong, @nhiemVu, SYSDATETIME(), N'Chờ thực hiện')
         END`,
      );
  }

  async getSupportAssignments(maHD: number): Promise<SupportAssignmentRecord[]> {
    const rows = await this.db.query<SupportAssignmentRecord>(
      `SELECT 
        pc.MaCoVu,
        pc.MaHD,
        pc.MaLop,
        l.TenLop,
        pc.SoLuong,
        pc.LoaiPhanCong,
        pc.NhiemVu,
        pc.NgayPhCong,
        pc.TrangThai
      FROM PHANCONGCOVU pc
      JOIN LOP l ON l.MaLop = pc.MaLop
      WHERE pc.MaHD = @p1
      ORDER BY l.TenLop`,
      [maHD],
    );
    return rows;
  }
}
