// Browser tests use API fixtures and never modify database records.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errors = [];
const activity = { MaHD: 71, MaCThi: 8, TenHoatDong: 'Cuộc thi kiểm thử Web', TrangThai: 'Đã công bố', HinhThucThi: 'Cá nhân', DiaDiem: 'Phòng máy', ThoiGianBatDau: '2030-10-30T02:00:00Z', HanDangKy: '2030-10-29T02:00:00Z' };
const registrations = [];
const requests = [];
async function newPage(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/auth/me', route => route.fulfill({ json: { user: { id: '17', name: 'Tài khoản kiểm thử', username: 'ui-test', roles: [role] } } }));
  await page.route('**/api/v1/notifications/mine', route => route.fulfill({ json: [{ MaThongBao: 1, TieuDe: 'Thông báo kiểm thử', NoiDung: 'Nội dung thông báo', GuiLuc: '2030-10-01T01:00:00Z' }] }));
  return page;
}
try {
  await mkdir(resolve('artifacts/test-video'), { recursive: true });
  const student = await newPage('SINHVIEN');
  await student.route('**/api/v1/activities', route => route.fulfill({ json: [activity, { ...activity, MaHD: 72, MaCThi: 9, TenHoatDong: 'Cuộc thi đội nhóm', HinhThucThi: 'Theo đội' }] }));
  await student.route('**/api/v1/registrations/**', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); requests.push(body);
      registrations.push({ MaDK: registrations.length + 1, TenHoatDong: activity.TenHoatDong, HinhThuc: body.hinhThuc || 'Dự thi', TrangThai: 'Đã đăng ký' });
      return route.fulfill({ json: { message: 'Đăng ký thành công' } });
    }
    return route.fulfill({ json: registrations });
  });
  await student.route('**/api/v1/mobile/my-training-points', route => route.fulfill({ json: { tongDiem: 7, chiTiet: [
    { MaDiem: 1, TenHoatDong: activity.TenHoatDong, NamHoc: '2030-2031', HocKy: 'HK1', SoDiem: 7, LyDo: 'Dự thi', TrangThai: 'Đã xác nhận' },
    { MaDiem: 2, TenHoatDong: 'Cổ vũ học thuật', NamHoc: '2030-2031', HocKy: 'HK1', SoDiem: 3, LyDo: 'Cổ vũ', TrangThai: 'Chờ xác nhận' },
  ] } }));
  await student.goto(`${base}/dashboard/registrations`);
  await student.getByRole('combobox', { name: 'Hoạt động đã công bố', exact: true }).selectOption('71');
  await student.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click();
  await expect(student.getByText('Đăng ký thành công', { exact: true })).toBeVisible();
  expect(requests[0]).toEqual({ maHD: 71, hinhThuc: 'Dự thi' });
  await student.getByRole('combobox', { name: 'Hoạt động đã công bố', exact: true }).selectOption('72');
  await student.getByLabel('Tên đội', { exact: true }).fill('Đội kiểm thử');
  await student.getByLabel(/MSSV thành viên/).fill('SV001, SV002');
  await student.getByRole('button', { name: 'Tạo đội và đăng ký dự thi' }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toEqual({ maCThi: 9, tenDoi: 'Đội kiểm thử', thanhVienMSSV: ['SV001','SV002'] });
  await student.goto(`${base}/dashboard/support`);
  await student.getByRole('combobox', { name: 'Hoạt động đã công bố', exact: true }).selectOption('71');
  await student.getByRole('combobox', { name: 'Hình thức tham gia', exact: true }).selectOption('Cổ vũ');
  await student.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2]).toEqual({ maHD: 71, hinhThuc: 'Cổ vũ' });
  await expect(student.getByRole('heading', { name: 'Phân chỉ tiêu theo lớp' })).toHaveCount(0);
  await student.goto(`${base}/dashboard/training-points`);
  await expect(student.getByRole('cell', { name: 'Chờ xác nhận', exact: true })).toBeVisible();
  await expect(student.getByText('Điểm đã xác nhận:')).toContainText('7');
  await expect(student.getByRole('button', { name: 'Duyệt khoản DRL' })).toHaveCount(0);
  await student.screenshot({ path: resolve('artifacts/test-video/student-training-points.png'), fullPage: true });

  const staff = await newPage('GIANGVIEN');
  let articles = [];
  await staff.route('**/api/v1/news**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/activities')) return route.fulfill({ json: [activity] });
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      const article = { MaTin: 1, MaHD: body.maHD, TieuDe: body.tieuDe, NoiDung: body.noiDung, TrangThai: 'Dự thảo', CanManage: 1, TenHoatDong: activity.TenHoatDong, LoaiHoatDong: 'Cuộc thi' };
      articles = [article]; return route.fulfill({ json: article });
    }
    if (request.method() === 'PATCH') { articles[0].TrangThai = request.postDataJSON().trangThai; return route.fulfill({ json: articles[0] }); }
    return route.fulfill({ json: articles });
  });
  await staff.goto(`${base}/dashboard/news`);
  await staff.getByRole('button', { name: 'Soạn bản tin', exact: true }).click();
  await staff.getByRole('combobox', { name: /^Hoạt động phụ trách/ }).selectOption('71');
  await staff.getByLabel('Tiêu đề bản tin', { exact: true }).fill('Thông báo thi học thuật');
  await staff.getByLabel('Nội dung bản tin', { exact: true }).fill('Lịch thi sơ loại và chung kết. Sinh viên đăng ký theo kế hoạch đã duyệt.');
  await staff.getByRole('button', { name: 'Lưu bản tin dự thảo', exact: true }).click();
  await staff.getByRole('button', { name: 'Đăng tin', exact: true }).click();
  await expect(staff.getByRole('link', { name: 'Xem hoạt động và đăng ký tham gia' })).toBeVisible();
  await staff.getByRole('button', { name: 'Đóng soạn tin', exact: true }).click();
  await staff.screenshot({ path: resolve('artifacts/test-video/academic-news.png'), fullPage: true });
  await staff.getByRole('button', { name: 'Ẩn tin', exact: true }).click();
  await expect(staff.getByRole('link', { name: 'Xem hoạt động và đăng ký tham gia' })).toHaveCount(0);
  await staff.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await expect(staff.getByText('Thông báo kiểm thử', { exact: true }).first()).toBeVisible();
  await staff.getByRole('button', { name: 'Thông báo', exact: true }).click();
  const closeNotice = staff.getByRole('button', { name: 'Đóng thông báo', exact: true });
  if (await closeNotice.count()) await closeNotice.click();
  await staff.evaluate(() => window.scrollTo(0, 0));
  await staff.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => staff.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await staff.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await staff.screenshot({ path: resolve('artifacts/test-video/academic-news-mobile.png'), fullPage: true });
  const admin = await newPage('ADMIN');
  let seminar = { MaSeminar: 7, MaHD: 71, ChuDe: 'Seminar kiểm thử', TrangThai: 'Đã công bố', DienGia: '[]', ChuongTrinh: '[]', TaiLieu: '[]' };
  await admin.route('**/api/v1/news/activities', route => route.fulfill({ json: [activity] }));
  await admin.route('**/api/v1/seminars**', route => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      seminar = { ...seminar, DVChuTri: body.dvChuTri, DVPhoiHop: body.dvPhoiHop, ThoiLuong: body.thoiLuong, DienGia: JSON.stringify(body.dienGia), ChuongTrinh: JSON.stringify(body.chuongTrinh) };
      return route.fulfill({ json: seminar });
    }
    return route.fulfill({ json: [seminar] });
  });
  await admin.goto(`${base}/dashboard/seminars`);
  await admin.getByRole('button', { name: 'Xem seminar', exact: true }).click();
  await admin.getByLabel('Đơn vị chủ trì', { exact: true }).fill('Khoa CNTT');
  await admin.getByLabel('Diễn giả (mỗi người một dòng)', { exact: true }).fill('Diễn giả A');
  await admin.getByLabel('Chương trình (mỗi dòng: thời gian | nội dung | phụ trách)', { exact: true }).fill('09:00 | Báo cáo chuyên đề | Giảng viên A');
  await admin.getByRole('button', { name: 'Lưu thông tin seminar', exact: true }).click();
  await expect(admin.getByText('Diễn giả A ·', { exact: true })).toBeVisible();
  expect(JSON.parse(seminar.ChuongTrinh)[0]).toEqual({ thoiGian: '09:00', noiDung: 'Báo cáo chuyên đề', phuTrach: 'Giảng viên A' });
  await admin.screenshot({ path: resolve('artifacts/test-video/seminar-management.png'), fullPage: true });
  let settlement = null;
  let expenses = [];
  await admin.route('**/api/v1/academic-activities', route => route.fulfill({ json: [{ ...activity, KinhPhiDuTru: 1000000 }] }));
  await admin.route('**/api/v1/expenses', route => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ maHD: 71, noiDung: 'In ấn tài liệu', soTien: 500000, ngChi: '2030-10-30' });
    settlement = { MaHS: 88, NguoiLap: 17, TrangThai: 'Dự thảo', TenNguoiLap: 'Tài khoản kiểm thử' };
    expenses = [{ MaCP: 1, NoiDung: body.noiDung, SoTien: body.soTien, NgChi: body.ngChi, ChungTu: JSON.stringify(body.chungTu) }];
    return route.fulfill({ json: { maCP: 1, maHS: 88 } });
  });
  await admin.route('**/api/v1/settlements/**', route => {
    if (route.request().method() !== 'GET') { settlement.TrangThai = route.request().method() === 'POST' ? 'Chờ duyệt' : 'Đã duyệt'; return route.fulfill({ json: settlement }); }
    return route.fulfill({ json: { settlement, expenses, totalAmount: expenses.reduce((total, item) => total + item.SoTien, 0) } });
  });
  await admin.goto(`${base}/dashboard/actual-expenses`);
  await admin.getByRole('combobox', { name: 'Hoạt động quyết toán', exact: true }).selectOption('71');
  await admin.getByLabel('Nội dung chi', { exact: true }).fill('In ấn tài liệu');
  await admin.getByLabel('Số tiền (VND)', { exact: true }).fill('500000');
  await admin.getByLabel('Ngày chi', { exact: true }).fill('2030-10-30');
  await admin.getByLabel('Đường dẫn chứng từ (mỗi dòng một tệp)', { exact: true }).fill('https://example.com/receipt.pdf');
  await admin.getByRole('button', { name: 'Lưu khoản chi', exact: true }).click();
  await expect(admin.getByRole('link', { name: 'Mở chứng từ', exact: true })).toBeVisible();
  await admin.getByRole('button', { name: 'Gửi hồ sơ quyết toán', exact: true }).click();
  await admin.getByRole('button', { name: 'Duyệt hồ sơ quyết toán', exact: true }).click();
  await expect.poll(() => settlement.TrangThai).toBe('Đã duyệt');
  await admin.screenshot({ path: resolve('artifacts/test-video/settlement-management.png'), fullPage: true });
  expect(errors).toEqual([]);
  console.log('PASS: student registration/teams/support, personal training points, news, notification bell, seminar management, receipts/settlement submission/approval, mobile layout.');
} finally { await browser.close(); }
