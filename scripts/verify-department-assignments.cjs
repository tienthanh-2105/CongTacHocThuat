// Uses isolated fixtures, checks the live API/UI, then removes its own test data.
require('reflect-metadata');
require('dotenv').config({ path: require('node:path').resolve(__dirname,'../apps/api/.env'), quiet:true });
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { ConfigService } = require('@nestjs/config');
const { DatabaseService } = require('../apps/api/dist/data/database.service');
const db = new DatabaseService(new ConfigService());
const api = 'http://localhost:3001/api/v1';
const web = 'http://localhost:3000';
const tag = `VERIFY-PC-${randomUUID().slice(0,8)}`;
const fixture = { departments:[], users:[], accounts:[] };
let browser;
async function call(token, route, body, method) {
  const response = await fetch(`${api}${route}`, {
    method:method || (body ? 'POST' : 'GET'),
    headers:{ Cookie:`academic_session=${token}`, ...(body ? { 'Content-Type':'application/json' } : {}) },
    ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(30000),
  });
  return { status:response.status, data:await response.json() };
}
async function account(role, department, faculty, label, head=false) {
  const user = (await db.query('INSERT INTO NGUOIDUNG(HoTen,Email) OUTPUT INSERTED.MaNgDung VALUES(@p1,@p2)',[label,`${tag}.${fixture.users.length}@example.invalid`]))[0].MaNgDung;
  fixture.users.push(user);
  const account = (await db.query('INSERT INTO TAIKHOAN(MaNgDung,MaVaiTro,TenDangNhap,MatKhau) OUTPUT INSERTED.MaTK VALUES(@p1,@p2,@p3,@p4)',[user,role,`${tag}.${fixture.users.length}`,randomBytes(32).toString('hex')]))[0].MaTK;
  fixture.accounts.push(account);
  await db.query('INSERT INTO GIANGVIEN(MaNgDung,MaBM,HocVi) VALUES(@p1,@p2,@p3)',[user,department,'Thạc sĩ']);
  if (head) await db.query('INSERT INTO CANBOKHOA(MaNgDung,MaKhoa,ChucVu) VALUES(@p1,@p2,@p3)',[user,faculty,'Phụ trách bộ môn']);
  const token = randomBytes(32).toString('hex');
  await db.query('INSERT INTO PHIENDANGNHAP(MaPhien,MaBamToken,MaTK,PBMatKhau,HetHanLuc) VALUES(@p1,@p2,@p3,0,@p4)',[randomUUID(),createHash('sha256').update(token).digest('hex'),account,new Date(Date.now()+600000)]);
  return { id:account,token,label };
}
async function browserContext(token) {
  const context = await browser.newContext({ viewport:{ width:1600,height:1000 } });
  await context.addCookies([{ name:'academic_session',value:token,domain:'localhost',path:'/',httpOnly:true,sameSite:'Strict' }]);
  return context;
}
async function main() {
  await db.onModuleInit();
  try {
    const faculty = (await db.query("SELECT TOP(1) MaKhoa FROM KHOA WHERE TenKhoa IN(N'Công nghệ thông tin',N'Khoa Công nghệ thông tin',N'CNTT',N'Khoa CNTT')"))[0]?.MaKhoa;
    const role = (await db.query("SELECT TOP(1) MaVaiTro FROM VAITRO WHERE TenVaiTro IN(N'GIANGVIEN',N'Giảng viên',N'GIANG_VIEN')"))[0]?.MaVaiTro;
    assert.ok(faculty && role,'Missing CNTT faculty or lecturer role');
    for (let i=0;i<2;i++) fixture.departments.push((await db.query('INSERT INTO BOMON(MaKhoa,TenBM) OUTPUT INSERTED.MaBM VALUES(@p1,@p2)',[faculty,`${tag}-${i}`]))[0].MaBM);
    const head = await account(role,fixture.departments[0],faculty,'Phụ trách bộ môn kiểm thử',true);
    const lead = await account(role,fixture.departments[0],faculty,'Giảng viên chủ trì kiểm thử');
    const collaborator = await account(role,fixture.departments[0],faculty,'Giảng viên phối hợp kiểm thử');
    const outsider = await account(role,fixture.departments[1],faculty,'Giảng viên ngoài bộ môn kiểm thử');
    const payload = { maBM:fixture.departments[0],tenHoatDong:tag,loaiHoatDong:'Seminar',namHoc:'2026-2027',noiDung:'Chuẩn bị nội dung seminar và bảng dự trù kinh phí chung.',hanHoanThanh:'2099-01-01',maTKs:[lead.id,collaborator.id],nguoiChuTri:lead.id };
    assert.equal((await call(lead.token,'/department-plans/assignments',payload)).status,403);
    assert.equal((await call(head.token,'/department-plans/assignments',{ ...payload,maTKs:[lead.id,outsider.id] })).status,400);
    assert.equal((await call(head.token,'/department-plans/assignments',{ ...payload,nguoiChuTri:outsider.id })).status,400);
    assert.equal((await db.query('SELECT COUNT(*) AS total FROM PHANCONGDEXUATBOMON WHERE MaBM=@p1',[fixture.departments[0]]))[0].total,0);
    console.log('PASS: permissions, department scope, lead validation and no partial assignment');

    browser = await chromium.launch({ channel:'chrome',headless:true });
    const output = path.resolve(__dirname,'../artifacts/department-assignments');
    await mkdir(output,{ recursive:true });
    const headContext = await browserContext(head.token);
    const page = await headContext.newPage();
    const errors=[];
    page.on('pageerror',(error)=>errors.push(error.message));
    await page.goto(`${web}/dashboard/department-plans`);
    await expect(page.getByRole('heading',{ name:'Phân công thực hiện đề xuất cuộc thi/seminar kèm dự trù kinh phí',exact:true })).toBeVisible({ timeout:60000 });
    await expect(page.getByRole('button',{ name:'PC Thực hiện KH' })).toBeDisabled();
    await page.getByRole('checkbox',{ name:`Chọn ${lead.label}`,exact:true }).check();
    await page.getByRole('checkbox',{ name:`Chọn ${collaborator.label}`,exact:true }).check();
    await page.screenshot({ path:path.join(output,'department-selection.png'),fullPage:true,animations:'disabled' });
    await page.getByRole('button',{ name:'PC Thực hiện KH (2)' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Tên cuộc thi / seminar *',{ exact:true }).fill(tag);
    await form.locator('select[name="loaiHoatDong"]').selectOption('Seminar');
    await form.getByLabel('Hạn hoàn thành *',{ exact:true }).fill(payload.hanHoanThanh);
    await form.getByLabel('Yêu cầu lập đề xuất và dự trù kinh phí *',{ exact:true }).fill(payload.noiDung);
    await form.getByLabel('Người chủ trì *').selectOption(String(lead.id));
    await page.screenshot({ path:path.join(output,'assignment-form.png'),fullPage:true,animations:'disabled' });
    const responsePromise = page.waitForResponse((response)=>response.url()===`${api}/department-plans/assignments` && response.request().method()==='POST');
    await form.getByRole('button',{ name:'Phân công',exact:true }).click();
    const response = await responsePromise;
    const result = await response.json();
    assert.equal(response.status(),201,JSON.stringify(result));
    const id = result.MaPhanCongDeXuat;
    await expect(page.getByText('Đã phân công và gửi thông báo đến 2 giảng viên.',{ exact:true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(tag,{ exact:true })).toBeVisible({ timeout:30000 });
    console.log('PASS: multiple selection, form, assignment persistence after reload');

    const notifications = (await call(lead.token,'/notifications/mine')).data;
    const notification = notifications.find((item)=>item.MaPhanCongDeXuat===id);
    assert.ok(notification && !notification.DocLuc);
    assert.equal((await call(collaborator.token,'/notifications/mine')).data.filter((item)=>item.MaPhanCongDeXuat===id).length,1);
    assert.equal((await call(outsider.token,'/notifications/mine')).data.length,0);
    assert.equal((await call(outsider.token,`/department-plans/assignments/${id}`)).status,404);
    assert.equal((await call(outsider.token,`/notifications/${notification.MaThongBao}/read`,undefined,'PATCH')).status,404);
    assert.equal((await call(lead.token,`/department-plans/assignments/${id}`)).data.members.length,2);
    console.log('PASS: one private notification per recipient, shared assignment, detail access isolation');

    const lecturerContext = await browserContext(lead.token);
    const lecturerPage = await lecturerContext.newPage();
    lecturerPage.on('pageerror',(error)=>errors.push(error.message));
    await lecturerPage.goto(`${web}/dashboard/academic-list`);
    await expect(lecturerPage.getByRole('button',{ name:'Thông báo, 1 chưa đọc',exact:true })).toBeVisible({ timeout:60000 });
    await lecturerPage.getByRole('button',{ name:'Thông báo, 1 chưa đọc',exact:true }).click();
    await lecturerPage.getByRole('button',{ name:new RegExp(`Phân công lập đề xuất seminar: ${tag}`) }).click();
    const detail = lecturerPage.getByRole('dialog');
    await expect(detail.getByRole('heading',{ name:tag,exact:true })).toBeVisible();
    await expect(detail.getByText(`${lead.label} · Chủ trì`,{ exact:true })).toBeVisible();
    await expect(detail.getByText(`${collaborator.label} · Phối hợp`,{ exact:true })).toBeVisible();
    await lecturerPage.screenshot({ path:path.join(output,'lecturer-notification.png'),fullPage:true,animations:'disabled' });
    await detail.getByRole('button',{ name:'Đóng chi tiết phân công',exact:true }).click();
    await expect(lecturerPage.getByRole('button',{ name:'Thông báo',exact:true })).toBeVisible();
    assert.ok((await call(lead.token,'/notifications/mine')).data.find((item)=>item.MaThongBao===notification.MaThongBao).DocLuc);
    await page.setViewportSize({ width:390,height:844 });
    await page.screenshot({ path:path.join(output,'department-mobile.png'),fullPage:true,animations:'disabled' });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth),false,'Mobile page must not overflow');
    assert.deepEqual(errors,[]);
    console.log('PASS: lecturer unread badge, notification details, read state, mobile layout, no browser errors');
    console.log(`Screenshots: ${output}`);
  } finally {
    if (browser) await browser.close();
    for (const department of fixture.departments) {
      await db.query('DELETE FROM THONGBAO WHERE MaPhanCongDeXuat IN(SELECT MaPhanCongDeXuat FROM PHANCONGDEXUATBOMON WHERE MaBM=@p1)',[department]);
      await db.query('DELETE FROM NGUOITHUCHIENDEXUAT WHERE MaPhanCongDeXuat IN(SELECT MaPhanCongDeXuat FROM PHANCONGDEXUATBOMON WHERE MaBM=@p1)',[department]);
      await db.query('DELETE FROM PHANCONGDEXUATBOMON WHERE MaBM=@p1',[department]);
    }
    for (const id of fixture.accounts) {
      await db.query('DELETE FROM PHIENDANGNHAP WHERE MaTK=@p1',[id]);
      await db.query('DELETE FROM TAIKHOAN WHERE MaTK=@p1',[id]);
    }
    for (const id of fixture.users) {
      await db.query('DELETE FROM GIANGVIEN_BOMON WHERE MaGV IN(SELECT MaGV FROM GIANGVIEN WHERE MaNgDung=@p1)',[id]);
      await db.query('DELETE FROM CANBOKHOA WHERE MaNgDung=@p1',[id]);
      await db.query('DELETE FROM GIANGVIEN WHERE MaNgDung=@p1',[id]);
      await db.query('DELETE FROM NGUOIDUNG WHERE MaNgDung=@p1',[id]);
    }
    for (const department of fixture.departments) await db.query('DELETE FROM BOMON WHERE MaBM=@p1',[department]);
    await db.onModuleDestroy();
    console.log('Test fixtures removed.');
  }
}
main().catch((error)=>{ console.error(error); process.exitCode=1; });
