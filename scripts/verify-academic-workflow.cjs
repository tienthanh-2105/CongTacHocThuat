// Local integration verification. Creates tagged fixtures and removes them in finally.
require('reflect-metadata');
require('dotenv').config({path:'apps/api/.env',quiet:true});
const assert=require('node:assert/strict');
const {ConfigService}=require('@nestjs/config');
const {DatabaseService}=require('../apps/api/dist/data/database.service');
const {WorkflowService}=require('../apps/api/dist/business/workflow/workflow.service');
const {DetailedPlansService}=require('../apps/api/dist/business/detailed-plans/detailed-plans.service');
const {CompetitionWorkflowService}=require('../apps/api/dist/business/workflow/competition-workflow.service');
(async()=>{
  const db=new DatabaseService(new ConfigService(process.env));let aid,pid,cid,rid;
  try {
    await db.onModuleInit();
    const admin=(await db.query("SELECT TOP(1) t.MaTK FROM TAIKHOAN t JOIN VAITRO v ON v.MaVaiTro=t.MaVaiTro WHERE v.TenVaiTro='ADMIN'"))[0];
    const teacher=(await db.query('SELECT TOP(1) t.MaTK FROM TAIKHOAN t JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung JOIN BOMON bm ON bm.MaBM=gv.MaBM JOIN KHOA k ON k.MaKhoa=bm.MaKhoa WHERE k.TenKhoa=N\'Công nghệ thông tin\' AND t.TrangThai=N\'Hoạt động\''))[0];
    const student=(await db.query('SELECT TOP(1) t.MaTK,s.MaSV FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung'))[0];
    assert.ok(admin && teacher && student,'Need existing admin, IT lecturer and student fixtures');
    const ctx=(id,role)=>({userId:String(id),user:{roles:[role]}});
    const c=ctx(admin.MaTK,'ADMIN'), lecturer=ctx(teacher.MaTK,'GIANGVIEN'), learner=ctx(student.MaTK,'SINHVIEN');
    const w=new WorkflowService(db),d=new DetailedPlansService(db),v=new CompetitionWorkflowService(db);
    const units=await w.listPlanUnits(c),tag='VERIFY-'+Date.now();
    const a=await w.createAcademicActivity(c,{maBM:units.departments[0].MaBM,tenHoatDong:tag,loaiHoatDong:'Cuộc thi',noiDung:'Kế hoạch kiểm tra nghiệp vụ',doiTuongThamDu:'Sinh viên',namHoc:'2030-2031',hocKy:'HK1',slsvDuKien:10,tgDuKien:'2030-10-30'});aid=a.MaHD;
    await assert.rejects(w.submitAcademicActivity(c,aid));
    await w.createActivityBudget(c,aid,{noiDung:'Khoản kiểm tra',soTien:1000,soLuong:1,donGia:1000});
    const pack=await w.submitAcademicActivity(c,aid);
    await w.reviewActivityBudget(c,pack.duTru.MaDuTruKP,{action:'approve'});await w.approveAcademicActivity(c,aid);
    const p=await w.createPlan(c,{maKhoa:units.faculty.MaKhoa,tenKeHoach:tag,soKeHoach:tag,namHoc:'2030-2031'});pid=p.maKeHoach;
    await w.selectPlanActivities(c,pid,{maHDs:[aid]});await w.submitPlan(c,pid);await w.reviewPlan(c,pid,{action:'approve'});
    await d.save(c,aid,{tenKeHoach:tag,noiDung:'Tổ chức thi',theLe:'Cá nhân',hinhThucThi:'Cá nhân',thoiGianBatDau:'2030-10-30T02:00:00Z',thoiGianKetThuc:'2030-10-30T04:00:00Z',hanDangKy:'2030-10-29T02:00:00Z',diemRenLuyen:7});
    await assert.rejects(d.publish(c,aid));await d.submit(c,aid);await d.review(c,aid,{action:'approve'});await d.review(c,aid,{action:'approve'});
    const published=await d.publish(c,aid);cid=published.MaCThi;assert.equal(published.TrangThaiHoatDong,'Đã công bố');assert.equal(Number(published.DiemRenLuyen),7);
    const now=Date.now(),future=n=>new Date(now+n).toISOString();
    const r=await v.createRound(c,cid,{tenVong:'Sơ loại',thuTu:1,batDauLuc:future(3600000),ketThucLuc:future(10800000),hanNopBai:future(7200000)});rid=r.MaVong;
    await v.assignRound(c,rid,{maTK:teacher.MaTK,vaiTro:'RA_DE'});await v.assignRound(c,rid,{maTK:teacher.MaTK,vaiTro:'CHAM_THI'});
    await assert.rejects(v.setRoundStatus(c,rid,{trangThai:'Đang mở'}));
    await v.saveExam(lecturer,rid,{noiDung:'Đề kiểm tra bí mật'});await v.releaseExam(lecturer,rid);await v.setRoundStatus(c,rid,{trangThai:'Đang mở'});
    await db.query("INSERT INTO DKTHAMGIA(MaHD,MaSV,HinhThuc,TrangThai) VALUES(@p1,@p2,N'Dự thi',N'Đã đăng ký')",[aid,student.MaSV]);
    await v.registerRound(learner,rid,{});
    await db.query('UPDATE VONGTHI SET BatDauLuc=@p2 WHERE MaVong=@p1',[rid,new Date(now-1000)]);
    assert.ok((await v.round(learner,rid)).exam);
    const work=await v.submitWork(learner,rid,{tieuDe:'Bài kiểm tra',moTa:'Nội dung bài làm'});
    await assert.rejects(v.submitWork(learner,rid,{tieuDe:'Bài trùng'}));
    await v.setRoundStatus(c,rid,{trangThai:'Đã đóng'});await v.scoreWork(lecturer,work.MaBai,{diem:85});
    const award=await v.createAward(c,cid,{tenGT:'Giải kiểm tra',slGiai:1,tienThuong:0});
    const result=await v.createResult(c,cid,{maBai:work.MaBai,maGT:award.MaGT,xepHang:1});await v.publishResult(c,result.MaKQ);
    const final=await v.competition(learner,cid);assert.equal(final.results.length,1);
    console.log('PASS: proposal + cost, annual approval, faculty/CTSV signatures, publication, exams, round registration, submissions, scoring, awards.');
  } catch(e) {console.error(e.stack);process.exitCode=1;}
  finally {
    if(rid) await db.query('DELETE FROM CHAMDIEMVONG WHERE MaBai IN(SELECT MaBai FROM BAITHI WHERE MaVong=@p1); DELETE FROM BAITHI WHERE MaVong=@p1; DELETE FROM DANGKYVONGTHI WHERE MaVong=@p1; DELETE FROM DETHIVONG WHERE MaVong=@p1; DELETE FROM PHANCONGVONGTHI WHERE MaVong=@p1; DELETE FROM VONGTHI WHERE MaVong=@p1;',[rid]);
    if(cid) await db.query('DELETE FROM KETQUAHOCTHUAT WHERE MaCThi=@p1; DELETE FROM GIAITHUONG WHERE MaCThi=@p1;',[cid]);
    if(aid) await db.query('DELETE FROM THONGBAO WHERE MaHD=@p1; DELETE FROM DKTHAMGIA WHERE MaHD=@p1; DELETE FROM KEHOACHTOCHUC WHERE MaHD=@p1; DELETE FROM CUOCTHI WHERE MaHD=@p1; DELETE FROM KINHPHIHOATDONG WHERE MaHD=@p1; DELETE FROM DUTRUKINHPHI WHERE MaHD=@p1; DELETE FROM HOATDONGHOCTHUAT WHERE MaHD=@p1;',[aid]);
    if(pid) await db.query('DELETE FROM KEHOACHHOCTHUAT WHERE MaKeHoach=@p1',[pid]);
    await db.onModuleDestroy();console.log('Test fixtures removed.');
  }
})();
