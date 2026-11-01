import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import type { CompetitionAwardDto, CompetitionRoundDto, GradedCompetitionResultDto, RoundAssignmentDto, RoundExamDto, RoundRegistrationDto, RoundScoreDto, RoundStatusDto, RoundSubmissionDto } from '../../presentation/workflow/competition-workflow.dto';

type Row = Record<string, unknown>;
type Competition = {MaCThi:number;MaHD:number;MaKhoa:number;TenCuocThi:string;TenHoatDong:string;TrangThai:string;TrangThaiKeHoach:string;HinhThucThi:string};
type Round = {MaVong:number;MaCThi:number;TenVong:string;TrangThai:string;BatDauLuc:Date;KetThucLuc:Date;HanNopBai:Date};
const roleKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const roles=(context:SessionContext,allowed:string[])=>context.user.roles.some(role=>allowed.includes(roleKey(role)));

@Injectable()
export class CompetitionWorkflowService {
  constructor(@Inject(DatabaseService) private readonly db:DatabaseService) {}

  private async facultyId() {
    const faculties=await this.db.query<{MaKhoa:number;TenKhoa:string}>('SELECT MaKhoa,TenKhoa FROM KHOA ORDER BY MaKhoa');
    const names=['CONGNGHETHONGTIN','KHOACONGNGHETHONGTIN','CNTT','KHOACNTT'];
    const matches=faculties.filter(row=>names.includes(roleKey(row.TenKhoa)));
    if(matches.length!==1) throw new ServiceUnavailableException('Cần cấu hình duy nhất Khoa Công nghệ thông tin');
    return Number(matches[0].MaKhoa);
  }
  private async scopeCompetition(id:number) {
    const faculty=await this.facultyId();
    const row=(await this.db.query<Competition>(`SELECT c.MaCThi,c.MaHD,c.TenCuocThi,c.HinhThucThi,h.TenHoatDong,h.TrangThai,bm.MaKhoa,d.TrangThai AS TrangThaiKeHoach
      FROM CUOCTHI c JOIN HOATDONGHOCTHUAT h ON h.MaHD=c.MaHD
      JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD JOIN BOMON bm ON bm.MaBM=d.MaBM
      WHERE c.MaCThi=@p1`,[id]))[0];
    if(!row || Number(row.MaKhoa)!==faculty) throw new NotFoundException('Không tìm thấy cuộc thi của Khoa Công nghệ thông tin');
    if(row.TrangThai!=='Đã công bố'||row.TrangThaiKeHoach!=='Đã duyệt') throw new BadRequestException('Cuộc thi phải có kế hoạch chi tiết được khoa và Phòng CTSV ký duyệt, sau đó công bố');
    return row;
  }
  private async organizer(context:SessionContext,competition:Competition) {
    if(roles(context,['ADMIN'])) return true;
    const assigned=await this.db.query(`SELECT TOP(1) t.MaTK FROM TAIKHOAN t
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=t.MaNgDung
      WHERE t.MaTK=@p1 AND (EXISTS(SELECT 1 FROM BANTOCHUC b WHERE b.MaHD=@p2 AND b.MaNgDung=t.MaNgDung)
      OR (cb.MaKhoa=@p3 AND @p4=1))`,[context.userId,competition.MaHD,competition.MaKhoa,roles(context,['CANBOKHOA','TRUONGKHOA'])?1:0]);
    return Boolean(assigned.length);
  }
  private async requireOrganizer(context:SessionContext,competition:Competition) {
    if(!await this.organizer(context,competition)) throw new ForbiddenException('Chỉ Ban tổ chức được phân công hoặc khoa được quản lý cuộc thi');
  }
  private async roundScope(id:number) {
    const row=(await this.db.query<Round>('SELECT * FROM VONGTHI WHERE MaVong=@p1',[id]))[0];
    if(!row) throw new NotFoundException('Không tìm thấy vòng thi');
    return {round:row,competition:await this.scopeCompetition(row.MaCThi)};
  }
  private isOpen(round:Round) {
    const now=Date.now();
    return round.TrangThai==='Đang mở' && new Date(round.BatDauLuc).getTime()<=now && now<=new Date(round.KetThucLuc).getTime();
  }
  private async assigned(context:SessionContext,roundId:number,role:'RA_DE'|'CHAM_THI') {
    const found=await this.db.query(`SELECT p.MaTK FROM PHANCONGVONGTHI p JOIN TAIKHOAN t ON t.MaTK=p.MaTK
      JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
      WHERE p.MaVong=@p1 AND p.MaTK=@p2 AND p.VaiTro=@p3 AND t.TrangThai=N'Hoạt động'`,[roundId,context.userId,role]);
    return Boolean(found.length);
  }
  private async studentRegistration(context:SessionContext,competition:Competition) {
    return (await this.db.query<{MaDK:number;MaSV:number}>(`SELECT TOP(1) dk.MaDK,s.MaSV FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung
      JOIN DKTHAMGIA dk ON dk.MaSV=s.MaSV AND dk.MaHD=@p2
      WHERE t.MaTK=@p1 AND dk.HinhThuc=N'Dự thi' AND dk.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận') ORDER BY dk.MaDK`,[context.userId,competition.MaHD]))[0]??null;
  }
  private async participation(context:SessionContext,roundId:number,registration:{MaDK:number;MaSV:number}|null) {
    if(!registration) return null;
    return (await this.db.query<Row>(`SELECT p.* FROM DANGKYVONGTHI p WHERE p.MaVong=@p1 AND
      (p.MaDK=@p2 OR EXISTS(SELECT 1 FROM THANHVIENDOI tv WHERE tv.MaDoi=p.MaDoi AND tv.MaSV=@p3))`,[roundId,registration.MaDK,registration.MaSV]))[0]??null;
  }
  private async mutation<T=Row>(statement:string,params:unknown[]) {
    try {return await this.db.query<T>(statement,params);} catch(error) {
      if([2601,2627].includes(Number((error as {number?:number}).number))) throw new ConflictException('Dữ liệu đã tồn tại; hãy tải lại danh sách');
      throw error;
    }
  }
  async competitions(_context:SessionContext) {
    void _context;
    const faculty=await this.facultyId();
    return this.db.query(`SELECT c.MaCThi,c.MaHD,c.TenCuocThi,h.TenHoatDong,h.NamHoc,h.TgBatDau,h.TgKetThuc,c.HinhThucThi
      FROM CUOCTHI c JOIN HOATDONGHOCTHUAT h ON h.MaHD=c.MaHD JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
      JOIN BOMON bm ON bm.MaBM=d.MaBM WHERE bm.MaKhoa=@p1 AND d.TrangThai=N'Đã duyệt' AND h.TrangThai=N'Đã công bố'
      ORDER BY h.TgBatDau DESC,c.MaCThi DESC`,[faculty]);
  }
  async competition(context:SessionContext,id:number) {
    const competition=await this.scopeCompetition(id);
    const canOrganize=await this.organizer(context,competition);
    const registration=await this.studentRegistration(context,competition);
    const [rounds,awards,results,staff,teams]=await Promise.all([
      this.db.query('SELECT * FROM VONGTHI WHERE MaCThi=@p1 ORDER BY ThuTu',[id]),
      this.db.query('SELECT * FROM GIAITHUONG WHERE MaCThi=@p1 ORDER BY MaGT',[id]),
      this.db.query(`SELECT k.*,COALESCE(gt.TenGT,k.TenGiai) AS TenGiaiThuong,d.TenDoi,n.HoTen,s.MSSV FROM KETQUAHOCTHUAT k
        LEFT JOIN GIAITHUONG gt ON gt.MaGT=k.MaGT LEFT JOIN DOITHI d ON d.MaDoi=k.MaDoi LEFT JOIN DKTHAMGIA dk ON dk.MaDK=k.MaDK
        LEFT JOIN SINHVIEN s ON s.MaSV=dk.MaSV LEFT JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
        WHERE k.MaCThi=@p1 AND (@p2=1 OR k.TrangThai=N'Đã công bố') ORDER BY k.XepHang,k.MaKQ`,[id,canOrganize?1:0]),
      canOrganize?this.db.query(`SELECT t.MaTK,n.HoTen,bm.TenBM FROM TAIKHOAN t JOIN NGUOIDUNG n ON n.MaNgDung=t.MaNgDung
        JOIN GIANGVIEN gv ON gv.MaNgDung=n.MaNgDung JOIN BOMON bm ON bm.MaBM=gv.MaBM
        WHERE bm.MaKhoa=@p1 AND t.TrangThai=N'Hoạt động' ORDER BY n.HoTen`,[competition.MaKhoa]):Promise.resolve([]),
      registration?this.db.query(`SELECT d.MaDoi,d.TenDoi FROM DOITHI d JOIN THANHVIENDOI tv ON tv.MaDoi=d.MaDoi WHERE d.MaCThi=@p1 AND tv.MaSV=@p2`,[id,registration.MaSV]):Promise.resolve([]),
    ]);
    return {competition,rounds,awards,results,staff,teams,registration,canOrganize};
  }
  async createRound(context:SessionContext,id:number,dto:CompetitionRoundDto) {
    const competition=await this.scopeCompetition(id); await this.requireOrganizer(context,competition);
    const start=new Date(dto.batDauLuc).getTime(),end=new Date(dto.ketThucLuc).getTime(),deadline=new Date(dto.hanNopBai).getTime();
    if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(deadline)||end<=start||deadline<start||deadline>end) throw new BadRequestException('Hạn nộp bài phải nằm trong thời gian của vòng thi');
    return (await this.mutation(`INSERT INTO VONGTHI(MaCThi,TenVong,ThuTu,MoTa,BatDauLuc,KetThucLuc,HanNopBai,TrangThai)
      OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,N'Chưa mở')`,[id,dto.tenVong.trim(),dto.thuTu,dto.moTa??null,dto.batDauLuc,dto.ketThucLuc,dto.hanNopBai]))[0];
  }
  async assignRound(context:SessionContext,id:number,dto:RoundAssignmentDto) {
    const {round,competition}=await this.roundScope(id); await this.requireOrganizer(context,competition);
    if(round.TrangThai!=='Chưa mở'||new Date(round.BatDauLuc).getTime()<=Date.now()) throw new BadRequestException('Chỉ phân công trước khi vòng thi bắt đầu');
    const staff=await this.db.query(`SELECT t.MaTK FROM TAIKHOAN t JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung JOIN BOMON bm ON bm.MaBM=gv.MaBM
      WHERE t.MaTK=@p1 AND bm.MaKhoa=@p2 AND t.TrangThai=N'Hoạt động'`,[dto.maTK,competition.MaKhoa]);
    if(!staff.length) throw new BadRequestException('Chọn tài khoản giảng viên đang hoạt động của Khoa Công nghệ thông tin');
    return (await this.mutation(`INSERT INTO PHANCONGVONGTHI(MaVong,MaTK,VaiTro,NguoiPhanCong) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,[id,dto.maTK,dto.vaiTro,context.userId]))[0];
  }
  async setRoundStatus(context:SessionContext,id:number,dto:RoundStatusDto) {
    const {round,competition}=await this.roundScope(id); await this.requireOrganizer(context,competition);
    if(dto.trangThai==='Chưa mở') throw new BadRequestException('Vòng đã mở không thể đưa lại về trạng thái chưa mở');
    if(dto.trangThai==='Đang mở') {
      if(round.TrangThai!=='Chưa mở') throw new BadRequestException('Chỉ mở vòng thi đang chưa mở');
      const exam=await this.db.query('SELECT MaVong FROM DETHIVONG WHERE MaVong=@p1 AND DaPhatHanh=1',[id]);
      if(!exam.length) throw new BadRequestException('Phải phát hành đề thi trước khi mở vòng');
      if(new Date(round.KetThucLuc).getTime()<=Date.now()) throw new BadRequestException('Vòng thi đã hết thời gian');
    } else if(round.TrangThai!=='Đang mở') throw new BadRequestException('Chỉ đóng vòng thi đang mở');
    return (await this.db.query('UPDATE VONGTHI SET TrangThai=@p2 OUTPUT INSERTED.* WHERE MaVong=@p1 AND TrangThai=@p3',[id,dto.trangThai,round.TrangThai]))[0];
  }
  async round(context:SessionContext,id:number) {
    const {round,competition}=await this.roundScope(id);
    const [canOrganize,canSetExam,canGrade,registration]=await Promise.all([this.organizer(context,competition),this.assigned(context,id,'RA_DE'),this.assigned(context,id,'CHAM_THI'),this.studentRegistration(context,competition)]);
    const participation=await this.participation(context,id,registration);
    const open=this.isOpen(round);
    const canSeeStaffExam=canOrganize||canSetExam;
    // The SQL predicate prevents draft content from reaching the student response at all.
    const exam=(await this.db.query(`SELECT MaVong,NoiDung,UrlTep,DaPhatHanh,PhatHanhLuc FROM DETHIVONG WHERE MaVong=@p1
      AND (@p2=1 OR (DaPhatHanh=1 AND @p3=1))`,[id,canSeeStaffExam?1:0,(open&&Boolean(participation))||(canGrade&&new Date(round.BatDauLuc).getTime()<=Date.now())?1:0]))[0]??null;
    const assignments=canOrganize||canSetExam||canGrade?await this.db.query(`SELECT p.MaTK,p.VaiTro,n.HoTen FROM PHANCONGVONGTHI p JOIN TAIKHOAN t ON t.MaTK=p.MaTK LEFT JOIN NGUOIDUNG n ON n.MaNgDung=t.MaNgDung WHERE p.MaVong=@p1 ORDER BY p.VaiTro,n.HoTen`,[id]):[];
    const submissions=await this.db.query(`SELECT b.*,d.TenDoi,n.HoTen,s.MSSV,
      (SELECT AVG(c.Diem) FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai) AS DiemTrungBinh,
      (SELECT COUNT(*) FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai) AS SoLuotCham,
      (SELECT c.Diem FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai AND c.MaTK=@p2) AS DiemCuaToi
      FROM BAITHI b LEFT JOIN DOITHI d ON d.MaDoi=b.MaDoi LEFT JOIN DKTHAMGIA dk ON dk.MaDK=b.MaDK
      LEFT JOIN SINHVIEN s ON s.MaSV=dk.MaSV LEFT JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
      WHERE b.MaVong=@p1 AND (@p3=1 OR b.MaDKVong=@p4) ORDER BY b.NopLuc`,[id,context.userId,canOrganize||canGrade?1:0,participation?participation.MaDKVong:null]);
    return {round,assignments,exam,participation,submissions,canOrganize,canSetExam,canGrade,isOpen:open};
  }
  async registerRound(context:SessionContext,id:number,dto:RoundRegistrationDto) {
    const {round,competition}=await this.roundScope(id);
    if(round.TrangThai==='Đã đóng'||new Date(round.HanNopBai).getTime()<=Date.now()) throw new BadRequestException('Vòng thi đã đóng đăng ký');
    const registration=await this.studentRegistration(context,competition);
    if(!registration) throw new ForbiddenException('Bạn cần đăng ký dự thi hoạt động trước khi đăng ký từng vòng');
    const teams=await this.db.query<{MaDoi:number}>(`SELECT d.MaDoi FROM DOITHI d JOIN THANHVIENDOI tv ON tv.MaDoi=d.MaDoi WHERE d.MaCThi=@p1 AND tv.MaSV=@p2`,[competition.MaCThi,registration.MaSV]);
    if(dto.maDoi&&!teams.some(row=>Number(row.MaDoi)===dto.maDoi)) throw new ForbiddenException('Bạn không thuộc đội của cuộc thi này');
    if(teams.length&&!dto.maDoi) throw new BadRequestException('Bạn đã thuộc đội; hãy đăng ký vòng thi theo đội');
    if(competition.HinhThucThi==='Theo đội'&&!dto.maDoi) throw new BadRequestException('Cuộc thi yêu cầu đăng ký theo đội');
    if(await this.participation(context,id,registration)) throw new ConflictException('Bạn hoặc đội đã đăng ký vòng thi này');
    return (await this.mutation(`INSERT INTO DANGKYVONGTHI(MaVong,MaDK,MaDoi,NguoiDangKy) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,[id,dto.maDoi?null:registration.MaDK,dto.maDoi??null,context.userId]))[0];
  }
  async saveExam(context:SessionContext,id:number,dto:RoundExamDto) {
    const {round}=await this.roundScope(id);
    if(!await this.assigned(context,id,'RA_DE')) throw new ForbiddenException('Chỉ giảng viên được phân công ra đề của vòng này được soạn đề');
    if(round.TrangThai!=='Chưa mở'||new Date(round.BatDauLuc).getTime()<=Date.now()) throw new BadRequestException('Không sửa đề khi vòng thi đã bắt đầu');
    const rows=await this.db.query(`DECLARE @saved TABLE(MaVong BIGINT,DaPhatHanh BIT);
      UPDATE DETHIVONG WITH(UPDLOCK,SERIALIZABLE) SET NoiDung=@p2,UrlTep=@p3,NguoiSoan=@p4,CapNhatLuc=SYSDATETIMEOFFSET()
      OUTPUT INSERTED.MaVong,INSERTED.DaPhatHanh INTO @saved WHERE MaVong=@p1 AND DaPhatHanh=0;
      IF @@ROWCOUNT=0 AND NOT EXISTS(SELECT 1 FROM DETHIVONG WHERE MaVong=@p1)
      INSERT INTO DETHIVONG(MaVong,NoiDung,UrlTep,NguoiSoan) OUTPUT INSERTED.MaVong,INSERTED.DaPhatHanh INTO @saved VALUES(@p1,@p2,@p3,@p4);
      SELECT * FROM @saved;`,[id,dto.noiDung.trim(),dto.urlTep??null,context.userId]);
    if(!rows.length) throw new ConflictException('Đề đã phát hành nên không thể sửa');
    return rows[0];
  }
  async releaseExam(context:SessionContext,id:number) {
    const {round,competition}=await this.roundScope(id);
    if(!await this.assigned(context,id,'RA_DE')&&!await this.organizer(context,competition)) throw new ForbiddenException('Bạn không được phát hành đề vòng này');
    if(round.TrangThai!=='Chưa mở'||new Date(round.BatDauLuc).getTime()<=Date.now()) throw new BadRequestException('Phải phát hành đề trước khi vòng thi bắt đầu');
    const rows=await this.db.query(`UPDATE DETHIVONG SET DaPhatHanh=1,PhatHanhLuc=SYSDATETIMEOFFSET(),NguoiPhatHanh=@p2
      OUTPUT INSERTED.MaVong,INSERTED.DaPhatHanh WHERE MaVong=@p1 AND DaPhatHanh=0`,[id,context.userId]);
    if(!rows.length) throw new BadRequestException('Chưa có đề nháp hoặc đề đã phát hành');
    return rows[0];
  }
  async submitWork(context:SessionContext,id:number,dto:RoundSubmissionDto) {
    const {round,competition}=await this.roundScope(id);
    if(!this.isOpen(round)||new Date(round.HanNopBai).getTime()<=Date.now()) throw new BadRequestException('Vòng thi chưa mở hoặc đã hết hạn nộp bài');
    const registration=await this.studentRegistration(context,competition);
    const participation=await this.participation(context,id,registration);
    if(!participation) throw new ForbiddenException('Bạn chưa đăng ký vòng thi này hoặc đăng ký dự thi không còn hiệu lực');
    const exam=await this.db.query('SELECT MaVong FROM DETHIVONG WHERE MaVong=@p1 AND DaPhatHanh=1',[id]);
    if(!exam.length) throw new BadRequestException('Đề thi chưa phát hành');
    const duplicate=await this.db.query('SELECT MaBai FROM BAITHI WHERE MaDKVong=@p1',[participation.MaDKVong]);
    if(duplicate.length) throw new ConflictException('Bạn hoặc đội đã nộp bài vòng này');
    return (await this.mutation(`INSERT INTO BAITHI(MaVong,MaDK,MaDoi,TieuDe,MoTa,TepDinhKem,MaDKVong)
      OUTPUT INSERTED.MaBai,INSERTED.NopLuc VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7)`,[id,participation.MaDK??null,participation.MaDoi??null,dto.tieuDe.trim(),dto.moTa??null,JSON.stringify(dto.tepDinhKem??[]),participation.MaDKVong]))[0];
  }
  async scoreWork(context:SessionContext,id:number,dto:RoundScoreDto) {
    if(!Number.isFinite(dto.diem)||dto.diem<0||dto.diem>100) throw new BadRequestException('Điểm phải từ 0 đến 100');
    const work=(await this.db.query<{MaVong:number}>('SELECT MaVong FROM BAITHI WHERE MaBai=@p1 AND MaDKVong IS NOT NULL',[id]))[0];
    if(!work) throw new NotFoundException('Không tìm thấy bài dự thi hợp lệ');
    const {round}=await this.roundScope(work.MaVong);
    if(!await this.assigned(context,work.MaVong,'CHAM_THI')) throw new ForbiddenException('Chỉ giảng viên được phân công chấm vòng thi này được nhập điểm');
    if(round.TrangThai!=='Đã đóng'&&new Date(round.KetThucLuc).getTime()>Date.now()) throw new BadRequestException('Chấm điểm sau khi vòng thi kết thúc hoặc được đóng');
    return (await this.db.query(`IF EXISTS(SELECT 1 FROM CHAMDIEMVONG WHERE MaBai=@p1 AND MaTK=@p2)
      UPDATE CHAMDIEMVONG SET Diem=@p3,NhanXet=@p4,ChamLuc=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE MaBai=@p1 AND MaTK=@p2
      ELSE INSERT INTO CHAMDIEMVONG(MaBai,MaTK,Diem,NhanXet) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,[id,context.userId,dto.diem,dto.nhanXet??null]))[0];
  }
  async createAward(context:SessionContext,id:number,dto:CompetitionAwardDto) {
    const competition=await this.scopeCompetition(id); await this.requireOrganizer(context,competition);
    return (await this.db.query(`INSERT INTO GIAITHUONG(MaCThi,TenGT,TienThuong,SLGiai) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,[id,dto.tenGT.trim(),dto.tienThuong??0,dto.slGiai??1]))[0];
  }
  private async gradedWork(competitionId:number,workId:number) {
    const work=(await this.db.query<Row>(`SELECT b.MaBai,b.MaDK,b.MaDoi,v.TrangThai,v.KetThucLuc,
      (SELECT AVG(c.Diem) FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai) AS Diem,
      (SELECT COUNT(*) FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai) AS SoLuotCham,
      (SELECT COUNT(*) FROM PHANCONGVONGTHI p WHERE p.MaVong=b.MaVong AND p.VaiTro='CHAM_THI') AS SoGiamKhao
      FROM BAITHI b JOIN VONGTHI v ON v.MaVong=b.MaVong JOIN CUOCTHI ct ON ct.MaCThi=v.MaCThi
      WHERE b.MaBai=@p1 AND v.MaCThi=@p2 AND b.MaDKVong IS NOT NULL
      AND ((b.MaDK IS NOT NULL AND EXISTS(SELECT 1 FROM DKTHAMGIA dk WHERE dk.MaDK=b.MaDK AND dk.MaHD=ct.MaHD AND dk.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận')))
        OR (b.MaDoi IS NOT NULL AND EXISTS(SELECT 1 FROM DOITHI d WHERE d.MaDoi=b.MaDoi AND d.MaCThi=ct.MaCThi)))`,[workId,competitionId]))[0];
    if(!work||work.Diem===null||!Number(work.SoLuotCham)||Number(work.SoLuotCham)<Number(work.SoGiamKhao)) throw new BadRequestException('Chọn bài hợp lệ đã được các giám khảo được phân công chấm đầy đủ');
    if(work.TrangThai!=='Đã đóng'&&new Date(String(work.KetThucLuc)).getTime()>Date.now()) throw new BadRequestException('Chỉ tổng kết vòng thi đã kết thúc');
    return work;
  }
  async createResult(context:SessionContext,id:number,dto:GradedCompetitionResultDto) {
    const competition=await this.scopeCompetition(id); await this.requireOrganizer(context,competition);
    if(!dto.maGT&&!dto.tenGiai?.trim()) throw new BadRequestException('Chọn giải thưởng hoặc nhập tên giải');
    const work=await this.gradedWork(id,dto.maBai);
    if(dto.maGT&&!(await this.db.query('SELECT MaGT FROM GIAITHUONG WHERE MaGT=@p1 AND MaCThi=@p2',[dto.maGT,id])).length) throw new BadRequestException('Giải thưởng không thuộc cuộc thi');
    const duplicate=await this.db.query('SELECT MaKQ FROM KETQUAHOCTHUAT WHERE MaCThi=@p1 AND (MaDK=@p2 OR MaDoi=@p3)',[id,work.MaDK??null,work.MaDoi??null]);
    if(duplicate.length) throw new ConflictException('Thí sinh hoặc đội đã có kết quả của cuộc thi');
    return (await this.db.query(`INSERT INTO KETQUAHOCTHUAT(MaCThi,MaDK,MaDoi,MaGT,LoaiKQ,XepHang,Diem,GhiChu,TrangThai,MaBaiNguon,TenGiai)
      OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4,N'Giải thưởng',@p5,@p6,@p7,N'Dự thảo',@p8,@p9)`,[id,work.MaDK??null,work.MaDoi??null,dto.maGT??null,dto.xepHang,work.Diem,dto.ghiChu??null,dto.maBai,dto.tenGiai?.trim()??null]))[0];
  }
  async publishResult(context:SessionContext,id:number) {
    const result=(await this.db.query<{MaCThi:number;MaBaiNguon:number|null;TrangThai:string}>('SELECT MaCThi,MaBaiNguon,TrangThai FROM KETQUAHOCTHUAT WHERE MaKQ=@p1',[id]))[0];
    if(!result) throw new NotFoundException('Không tìm thấy kết quả');
    const competition=await this.scopeCompetition(result.MaCThi); await this.requireOrganizer(context,competition);
    if(!result.MaBaiNguon) throw new BadRequestException('Kết quả phải được lập từ bài đã chấm trong quy trình vòng thi');
    if(result.TrangThai!=='Dự thảo') throw new ConflictException('Kết quả đã công bố');
    await this.gradedWork(result.MaCThi,result.MaBaiNguon);
    const rows=await this.db.query(`SET XACT_ABORT ON; BEGIN TRAN;
      UPDATE KETQUAHOCTHUAT WITH(UPDLOCK,HOLDLOCK) SET TrangThai=N'Đã công bố' WHERE MaKQ=@p1 AND TrangThai=N'Dự thảo';
      IF @@ROWCOUNT=0 BEGIN ROLLBACK; THROW 51020,N'Kết quả đã thay đổi',1; END;
      INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
      SELECT DISTINCT t.MaTK,c.MaHD,N'Kết quả cuộc thi',N'Kết quả cuộc thi đã được công bố',
        CONCAT(c.TenCuocThi,N': ',COALESCE(gt.TenGT,r.TenGiai),N'; xếp hạng ',r.XepHang,N'; điểm ',r.Diem)
      FROM KETQUAHOCTHUAT r JOIN CUOCTHI c ON c.MaCThi=r.MaCThi LEFT JOIN GIAITHUONG gt ON gt.MaGT=r.MaGT
      JOIN DKTHAMGIA dk ON dk.MaHD=c.MaHD AND dk.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận')
        AND (dk.MaDK=r.MaDK OR EXISTS(SELECT 1 FROM THANHVIENDOI tv WHERE tv.MaDoi=r.MaDoi AND tv.MaSV=dk.MaSV))
      JOIN SINHVIEN s ON s.MaSV=dk.MaSV JOIN TAIKHOAN t ON t.MaNgDung=s.MaNgDung WHERE r.MaKQ=@p1;
      SELECT MaKQ,TrangThai FROM KETQUAHOCTHUAT WHERE MaKQ=@p1; COMMIT;`,[id]);
    return rows[0];
  }
}
